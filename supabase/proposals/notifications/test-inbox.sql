-- Executar em PostgreSQL vazio e descartável, junto do ensaio da guarda.
\ir test-session-guard.sql

create table cali_workspace.profiles (id uuid primary key, role text, active boolean, company_id uuid);
insert into cali_workspace.profiles values
  ('10000000-0000-4000-8000-000000000001', 'admin', true, null),
  ('10000000-0000-4000-8000-000000000002', 'client', true, '40000000-0000-4000-8000-000000000002');
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable as $$
  select jsonb_build_object('accepted', (auth.jwt() ->> 'terms')::boolean);
$$;
alter table cali_workspace.notifications
  add column title text not null default 'Notificação sintética',
  add column body text,
  add column created_at timestamptz not null default now(),
  add column company_id uuid,
  add column entity_type text,
  add column entity_id uuid,
  add column action_url text default 'https://example.invalid/';
truncate cali_workspace.notifications;
insert into auth.sessions values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null);
insert into cali_workspace.notifications (id,user_id,company_id)
select gen_random_uuid(), '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002'
from generate_series(1,26);
insert into cali_workspace.notifications (id,user_id,company_id) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001');

\ir inbox.sql

set role authenticated;
do $$
declare
  claims jsonb := '{"sub":"10000000-0000-4000-8000-000000000002","session_id":"20000000-0000-4000-8000-000000000002","terms":true}';
  inbox jsonb;
  target uuid;
  rejected jsonb;
begin
  perform set_config('request.jwt.claims', claims::text, true);
  inbox := cali_workspace.v2_list_my_notifications();
  assert (inbox->>'unread')::int = 26, 'total próprio da empresa corrente';
  assert jsonb_array_length(inbox->'entries') = 25, 'página limitada';
  assert not ((inbox->'entries'->0) ? 'action_url'), 'URL legada não é projetada';
  target := (inbox->'entries'->0->>'id')::uuid;
  assert cali_workspace.v2_mark_my_notifications_read('30000000-0000-4000-8000-000000000001') = 0;
  assert cali_workspace.v2_mark_my_notifications_read('30000000-0000-4000-8000-000000000002') = 0;
  assert cali_workspace.v2_mark_my_notifications_read(target) = 1;
  assert cali_workspace.v2_mark_my_notifications_read(target) = 0;
  assert cali_workspace.v2_mark_my_notifications_read(null) = 25;
  assert (cali_workspace.v2_list_my_notifications()->>'unread')::int = 0;

  foreach rejected in array array[claims || '{"terms":false}', claims || '{"pilot_live":false}', claims - 'session_id'] loop
    perform set_config('request.jwt.claims', rejected::text, true);
    begin
      perform cali_workspace.v2_list_my_notifications();
      raise exception 'Consulta aceitou sessão ou termos inválidos';
    exception when insufficient_privilege then null;
    end;
    begin
      perform cali_workspace.v2_mark_my_notifications_read(null);
      raise exception 'Marcação aceitou sessão ou termos inválidos';
    exception when insufficient_privilege then null;
    end;
  end loop;

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001","terms":true,"admin":true}', true);
  assert (cali_workspace.v2_list_my_notifications()->>'unread')::int = 1, 'Admin lê apenas próprias pela nova RPC';
  assert cali_workspace.v2_mark_my_notifications_read(null) = 1;
end;
$$;
reset role;

do $$
begin
  assert not has_function_privilege('anon','cali_workspace.v2_list_my_notifications()','EXECUTE');
  assert not has_function_privilege('service_role','cali_workspace.v2_mark_my_notifications_read(uuid)','EXECUTE');
  assert (select count(*) from cali_workspace.notifications where read_at is null) = 1;
end;
$$;
\ir rollback-inbox.sql
do $$
begin
  assert to_regprocedure('cali_workspace.v2_list_my_notifications()') is null;
  assert to_regprocedure('cali_session_guard.notification_session_is_live()') is not null;
  assert (select count(*) from cali_workspace.notifications where read_at is not null) = 27;
end;
$$;
select 'Caixa, marcação, escopo, aceite e rollback validados.' as resultado;
