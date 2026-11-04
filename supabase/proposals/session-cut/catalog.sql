-- Somente leitura de metadados. Não consulta usuários, sessões ou dados de negócio.
-- Coletar/revisar no destino autorizado antes de promover candidate.sql.
begin read only;
select current_database() as database_name, current_user as execution_role, version();
select n.nspname, n.nspowner::regrole as owner, n.nspacl
from pg_namespace n where n.nspname in ('cali_workspace','cali_session_guard','auth','storage');
select c.oid::regclass as relation, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
  c.relowner::regrole as owner, c.relacl,
  a.attname, format_type(a.atttypid,a.atttypmod) as type, a.attnotnull
from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where c.oid in (to_regclass('auth.sessions'),to_regclass('cali_workspace.profiles'),
  to_regclass('cali_workspace.companies'),to_regclass('cali_workspace.client_invites'),
  to_regclass('cali_workspace.terms_acceptances'),to_regclass('storage.objects'))
order by c.oid::regclass::text,a.attnum;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='cali_workspace'
  and tablename in ('profiles','companies','client_invites','terms_acceptances'))
  or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;
select t.tgrelid::regclass as relation, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
from pg_trigger t where not t.tgisinternal
  and t.tgrelid in (to_regclass('cali_workspace.profiles'),to_regclass('cali_workspace.companies'))
order by t.tgrelid::regclass::text,t.tgname;
-- Funções DEFINER podem ignorar RLS; inventário deve incluir suas dependências.
select n.nspname, p.oid::regprocedure as routine, p.proowner::regrole as owner,
  p.prosecdef, p.proacl, p.proconfig, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('cali_workspace','public') and p.prokind in ('f','p')
  and (p.prosecdef or n.nspname='cali_workspace')
order by n.nspname,p.oid::regprocedure::text;
-- ACL bruta pode omitir PUBLIC ou herança. Conferir acesso efetivo e USAGE do schema.
select n.nspname, p.oid::regprocedure as routine, p.prosecdef, r.rolname,
  has_schema_privilege(r.oid,n.oid,'USAGE') as schema_usage,
  has_function_privilege(r.oid,p.oid,'EXECUTE') as routine_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
cross join pg_roles r
where n.nspname in ('cali_workspace','public')
  and p.prokind in ('f','p') and (p.prosecdef or n.nspname='cali_workspace')
  and r.rolname in ('anon','authenticated','service_role')
order by n.nspname,p.oid::regprocedure::text,r.rolname;
select schemaname,tablename,indexname,indexdef from pg_indexes
where (schemaname='auth' and tablename='sessions')
  or (schemaname='cali_workspace' and tablename in ('profiles','companies'))
order by schemaname,tablename,indexname;
select rolname,rolsuper,rolbypassrls,rolinherit from pg_roles
where rolname in ('postgres','anon','authenticated','service_role');
rollback;
