-- Executar somente em PostgreSQL vazio e descartável.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema auth, cali_workspace, cali_session_guard to authenticated, service_role;
grant usage on schema cali_workspace to anon;

create function auth.jwt() returns jsonb language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb; $$;
create function auth.uid() returns uuid language sql stable
as $$ select (auth.jwt() ->> 'sub')::uuid; $$;
create table auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz);
create function cali_session_guard.session_is_live() returns boolean language sql stable
as $$ select coalesce((auth.jwt() ->> 'pilot_live')::boolean, true); $$;
create function cali_workspace.is_admin() returns boolean language sql stable
as $$ select (auth.jwt() ->> 'admin')::boolean is true; $$;

create table cali_workspace.notifications (id uuid primary key, user_id uuid not null, read_at timestamptz);
alter table cali_workspace.notifications enable row level security;
grant select, update on cali_workspace.notifications to authenticated, service_role;
create policy notifications_self_select on cali_workspace.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_admin_all on cali_workspace.notifications for all to authenticated
  using (cali_workspace.is_admin()) with check (cali_workspace.is_admin());

\ir rollback-session-guard.sql
revoke all on function cali_workspace.mark_notification_read(uuid),
  cali_workspace.mark_all_notifications_read() from public;
grant execute on function cali_workspace.mark_notification_read(uuid),
  cali_workspace.mark_all_notifications_read() to authenticated, service_role;

insert into auth.sessions values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',null),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',now()-interval '1 second');
insert into cali_workspace.notifications values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',null),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',null);

\ir session-guard.sql

set role authenticated;
do $$
declare
  own uuid := '30000000-0000-4000-8000-000000000001';
  other uuid := '30000000-0000-4000-8000-000000000003';
  first_read timestamptz;
  claims jsonb := '{"sub":"10000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001"}';
  rejected jsonb;
begin
  perform set_config('request.jwt.claims', claims::text, true);
  assert (select count(*) from cali_workspace.notifications) = 2, 'Cliente lê somente próprias';
  update cali_workspace.notifications set read_at = now();
  assert not found, 'Cliente não ganha UPDATE direto';
  perform cali_workspace.mark_notification_read(other);
  perform cali_workspace.mark_notification_read(own);
  select read_at into first_read from cali_workspace.notifications where id = own;
  assert first_read is not null, 'marca própria individual';
  perform cali_workspace.mark_all_notifications_read();
  assert (select count(*) from cali_workspace.notifications where read_at is not null) = 2, 'marca próprias em lote';
  assert (select read_at from cali_workspace.notifications where id = own) = first_read, 'preserva primeira leitura';

  foreach rejected in array array[
    claims - 'session_id',
    claims || '{"session_id":"20000000-0000-4000-8000-000000000002"}',
    claims || '{"session_id":"20000000-0000-4000-8000-000000000003"}',
    claims || '{"pilot_live":false}',
    claims || '{"session_id":"inválida"}'
  ] loop
    perform set_config('request.jwt.claims', rejected::text, true);
    assert not exists (select from cali_workspace.notifications), 'RLS nega sessão inválida';
    begin
      perform cali_workspace.mark_notification_read(own);
      raise exception 'RPC individual aceitou sessão inválida';
    exception when insufficient_privilege then null;
    end;
    begin
      perform cali_workspace.mark_all_notifications_read();
      raise exception 'RPC em lote aceitou sessão inválida';
    exception when insufficient_privilege then null;
    end;
  end loop;

  perform set_config('request.jwt.claims', (claims || '{"admin":true}')::text, true);
  assert (select count(*) from cali_workspace.notifications) = 3, 'preserva policy Admin';
  perform cali_workspace.mark_notification_read(other);
  assert (select read_at from cali_workspace.notifications where id = other) is null, 'RPC Admin também só própria';
  update cali_workspace.notifications set read_at = now() where id = other;
  assert found, 'preserva UPDATE direto Admin com sessão válida';
end;
$$;
reset role;

delete from auth.sessions where id = '20000000-0000-4000-8000-000000000001';
set role authenticated;
set request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001","admin":true}';
do $$
begin
  assert not exists (select from cali_workspace.notifications), 'Admin com sessão removida não lê';
  update cali_workspace.notifications set read_at = null;
  assert not found, 'Admin com sessão removida não atualiza';
end;
$$;
reset role;

set role service_role;
do $$
begin
  assert (select count(*) from cali_workspace.notifications where read_at is not null) = 3;
  assert not has_function_privilege('anon','cali_workspace.mark_notification_read(uuid)','EXECUTE');
  assert not has_function_privilege('anon','cali_workspace.mark_all_notifications_read()','EXECUTE');
end;
$$;
reset role;

\ir rollback-session-guard.sql
set role authenticated;
do $$
begin
  assert (select count(*) from cali_workspace.notifications where read_at is not null) = 3,
    'rollback restaura políticas e preserva leituras';
end;
$$;
reset role;
\ir session-guard.sql
select 'Guarda, rollback e reaplicação validados em base descartável.' as resultado;
