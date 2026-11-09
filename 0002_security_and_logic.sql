-- MENA — segurança (RLS) e lógica de servidor.
-- Princípio: clientes e motoristas NÃO escrevem directamente em orders/payments/order_events.
-- Todas as operações críticas passam por funções SECURITY DEFINER que validam papel, dono e transição.

-- ───────── Configuração da plataforma ─────────
create table app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
insert into app_settings(key, value, description) values
  ('dispatch_radius_m', '10000', 'Raio (metros) em que um motorista disponível vê pedidos à espera.'),
  ('in_app_payments_enabled', 'false', 'Só activar quando existir integração real com um fornecedor de pagamentos.');

-- ───────── Helpers ─────────
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_approved_driver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from drivers where id = auth.uid() and status = 'approved');
$$;

create or replace function setting_num(k text, fallback numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from app_settings where key = k), fallback);
$$;

create or replace function notify(p_user uuid, p_type text, p_title text, p_body text, p_order uuid)
returns void language sql security definer set search_path = public as $$
  insert into notifications(user_id, type, title, body, order_id) values (p_user, p_type, p_title, p_body, p_order);
$$;
revoke all on function notify(uuid, text, text, text, uuid) from public, anon, authenticated;

create or replace function log_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
$$;
revoke all on function log_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ───────── Criação de perfil no registo ─────────
-- O papel 'admin' NUNCA é atribuído aqui. Motorista começa como 'pending'.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := coalesce(new.raw_user_meta_data->>'role', 'client');
  r user_role := case when wanted = 'driver' then 'driver'::user_role else 'client'::user_role end;
begin
  insert into profiles(id, role, full_name, phone, email)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone', new.email);
  if r = 'driver' then
    insert into drivers(id) values (new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- ───────── RLS: activar em tudo ─────────
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table drivers enable row level security;
alter table tankers enable row level security;
alter table service_zones enable row level security;
alter table price_rules enable row level security;
alter table orders enable row level security;
alter table order_declines enable row level security;
alter table order_events enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table reviews enable row level security;
alter table complaints enable row level security;
alter table audit_log enable row level security;
alter table push_subscriptions enable row level security;
alter table app_settings enable row level security;

-- Relação entre utilizadores através de pedidos (sem recursão de RLS)
create or replace function shares_order_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where (o.client_id = auth.uid() and o.driver_id = other)
       or (o.driver_id = auth.uid() and o.client_id = other)
  );
$$;

-- Motorista pode ver este pedido? (atribuído a si, ou à espera dentro do raio e não recusado)
create or replace function driver_can_see_order(o orders) returns boolean
language sql stable security definer set search_path = public as $$
  select o.driver_id = auth.uid()
      or (
        o.status = 'awaiting'
        and exists (select 1 from drivers d
                    where d.id = auth.uid() and d.status = 'approved' and d.is_available
                      and d.last_location is not null
                      and st_dwithin(d.last_location, o.delivery_location, setting_num('dispatch_radius_m', 10000)))
        and not exists (select 1 from order_declines x where x.order_id = o.id and x.driver_id = auth.uid())
      );
$$;

-- profiles
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin() or shares_order_with(id));
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- Colunas editáveis pelo próprio: nunca 'role'.
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;
revoke insert, delete on profiles from authenticated;

-- addresses
create policy addresses_own on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_admin_read on addresses for select using (is_admin());

-- drivers
create policy drivers_select on drivers for select
  using (id = auth.uid() or is_admin() or shares_order_with(id));
revoke insert, update, delete on drivers from authenticated;
-- Mudanças de estado/disponibilidade passam por funções abaixo.

-- tankers: o dono gere as suas; admin vê e gere todas
create policy tankers_select on tankers for select using (driver_id = auth.uid() or is_admin());
create policy tankers_insert on tankers for insert with check (driver_id = auth.uid());
create policy tankers_update on tankers for update using (driver_id = auth.uid() or is_admin()) with check (driver_id = auth.uid() or is_admin());

-- configuração: leitura para utilizadores autenticados, escrita só admin
create policy zones_read on service_zones for select to authenticated using (true);
create policy zones_admin on service_zones for all using (is_admin()) with check (is_admin());
create policy prices_read on price_rules for select to authenticated using (active or is_admin());
create policy prices_admin on price_rules for all using (is_admin()) with check (is_admin());
create policy settings_admin on app_settings for all using (is_admin()) with check (is_admin());

-- orders: apenas leitura directa; escrita só via funções
create policy orders_select on orders for select
  using (client_id = auth.uid() or is_admin() or driver_can_see_order(orders));
revoke insert, update, delete on orders from authenticated;

create policy declines_select on order_declines for select using (driver_id = auth.uid() or is_admin());
revoke insert, update, delete on order_declines from authenticated;

