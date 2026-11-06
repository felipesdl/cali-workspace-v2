begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  admin constant uuid := '00000000-0000-4000-8000-000000000014';
  mapped uuid := gen_random_uuid();
  unmapped uuid := gen_random_uuid();
  empty_opportunity uuid := gen_random_uuid();
  item uuid := gen_random_uuid();
  payload jsonb;
begin
  insert into public.cali_submissions(id,protocol,status,service_slug,updated_at,contact_email,internal_notes)
  values(mapped,'PORTAL-QA-01','negociacao','cali-full',now(),'contato@example.invalid','NOTA RESERVADA'),
    (unmapped,'PORTAL-FORA-PILOTO','novo','cali-full',now(),null,null),
    (empty_opportunity,'PORTAL-SEM-PROPOSTA','novo','cali-full',now(),null,null);
  insert into public.cali_proposals(id,submission_id,status,version,total_value,package_code,updated_at,pdf_path,calculator_data)
  values(gen_random_uuid(),mapped,'aceita',1,1234.56,'full','2026-10-10','CAMINHO RESERVADO','{"internal":"BASE PRIVADA"}'),
    (gen_random_uuid(),mapped,'rascunho',2,1720.00,'full','2026-10-11',null,null),
    (gen_random_uuid(),unmapped,'rascunho',1,300,'full',now(),null,null);
  insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id)
  values(a,mapped),(a,empty_opportunity);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at)
  values(a,admin,'report_released_in_app','report',item,'{"version":2,"privateNote":"NOTA RESERVADA"}','2026-11-01 02:00Z'),
    (a,admin,'report_pdf_generated','report',item,'{"version":2,"sha256":"HASH RESERVADO"}','2026-11-01 03:00Z'),
    (b,admin,'record_open','account_record',gen_random_uuid(),'{}','2026-11-02 11:00Z'),
    (a,admin,'unknown_internal_event','report',item,'{}','2026-11-02 11:00Z');
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_audit(a,'2026-10-01',1);
    raise exception 'Cliente leu a auditoria';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_read_pilot_commercial(a,1);
    raise exception 'Cliente leu propostas';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_commercial(a,1);
    raise exception 'Admin sem MFA leu propostas';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  payload := cali_workspace.v2_read_pilot_audit(a,'2026-10-01',1);
  assert payload->>'total'='1';
  assert payload#>>'{entries,0,event}'='report_released_in_app';
  assert payload#>>'{entries,0,revision}'='2';
  assert payload#>>'{entries,0,actorName}'='Pessoa sintética';
  assert payload::text not like '%RESERVADA%';
  payload := cali_workspace.v2_read_pilot_audit(a,'2026-11-01',1);
  assert payload->>'total'='1';
  assert payload#>>'{entries,0,event}'='report_pdf_generated';
  assert payload::text not like '%RESERVADO%';

  payload := cali_workspace.v2_read_pilot_commercial(a,1);
  assert payload->>'total'='3';
  assert exists(select 1 from jsonb_array_elements(payload->'entries') e
    where e->>'proposalStatus'='aceita' and (e->>'total')::numeric=1234.56 and e->>'version'='1');
  assert exists(select 1 from jsonb_array_elements(payload->'entries') e
    where e->>'protocol'='PORTAL-SEM-PROPOSTA' and e->'proposalId'='null');
  assert payload::text not like '%FORA-PILOTO%' and payload::text not like '%example.invalid%'
    and payload::text not like '%RESERVAD%' and payload::text not like '%BASE PRIVADA%';
  assert cali_workspace.v2_read_pilot_commercial(a,2)->'entries'='[]'::jsonb;
  assert cali_workspace.v2_read_pilot_commercial(b,1)->>'total'='0';
  begin
    perform 1 from cali_session_guard.phase4_commercial_scope;
    raise exception 'Tabela de escopo exposta';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo Fase 4: auditoria minimizada e leitura de propostas vinculadas validadas no piloto descartável.
