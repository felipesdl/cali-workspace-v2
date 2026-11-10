begin;
do $$
declare
  company constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  operator constant uuid := '00000000-0000-4000-8000-000000000014';
  opportunity uuid := gen_random_uuid();
  proposal uuid := gen_random_uuid();
  expected timestamptz := clock_timestamp();
  provider uuid := gen_random_uuid();
  token text := repeat('c',64);
  digest text := encode(sha256(convert_to(token,'UTF8')),'hex');
  pdf text := encode(convert_to('%PDF-1.7 synthetic fixture','UTF8'),'base64');
  job uuid;
  quote jsonb;
begin
  insert into public.cali_submissions(id,protocol,status,service_slug,updated_at,contact_email,answers)
  values(opportunity,'CALI-QA-V2-EMAIL','edicao','cali-build',expected,'qa-proposta-v2@example.invalid',
    '{"colaboradores":180,"pessoas_rh":1,"frentes":["a","b","c"],"escopo_build":"multiplas_frentes",
      "capacidade_execucao":"2a4","cadencia_build":"semanal","ponto_partida":"zero"}');
  insert into public.cali_proposals(id,submission_id,status,version,service_slug,total_value,package_code,updated_at)
  values(proposal,opportunity,'rascunho',1,'cali-build',1000,'ESSENCIAL',expected);
  insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id,operator_id,proposal_id,
    expires_at,pilot_package,pilot_price)
  values(company,opportunity,operator,proposal,now()+interval '1 hour','ESSENCIAL',1000);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,90,10,2);
    raise exception 'Calculou sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,90,10,2)=proposal;
  quote:=cali_workspace.v2_read_pilot_commercial_draft(company,proposal);
  assert quote#>>'{pricing,months}'='4' and (quote#>>'{pricing,subtotal}')::numeric=1550
    and (quote#>>'{pricing,monthly}')::numeric=1395;
  begin
    perform cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,95,12,4);
    raise exception 'Revisão antiga alterou o cálculo';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_save_pilot_commercial_draft(company,proposal,(quote->>'updatedAt')::timestamptz,
    'approve',null,null,null)=proposal;
  reset role;
  select updated_at into expected from public.cali_proposals where id=proposal;
  set local role authenticated;
  job:=(cali_workspace.v2_prepare_pilot_commercial_email(company,proposal,expected)->>'id')::uuid;
  assert cali_workspace.v2_prepare_pilot_commercial_email(company,proposal,expected)->>'id'=job::text;
  assert not has_function_privilege('authenticated','cali_workspace.v2_stage_pilot_commercial_email(uuid,text,text)','EXECUTE');
  assert not has_function_privilege('anon','cali_workspace.v2_prepare_pilot_commercial_email(uuid,uuid,timestamptz)','EXECUTE');
  reset role;
  set local role service_role;
  assert cali_workspace.v2_stage_pilot_commercial_email(job,pdf,digest)=pdf;
  assert cali_workspace.v2_stage_pilot_commercial_email(job,pdf,digest)=pdf;
  reset role;
  set local role anon;
  assert public.v2_external_pilot_commercial_offer(token,false) is null;
  reset role;
  set local role service_role;
  perform cali_workspace.v2_record_pilot_commercial_email(job,provider);
  perform cali_workspace.v2_record_pilot_commercial_email(job,provider);
  reset role;
  set local role anon;
  assert public.v2_external_pilot_commercial_offer(repeat('a',64),true) is null;
  assert public.v2_external_pilot_commercial_offer(token,false)->'acceptedAt'='null'::jsonb;
  assert public.v2_external_pilot_commercial_offer(token,true)->>'acceptedAt' is not null;
  assert public.v2_external_pilot_commercial_offer(token,true)->>'acceptedAt' is not null;
  reset role;
  assert exists(select 1 from public.cali_proposals where id=proposal and status='aceita'
    and total_value=1395 and resend_email_id=provider::text);
  assert (select count(*) from cali_workspace.activity_log where entity_id=proposal
    and event_type in ('commercial_proposal_delivered','commercial_proposal_accepted'))=2;
  update cali_session_guard.phase4_commercial_email set revoked_at=clock_timestamp() where id=job;
  set local role anon;
  assert public.v2_external_pilot_commercial_offer(token,false) is null;
end;
$$;
rollback;
\echo Fase 4: cálculo CALI Build, PDF persistido, envio deduplicado e aceite externo isolado.