create policy events_select on order_events for select
  using (is_admin() or exists (select 1 from orders o where o.id = order_id and (o.client_id = auth.uid() or o.driver_id = auth.uid())));
revoke insert, update, delete on order_events from authenticated;

create policy payments_select on payments for select
  using (is_admin() or exists (select 1 from orders o where o.id = order_id and (o.client_id = auth.uid() or o.driver_id = auth.uid())));
revoke insert, update, delete on payments from authenticated;

create policy notifications_own on notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
revoke insert, delete on notifications from authenticated;

create policy reviews_select on reviews for select
  using (client_id = auth.uid() or driver_id = auth.uid() or is_admin());
create policy reviews_insert on reviews for insert
  with check (client_id = auth.uid() and exists (
    select 1 from orders o where o.id = order_id and o.client_id = auth.uid() and o.status = 'completed' and o.driver_id = reviews.driver_id));

create policy complaints_select on complaints for select using (user_id = auth.uid() or is_admin());
create policy complaints_insert on complaints for insert with check (user_id = auth.uid());
create policy complaints_admin_update on complaints for update using (is_admin()) with check (is_admin());

create policy audit_admin on audit_log for select using (is_admin());
revoke insert, update, delete on audit_log from authenticated;

create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── Preço (calculado no servidor) ─────────
create or replace function quote_price(p_liters int, p_lat double precision, p_lng double precision)
returns table(rule_id uuid, price_per_liter numeric, base_fee numeric, total numeric, currency text)
language plpgsql stable security definer set search_path = public as $$
declare
  pt geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  r price_rules;
  t numeric;
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  select pr.* into r from price_rules pr
  where pr.active
    and (pr.min_liters is null or p_liters >= pr.min_liters)
    and (pr.max_liters is null or p_liters <= pr.max_liters)
    and (pr.zone_id is null or exists (select 1 from service_zones z where z.id = pr.zone_id and z.active and z.area is not null and st_covers(z.area, pt)))
  order by (pr.zone_id is not null) desc, pr.created_at desc
  limit 1;
  if not found then return; end if;  -- sem regra aplicável: sem preço
  t := r.price_per_liter * p_liters + r.base_fee;
  if r.min_total is not null and t < r.min_total then t := r.min_total; end if;
  return query select r.id, r.price_per_liter, r.base_fee, round(t, 2), r.currency;
end $$;

