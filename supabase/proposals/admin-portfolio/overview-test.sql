-- Executar apenas em PostgreSQL vazio e descartável.
\ir test.sql

alter table cali_workspace.companies add column display_name text default 'Conta sintética', add column monthly_hours_contracted numeric default 10;
alter table cali_workspace.projects add column id uuid default gen_random_uuid(), add column name text default 'Projeto', add column updated_at timestamptz default now();
alter table cali_workspace.account_records add column id uuid default gen_random_uuid(), add column title text default 'Ocorrência', add column updated_at timestamptz default now();
alter table cali_workspace.events add column id uuid default gen_random_uuid(), add column title text default 'Reunião', add column company_id uuid;
create table cali_workspace.service_cycles(id uuid default gen_random_uuid(), company_id uuid, contracted_hours numeric, reference_month date, created_at timestamptz default now());
create table cali_workspace.deliverables(id uuid default gen_random_uuid(), company_id uuid, project_id uuid, title text, status text, due_at timestamptz);
create table cali_workspace.account_record_feedback(company_id uuid, record_id uuid, score integer);
create table cali_workspace.nps_responses(company_id uuid, score integer);

insert into cali_workspace.service_cycles(company_id, contracted_hours, reference_month) values
  ('10000000-0000-4000-8000-000000000001', 12, '2026-11-01');
insert into cali_workspace.events(company_id, starts_at) values
  ('10000000-0000-4000-8000-000000000001', now() + interval '1 day'),
  ('10000000-0000-4000-8000-000000000002', now() + interval '1 day'),
  ('10000000-0000-4000-8000-000000000001', now() + interval '16 days');
insert into cali_workspace.deliverables(company_id, title, status, due_at) values
  ('10000000-0000-4000-8000-000000000001', 'Entrega', 'in_progress', now() + interval '1 day'),
  ('10000000-0000-4000-8000-000000000002', 'Outra entrega', 'approved', now() + interval '1 day');
insert into cali_workspace.nps_responses values
  ('10000000-0000-4000-8000-000000000001', 4),
  ('10000000-0000-4000-8000-000000000002', 2);

\ir overview.sql

set role authenticated;
do $$
declare
  a uuid := '10000000-0000-4000-8000-000000000001';
  b uuid := '10000000-0000-4000-8000-000000000002';
  claims jsonb := jsonb_build_object('sub', a, 'live', true, 'accepted', true);
  rejected jsonb;
  result jsonb;
begin
  perform set_config('request.jwt.claims', claims::text, true);
  result := cali_workspace.v2_read_admin_overview(null, '2026-11-01');
  assert (result ->> 'hoursMinutes')::int = 60;
  assert (result ->> 'pendingActions')::int = 3;
  assert (result #>> '{satisfaction,average}')::numeric = 3;
  assert jsonb_array_length(result -> 'agenda') = 2;
  result := cali_workspace.v2_read_admin_overview(a, '2026-11-01');
  assert (result ->> 'hoursMinutes')::int = 15;
  assert (result ->> 'contractedMinutes')::int = 720;
  assert (result #>> '{satisfaction,average}')::numeric = 4;
  assert (result #>> '{satisfaction,distribution,3,total}')::int = 1;
  assert jsonb_array_length(result -> 'agenda') = 1;
  assert (result #>> '{agenda,0,companyId}')::uuid = a;
  assert jsonb_array_length(result -> 'deadlines') = 1;
  result := cali_workspace.v2_read_admin_overview(a, '2026-10-01');
  assert (result ->> 'hoursMinutes')::int = 100;
  assert jsonb_array_length(result -> 'agenda') = 1;

  foreach rejected in array array[claims || '{"live":false}', claims || '{"accepted":false}', claims || jsonb_build_object('sub', b)] loop
    perform set_config('request.jwt.claims', rejected::text, true);
    begin
      perform cali_workspace.v2_read_admin_overview(null, '2026-11-01');
      raise exception 'Consulta indevida aceita';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
reset role;

do $$
begin
  assert not has_function_privilege('anon', 'cali_workspace.v2_read_admin_overview(uuid,date)', 'EXECUTE');
  assert not has_function_privilege('service_role', 'cali_workspace.v2_read_admin_overview(uuid,date)', 'EXECUTE');
end;
$$;

\ir overview-rollback.sql
do $$
begin
  assert to_regprocedure('cali_workspace.v2_read_admin_overview(uuid,date)') is null;
  assert (select count(*) from cali_workspace.deliverables) = 2;
end;
$$;
