\set cali_skip_pilot_pause 1
\ir ../hosted-access-pilot/test.sql
\unset cali_skip_pilot_pause
\ir ../hosted-access-pilot/individual-invites.sql
alter table cali_workspace.companies
  add column start_date date, add column end_date date, add column contract_type text,
  add column contract_model text, add column auto_renew boolean default false,
  add column contract_penalty_enabled boolean default false,
  add column termination_penalty_type text default 'none',
  add column termination_penalty_value numeric(14,4) default 0,
  add column termination_payment_days smallint default 0,
  add column termination_payment_rule text default 'calendar_days',
  add column contract_penalty_text text, add column contract_value numeric,
  add column billing_frequency text, add column payment_method text,
  add column billing_due_rule text default 'fixed_day', add column billing_day integer,
  add column billing_lead_days smallint default 3, add column payment_term_days smallint,
  add column late_fee_percent numeric(8,4) default 0, add column daily_interest_percent numeric(8,6) default 0,
  add column payment_notes text, add column drive_folder_url text,
  add column document_owner text, add column document_notes text;
create function cali_workspace.fixture_company_touch()
returns trigger language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger fixture_company_touch before update on cali_workspace.companies
for each row execute function cali_workspace.fixture_company_touch();
\ir update-pilot-contract.sql

do $$
declare
  company constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  expected timestamptz;
  payload constant jsonb := '{"start_date":"2026-11-01","end_date":"2026-12-01","contract_type":"Outro",
    "contract_model":"Projeto","auto_renew":false,"contract_penalty_enabled":false,
    "termination_penalty_type":"none","termination_penalty_value":0,"termination_payment_days":0,
    "termination_payment_rule":"calendar_days","contract_penalty_text":"","contract_value":125.5,
    "billing_frequency":"single","payment_method":"pix","billing_due_rule":"fixed_day","billing_day":10,
    "billing_lead_days":3,"payment_term_days":10,"late_fee_percent":0,"daily_interest_percent":0,
    "payment_notes":"","drive_folder_url":"","document_owner":"","document_notes":"Homologação"}';
begin
  select updated_at into strict expected from cali_workspace.companies where id = company;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_update_pilot_company_contract(company,expected,payload);
    raise exception 'Cliente editou a ficha';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  begin
    perform cali_workspace.v2_update_pilot_company_contract(company,expected,payload||'{"status":"closed"}');
    raise exception 'Campo fora do contrato foi aceito';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_update_pilot_company_contract(company,expected,payload);
  begin
    perform cali_workspace.v2_update_pilot_company_contract(company,expected,payload);
    raise exception 'Preimagem obsoleta foi aceita';
  exception when serialization_failure then null;
  end;
  reset role;
  if not exists (select 1 from cali_workspace.companies where id=company and status='active'
      and contract_value=125.5 and payment_method='pix' and document_notes='Homologação')
    or (select count(*) from cali_workspace.activity_log where entity_id=company
      and event_type='v2_company_contract_updated') <> 1 then
    raise exception 'Condições ou auditoria não confirmadas';
  end if;
end;
$$;
