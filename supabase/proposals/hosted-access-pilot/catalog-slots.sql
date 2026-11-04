-- Inventário para reconciliar o limite de vagas. Sem linhas de clientes.
begin read only;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where (schemaname, tablename) in (
  ('cali_workspace', 'client_invites'),
  ('cali_session_guard', 'pilot_accounts'),
  ('cali_session_guard', 'pilot_reauthorizations')
) and indexdef like 'CREATE UNIQUE%'
order by 1, 2, 3;

select c.relname as relation, pg_get_triggerdef(t.oid) as trigger_definition,
  pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'cali_workspace'
  and c.relname in ('client_invites', 'profiles')
  and not t.tgisinternal
order by c.relname, t.tgname;

commit;
