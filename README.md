# MENA — plataforma on-demand de cisternas de água

PWA (React + TypeScript + Vite) com três ambientes — cliente (`/app`), motorista (`/driver`) e administração (`/admin`) — sobre Supabase (Postgres/PostGIS, Auth, Realtime).

## Estado (Fase 2 concluída)

Implementado: rotas e navegação dos três ambientes, registo/login/recuperação de palavra-passe, guardas por papel, perfil, notificações internas (tempo real), PWA instalável com estado offline, procura de cisternas próximas via GPS, aprovação/suspensão/rejeição de motoristas, indicadores reais do admin, disponibilidade e posição do motorista.

Ainda por implementar (Fase 3): fluxo de pedido completo (preço, escolha de cisterna, confirmação), recepção/aceitação de pedidos pelo motorista, acompanhamento no mapa, histórico detalhado e repetir pedido, moradas guardadas, ganhos, gestão de tarifas/zonas/cisternas/reclamações no admin.

## Configuração

1. Criar projecto em https://supabase.com.
2. No SQL Editor, executar por ordem: `supabase/migrations/0001_schema.sql` e `0002_security_and_logic.sql`.
3. Em Authentication → Providers → Email, manter a confirmação de e-mail activa. Em Authentication → URL Configuration, definir o Site URL e adicionar `<site>/nova-palavra-passe` aos Redirect URLs.
4. Copiar `.env.example` para `.env.local` e preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave anon/publishable). **Nunca** colocar a `service_role` no frontend.
5. Registar-se na app com `emirtnelumba@gmail.com`, confirmar o e-mail e executar `0003_bootstrap_admin.sql` no SQL Editor para promover essa conta a administrador. O papel admin nunca é atribuído automaticamente no registo.
6. Configurar uma tarifa antes de aceitar pedidos (Fase 3 traz o ecrã; até lá, inserir em `price_rules`). Sem tarifa, `create_order` recusa o pedido: não há preços por omissão.
7. `npm install && npm run dev`. Para publicar é obrigatório HTTPS (GPS e PWA).

## Segurança

- RLS activa em todas as tabelas. `profiles.role` não é editável pelo utilizador.
- Clientes e motoristas não escrevem em `orders`, `payments`, `order_events`: usam funções (`create_order`, `accept_order`, `advance_order`, `cancel_order`, …) que validam papel, dono e transição.
- O preço é calculado no servidor (`quote_price`), por litro, a partir de `price_rules`.
- Pagamento na aplicação está desactivado (`app_settings.in_app_payments_enabled = false`) até existir integração real; o servidor recusa pedidos com esse método.
- Pagamentos directos ficam `pending` até o motorista confirmar o recebimento.

## Limites conhecidos

- A posição do motorista só é enviada com a app aberta no ecrã (limite das PWAs). Tracking em segundo plano exigiria app nativa.
- Web Push, e-mail transaccional personalizado, mapas (MapLibre já instalado) e pagamentos pertencem à Fase 4.