-- ───────── Cisternas próximas (sem expor localização exacta) ─────────
create or replace function nearby_tankers(p_lat double precision, p_lng double precision, p_radius_m int default null)
returns table(driver_id uuid, driver_name text, capacity_liters int, distance_m int)
language sql stable security definer set search_path = public as $$
  select d.id, p.full_name, t.capacity_liters,
         (round(st_distance(d.last_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 50) * 50)::int
  from drivers d
  join profiles p on p.id = d.id
  join lateral (select capacity_liters from tankers where driver_id = d.id and active order by capacity_liters desc limit 1) t on true
  where auth.uid() is not null
    and d.status = 'approved' and d.is_available and d.last_location is not null
    and d.last_location_at > now() - interval '10 minutes'
    and st_dwithin(d.last_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                   coalesce(p_radius_m, setting_num('dispatch_radius_m', 10000)))
  order by 4
  limit 30;
$$;

-- ───────── Criar pedido ─────────
create or replace function create_order(
  p_liters int, p_address text, p_lat double precision, p_lng double precision,
  p_payment payment_method, p_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  q record;
  oid uuid;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  if not exists (select 1 from profiles where id = uid and role = 'client') then
    raise exception 'Só clientes podem criar pedidos';
  end if;
  if p_liters is null or p_liters <= 0 then raise exception 'Volume inválido'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Localização inválida'; end if;
  if p_payment = 'in_app' and
     coalesce((select value #>> '{}' from app_settings where key = 'in_app_payments_enabled'), 'false') <> 'true' then
    raise exception 'Pagamento na aplicação ainda não está disponível';
  end if;
  if (select count(*) from orders where client_id = uid and status in ('sent','awaiting','accepted','on_the_way','arrived','in_progress')) >= 3 then
    raise exception 'Já tem pedidos em curso';
  end if;

  select * into q from quote_price(p_liters, p_lat, p_lng);
  if q.rule_id is null then raise exception 'Sem tarifa configurada para este volume/zona'; end if;

  insert into orders(client_id, status, liters, delivery_address, delivery_location, contact_phone,
                     price_rule_id, price_per_liter, base_fee, total_amount, currency, payment_method)
  values (uid, 'sent', p_liters, p_address, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_phone,
          q.rule_id, q.price_per_liter, q.base_fee, q.total, q.currency, p_payment)
  returning id into oid;

  insert into order_events(order_id, from_status, to_status, actor_id) values (oid, null, 'sent', uid);
  update orders set status = 'awaiting' where id = oid;
  insert into order_events(order_id, from_status, to_status, actor_id) values (oid, 'sent', 'awaiting', uid);

  insert into payments(order_id, method, status, amount, currency) values (oid, p_payment, 'pending', q.total, q.currency);

  -- notificar motoristas elegíveis (disponíveis, aprovados, dentro do raio)
  insert into notifications(user_id, type, title, body, order_id)
  select d.id, 'new_order', 'Novo pedido', p_liters || ' L perto de si', oid
  from drivers d
  where d.status = 'approved' and d.is_available and d.last_location is not null
    and st_dwithin(d.last_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, setting_num('dispatch_radius_m', 10000));

  return oid;
end $$;

-- ───────── Motorista: aceitar / recusar ─────────
create or replace function accept_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; uid uuid := auth.uid(); tk uuid;
begin
  if not is_approved_driver() then raise exception 'Motorista não aprovado'; end if;
  select id into tk from tankers where driver_id = uid and active order by capacity_liters desc limit 1;
  if tk is null then raise exception 'Sem cisterna activa registada'; end if;

  -- bloqueio para impedir dois motoristas a aceitar o mesmo pedido
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if o.status <> 'awaiting' then raise exception 'Pedido já não está disponível'; end if;
  if not driver_can_see_order(o) then raise exception 'Pedido fora do seu alcance'; end if;
  if (select capacity_liters from tankers where id = tk) < o.liters then raise exception 'A sua cisterna não tem capacidade suficiente'; end if;

  update orders set status = 'accepted', driver_id = uid, tanker_id = tk, accepted_at = now() where id = p_order;
  insert into order_events(order_id, from_status, to_status, actor_id) values (p_order, 'awaiting', 'accepted', uid);
  perform notify(o.client_id, 'order_accepted', 'Pedido aceite', 'Um motorista aceitou o seu pedido.', p_order);
end $$;

create or replace function decline_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not is_approved_driver() then raise exception 'Motorista não aprovado'; end if;
  select * into o from orders where id = p_order;
  if not found or o.status <> 'awaiting' then raise exception 'Pedido já não está disponível'; end if;
  insert into order_declines(order_id, driver_id) values (p_order, auth.uid()) on conflict do nothing;
end $$;

-- ───────── Motorista: avançar estado ─────────
create or replace function advance_order(p_order uuid) returns order_status
language plpgsql security definer set search_path = public as $$
declare o orders; nxt order_status; t text; b text;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.driver_id is distinct from auth.uid() then raise exception 'Pedido não lhe pertence'; end if;
  nxt := case o.status
    when 'accepted' then 'on_the_way'
    when 'on_the_way' then 'arrived'
    when 'arrived' then 'in_progress'
    when 'in_progress' then 'completed'
    else null end;
  if nxt is null then raise exception 'Transição inválida a partir de %', o.status; end if;

  update orders set status = nxt, completed_at = case when nxt = 'completed' then now() else completed_at end where id = p_order;
  insert into order_events(order_id, from_status, to_status, actor_id) values (p_order, o.status, nxt, auth.uid());

  t := case nxt when 'on_the_way' then 'Motorista a caminho' when 'arrived' then 'Motorista chegou'
                when 'in_progress' then 'Abastecimento iniciado' when 'completed' then 'Abastecimento concluído' end;
  b := case nxt when 'on_the_way' then 'O motorista saiu em direcção à sua morada.' when 'arrived' then 'O motorista está no local.'
                when 'in_progress' then 'O abastecimento começou.' when 'completed' then 'Obrigado por usar a MENA.' end;
  perform notify(o.client_id, nxt::text, t, b, p_order);
  return nxt;
end $$;

-- ───────── Cancelar ─────────
create or replace function cancel_order(p_order uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; uid uuid := auth.uid(); allowed boolean;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  allowed := case
    when is_admin() then o.status not in ('completed','cancelled')
    when o.client_id = uid then o.status in ('sent','awaiting','accepted')
    when o.driver_id = uid then o.status in ('accepted','on_the_way')
    else false end;
  if not allowed then raise exception 'Não pode cancelar este pedido neste estado'; end if;

  update orders set status = 'cancelled', cancel_reason = p_reason where id = p_order;
  insert into order_events(order_id, from_status, to_status, actor_id, note) values (p_order, o.status, 'cancelled', uid, p_reason);
  update payments set status = 'failed' where order_id = p_order and status = 'pending';
  perform notify(o.client_id, 'order_cancelled', 'Pedido cancelado', coalesce(p_reason, ''), p_order);
  if o.driver_id is not null then
    perform notify(o.driver_id, 'order_cancelled', 'Pedido cancelado', coalesce(p_reason, ''), p_order);
  end if;
end $$;

-- ───────── Pagamento directo: o motorista confirma que recebeu ─────────
create or replace function confirm_direct_payment(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.driver_id is distinct from auth.uid() then raise exception 'Pedido não lhe pertence'; end if;
  if o.status <> 'completed' then raise exception 'O abastecimento ainda não foi concluído'; end if;
  if o.payment_method = 'in_app' then raise exception 'Pagamentos na aplicação são confirmados pelo fornecedor de pagamentos'; end if;
  update payments set status = 'confirmed', confirmed_at = now() where order_id = p_order and status = 'pending';
  perform notify(o.client_id, 'payment_confirmed', 'Pagamento confirmado', 'O pagamento foi registado.', p_order);
end $$;

-- ───────── Motorista: disponibilidade e posição ─────────
create or replace function set_driver_available(p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_approved_driver() then raise exception 'Motorista não aprovado'; end if;
  update drivers set is_available = p_available where id = auth.uid();
end $$;

create or replace function update_driver_location(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_approved_driver() then raise exception 'Motorista não aprovado'; end if;
  update drivers set last_location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, last_location_at = now()
  where id = auth.uid();
end $$;

-- Cliente vê a posição do motorista SÓ durante um pedido activo seu
create or replace function get_order_driver_location(p_order uuid)
returns table(lat double precision, lng double precision, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select st_y(d.last_location::geometry), st_x(d.last_location::geometry), d.last_location_at
  from orders o join drivers d on d.id = o.driver_id
  where o.id = p_order and o.client_id = auth.uid()
    and o.status in ('accepted','on_the_way','arrived','in_progress')
    and d.last_location is not null;
$$;

-- ───────── Administração ─────────
create or replace function admin_set_driver_status(p_driver uuid, p_status driver_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  update drivers set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
         is_available = case when p_status = 'approved' then is_available else false end
  where id = p_driver;
  perform log_audit('driver_status', 'drivers', p_driver::text, jsonb_build_object('status', p_status));
  perform notify(p_driver, 'driver_status', 'Estado da conta actualizado', 'Novo estado: ' || p_status::text, null);
end $$;

-- Estatísticas reais (agregadas no servidor)
create or replace function admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  return jsonb_build_object(
    'clients',          (select count(*) from profiles where role = 'client'),
    'drivers_total',    (select count(*) from drivers),
    'drivers_pending',  (select count(*) from drivers where status = 'pending'),
    'drivers_approved', (select count(*) from drivers where status = 'approved'),
    'orders_total',     (select count(*) from orders),
    'orders_active',    (select count(*) from orders where status in ('sent','awaiting','accepted','on_the_way','arrived','in_progress')),
    'orders_completed', (select count(*) from orders where status = 'completed'),
    'orders_cancelled', (select count(*) from orders where status = 'cancelled'),
    'liters_delivered', (select coalesce(sum(liters), 0) from orders where status = 'completed'),
    'revenue_confirmed',(select coalesce(sum(amount), 0) from payments where status = 'confirmed')
  );
end $$;

-- ───────── Permissões de execução ─────────
revoke all on function quote_price(int, double precision, double precision) from public, anon;
revoke all on function nearby_tankers(double precision, double precision, int) from public, anon;
revoke all on function create_order(int, text, double precision, double precision, payment_method, text) from public, anon;
revoke all on function accept_order(uuid) from public, anon;
revoke all on function decline_order(uuid) from public, anon;
revoke all on function advance_order(uuid) from public, anon;
revoke all on function cancel_order(uuid, text) from public, anon;
revoke all on function confirm_direct_payment(uuid) from public, anon;
revoke all on function set_driver_available(boolean) from public, anon;
revoke all on function update_driver_location(double precision, double precision) from public, anon;
revoke all on function get_order_driver_location(uuid) from public, anon;
revoke all on function admin_set_driver_status(uuid, driver_status) from public, anon;
revoke all on function admin_stats() from public, anon;
grant execute on function quote_price(int, double precision, double precision) to authenticated;
grant execute on function nearby_tankers(double precision, double precision, int) to authenticated;
grant execute on function create_order(int, text, double precision, double precision, payment_method, text) to authenticated;
grant execute on function accept_order(uuid) to authenticated;
grant execute on function decline_order(uuid) to authenticated;
grant execute on function advance_order(uuid) to authenticated;
grant execute on function cancel_order(uuid, text) to authenticated;
grant execute on function confirm_direct_payment(uuid) to authenticated;
grant execute on function set_driver_available(boolean) to authenticated;
grant execute on function update_driver_location(double precision, double precision) to authenticated;
grant execute on function get_order_driver_location(uuid) to authenticated;
grant execute on function admin_set_driver_status(uuid, driver_status) to authenticated;
grant execute on function admin_stats() to authenticated;

-- Tempo real para estado dos pedidos e notificações
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table notifications;
