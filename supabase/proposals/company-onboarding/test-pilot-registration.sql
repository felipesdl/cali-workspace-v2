\set cali_skip_pilot_pause 1
\ir ../hosted-access-pilot/test.sql
\unset cali_skip_pilot_pause
\ir ../hosted-access-pilot/individual-invites.sql
alter table cali_workspace.companies
  add column segment text, add column address_street text, add column address_number text,
  add column address_neighborhood text, add column address_city text, add column address_state text,
  add column has_branches boolean default false, add column branches jsonb default '[]';
create function cali_workspace.fixture_company_touch()
returns trigger language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger fixture_company_touch before update on cali_workspace.companies
for each row execute function cali_workspace.fixture_company_touch();
\ir update-pilot-registration.sql

do $$
declare
  company constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  expected timestamptz;
  payload constant jsonb := '{"segment":"QA","monthly_hours_contracted":12.25,"address_street":"",
    "address_number":"","address_neighborhood":"","address_city":"Curitiba","address_state":"PR",
    "branches":["Filial de teste"],"has_branches":true}';
begin
  select updated_at into strict expected from cali_workspace.companies where id = company;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_update_pilot_company_registration(company, expected, payload);
    raise exception 'Cliente conseguiu editar cadastro';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  perform cali_workspace.v2_update_pilot_company_registration(company, expected, payload);
  begin
    perform cali_workspace.v2_update_pilot_company_registration(company, expected, payload);
    raise exception 'Preimagem obsoleta foi aceita';
  exception when serialization_failure then null;
  end;
  reset role;
  if not exists (select 1 from cali_workspace.companies where id = company and segment='QA'
      and monthly_hours_contracted=12.25 and has_branches and branches='["Filial de teste"]')
    or (select count(*) from cali_workspace.activity_log where entity_id=company
      and event_type='v2_company_registration_updated') <> 1 then
    raise exception 'Cadastro ou trilha não confirmados';
  end if;
end;
$$;
