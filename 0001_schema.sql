-- MENA — esquema base. Executar no SQL Editor do Supabase (ou `supabase db push`).
-- Todas as tabelas têm RLS activa. Preços, zonas e capacidades são dados configuráveis; nada é fixo.

create extension if not exists postgis;

-- ───────── Enums ─────────
create type user_role as enum ('client', 'driver', 'admin');
create type driver_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type order_status as enum (
  'sent',            -- Pedido enviado
  'awaiting',        -- À espera de aceitação
  'accepted',        -- Pedido aceite
  'on_the_way',      -- Motorista a caminho
  'arrived',         -- Motorista chegou
  'in_progress',     -- Abastecimento em curso
  'completed',       -- Abastecimento concluído
  'cancelled'        -- Pedido cancelado
);
create type payment_method as enum ('cash', 'bank_transfer', 'in_app');
create type payment_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type complaint_status as enum ('open', 'in_review', 'resolved');

-- ───────── Perfis ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null default '',
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  description text,
  location geography(point, 4326),
  created_at timestamptz not null default now()
);

-- ───────── Motoristas e cisternas ─────────
create table drivers (
  id uuid primary key references profiles(id) on delete cascade,
  status driver_status not null default 'pending',
  is_available boolean not null default false,
  operating_zone_id uuid,
  last_location geography(point, 4326),
  last_location_at timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table tankers (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  plate text not null unique,
  capacity_liters integer not null check (capacity_liters > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────── Configuração (zonas, preços, tipos de mangueira) ─────────
create table service_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area geography(multipolygon, 4326),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table drivers add constraint drivers_zone_fk foreign key (operating_zone_id) references service_zones(id);

-- Regras de preço: modelo inicial POR LITRO. Valores definidos pelo administrador.
-- price = price_per_liter * litros + base_fee, com mínimo opcional. Zona opcional (null = todas).
create table price_rules (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references service_zones(id),
  price_per_liter numeric(12,4) not null check (price_per_liter >= 0),
  base_fee numeric(12,2) not null default 0 check (base_fee >= 0),
  min_total numeric(12,2),
  min_liters integer,
  max_liters integer,
  currency text not null default 'AOA',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────── Pedidos ─────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  driver_id uuid references drivers(id),
  tanker_id uuid references tankers(id),
  status order_status not null default 'sent',
  liters integer not null check (liters > 0),
  delivery_address text,
  delivery_location geography(point, 4326) not null,
  contact_phone text,
  price_rule_id uuid references price_rules(id),
  price_per_liter numeric(12,4) not null,
  base_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  currency text not null default 'AOA',
  payment_method payment_method not null default 'cash',
  cancel_reason text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
create index orders_client_idx on orders(client_id, created_at desc);
create index orders_driver_idx on orders(driver_id, created_at desc);
create index orders_status_idx on orders(status);
create index orders_loc_idx on orders using gist(delivery_location);

-- Recusas por motorista (um pedido "awaiting" pode ser recusado por vários motoristas sem sair da fila)
create table order_declines (
  order_id uuid references orders(id) on delete cascade,
  driver_id uuid references drivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (order_id, driver_id)
);

-- Registo imutável de transições
create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  actor_id uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

-- ───────── Pagamentos ─────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  method payment_method not null,
  status payment_status not null default 'pending',
  amount numeric(12,2) not null,
  currency text not null default 'AOA',
  provider text,               -- ex.: nome do agregador quando existir
  provider_reference text,     -- referência devolvida pelo fornecedor
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_order_idx on payments(order_id);

-- ───────── Notificações, avaliações, reclamações, auditoria ─────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  order_id uuid references orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  client_id uuid not null references profiles(id),
  driver_id uuid not null references drivers(id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  order_id uuid references orders(id),
  subject text not null,
  body text,
  status complaint_status not null default 'open',
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
