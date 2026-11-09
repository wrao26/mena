-- MENA — primeiro administrador. EXECUTAR MANUALMENTE, uma única vez, no SQL Editor do Supabase.
--
-- Passos:
--   1. Na app, registe-se normalmente como cliente com o e-mail abaixo (e confirme o e-mail, se a confirmação estiver activa).
--   2. Execute este script. Promove essa conta a administrador.
--
-- Por segurança, o papel 'admin' nunca é atribuído automaticamente no registo:
-- se fosse, qualquer pessoa que se registasse primeiro com este e-mail ficaria administradora.

update profiles
set role = 'admin', full_name = case when full_name = '' then 'Emir Nelumba' else full_name end
where id = (select id from auth.users where email = 'emirtnelumba@gmail.com' and email_confirmed_at is not null);

-- Deve devolver 1 linha. Se devolver 0, a conta ainda não existe ou o e-mail não foi confirmado.
select id, email, role from profiles where email = 'emirtnelumba@gmail.com';
