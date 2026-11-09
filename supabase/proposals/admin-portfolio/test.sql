-- Executar apenas em PostgreSQL vazio e descartável.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to authenticated;

create function auth.uid() returns uuid language sql stable as $$
  select (current_setting('request.jwt.claims',true)::jsonb ->> 'sub')::uuid;
$$;
create function cali_session_guard.require_pilot_admin_session() returns uuid language plpgsql stable as $$
begin
  if (current_setting('request.jwt.claims',true)::jsonb ->> 'live') is distinct from 'true' then
    raise exception using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable as $$
  select jsonb_build_object('accepted', current_setting('request.jwt.claims',true)::jsonb -> 'accepted');
$$;
create function cali_workspace.get_admin_satisfaction_overview() returns jsonb language sql stable as $$
  select jsonb_build_object('average', 4.5, 'total', 2, 'recent', array['detalhe fora da projeção']);
$$;

create table cali_workspace.profiles(id uuid,active boolean,role text);
create table cali_workspace.companies(id uuid,status text);
create table cali_workspace.hour_entries(company_id uuid,minutes int,work_date date);
create table cali_workspace.events(starts_at timestamptz,ends_at timestamptz,cancelled_at timestamptz);
create table cali_workspace.notices(id uuid,status text,notice_date date,audience text,end_date date);
create table cali_workspace.notice_targets(notice_id uuid,company_id uuid);
create table cali_workspace.projects(company_id uuid,planning_status text,execution_status text);
create table cali_workspace.account_records(company_id uuid,workflow_status text);

do $$
declare
  a uuid := '10000000-0000-4000-8000-000000000001';
  b uuid := '10000000-0000-4000-8000-000000000002';
  inactive uuid := '10000000-0000-4000-8000-000000000003';
  general_notice uuid := gen_random_uuid();
  targeted_notice uuid := gen_random_uuid();
begin
  insert into cali_workspace.profiles values (a,true,'admin'),(b,true,'client');
  insert into cali_workspace.companies values (a,'active'),(b,'paused'),(inactive,'closed');
  insert into cali_workspace.hour_entries values
    (a,15,'2026-11-01'),(b,42,'2026-11-30'),(inactive,3,'2026-11-02'),
    (a,100,'2026-10-31'),(b,100,'2026-12-01');
  insert into cali_workspace.events values
    ('2026-11-01 02:00Z','2026-11-01 03:01Z',null),
    ('2026-12-01 02:59Z','2026-12-01 03:30Z',null),
    ('2026-12-01 03:00Z','2026-12-01 04:00Z',null),
    ('2026-11-01 03:00Z','2026-11-01 04:00Z',now());
  insert into cali_workspace.notices (id,status,notice_date,audience) values
    (general_notice,'published','2026-11-01','all'),
    (targeted_notice,'published','2026-11-30','selected'),
    (gen_random_uuid(),'published','2026-11-02','selected'),
    (gen_random_uuid(),'archived','2026-11-02','all');
  insert into cali_workspace.notice_targets values (targeted_notice,a),(targeted_notice,b);
  insert into cali_workspace.projects values
    (a,'adjustment_requested','normal'),(b,'adjustment_requested','normal'),
    (inactive,'adjustment_requested','normal'),(a,'adjustment_requested','suspended');
  insert into cali_workspace.account_records values
    (b,'in_progress'),(inactive,'in_progress'),(a,'waiting_client');
end;
$$;

\ir read.sql

set role authenticated;
do $$
declare
  claims jsonb := '{"sub":"10000000-0000-4000-8000-000000000001","live":true,"accepted":true}';
  rejected jsonb;
  result jsonb;
begin
  perform set_config('request.jwt.claims',claims::text,true);
  result := cali_workspace.v2_read_admin_portfolio('2026-11-01');
  assert result = '{"month":"2026-11-01","hoursMinutes":60,"calendarEvents":2,"calendarNotices":2,"projectAdjustments":2,"recordsInProgress":1,"satisfactionAverage":4.5,"satisfactionCount":2}';
  assert (cali_workspace.v2_read_admin_portfolio('2026-10-01')->>'hoursMinutes')::int = 100;
  begin
    perform cali_workspace.v2_read_admin_portfolio('2026-11-02');
    raise exception 'Mês inválido aceito';
  exception when invalid_parameter_value then null;
  end;

  foreach rejected in array array[
    claims || '{"live":false}',
    claims || '{"accepted":false}',
    claims || '{"sub":"10000000-0000-4000-8000-000000000002"}'
  ] loop
    perform set_config('request.jwt.claims',rejected::text,true);
    begin
      perform cali_workspace.v2_read_admin_portfolio('2026-11-01');
      raise exception 'Consulta indevida aceita';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
reset role;

do $$
begin
  assert not has_function_privilege('anon','cali_workspace.v2_read_admin_portfolio(date)','EXECUTE');
  assert not has_function_privilege('service_role','cali_workspace.v2_read_admin_portfolio(date)','EXECUTE');
end;
$$;
\ir rollback.sql
do $$
begin
  assert to_regprocedure('cali_workspace.v2_read_admin_portfolio(date)') is null;
  assert (select count(*) from cali_workspace.hour_entries) = 5;
end;
$$;
select 'Agregados, limites do mês, acesso e rollback validados.' as resultado;
