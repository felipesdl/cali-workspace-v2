\ir test-pilot-contract.sql
alter table cali_workspace.companies
  add column service_type text, add column service_plan text, add column logo_url text,
  add column meeting_sessions_included_per_month integer, add column meeting_cadence_days integer,
  add column onsite_visits_included_per_month integer, add column fixed_meeting_required boolean,
  add column meeting_mode_policy text;
\ir update-pilot-brand.sql

do $$
declare
  company constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  path constant text := company::text || '/brand/logo-00000000-0000-4000-8000-000000000001.png';
  expected timestamptz;
  result jsonb;
  payload constant jsonb := '{"name":"Contato sintético","title":"Operações","email":"","phone":"","whatsapp":"","birthday":null}';
begin
  insert into storage.objects (bucket_id, name) values ('cali-workspace-private', path);
  select updated_at into strict expected from cali_workspace.companies where id=company;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_read_pilot_company_brand(company);
    raise exception 'Cliente leu o contato privado';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  begin
    perform cali_workspace.v2_update_pilot_company_brand(company, expected, 'CALI Full', payload, 'replace',
      replace(path, company::text, '00000000-0000-4000-8000-000000000003'));
    raise exception 'Logo de outra empresa aceita';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_update_pilot_company_brand(company, expected, 'CALI Full', payload, 'replace', path);
  result := cali_workspace.v2_read_pilot_company_brand(company);
  if result->>'plan' <> 'full' or result->'contact'->>'name' <> 'Contato sintético'
    or result->>'hasLogo' <> 'true' then
    raise exception 'Cadastro não confirmado';
  end if;
  begin
    perform cali_workspace.v2_update_pilot_company_brand(company, expected, null, payload, 'remove', null);
    raise exception 'Revisão obsoleta aceita';
  exception when serialization_failure then null;
  end;
  reset role;
  if not exists (select 1 from cali_workspace.companies where id=company and logo_url='private:'||path
    and meeting_sessions_included_per_month=2 and meeting_cadence_days=14
    and onsite_visits_included_per_month=1 and fixed_meeting_required)
    or (select count(*) from cali_workspace.activity_log where entity_id=company
      and event_type='v2_company_brand_updated') <> 1 then
    raise exception 'Plano, logo ou auditoria não confirmados';
  end if;
end;
$$;
