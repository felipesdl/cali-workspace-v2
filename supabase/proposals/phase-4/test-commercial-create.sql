begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  admin constant uuid := '00000000-0000-4000-8000-000000000014';
  opportunity uuid := gen_random_uuid();
  other_opportunity uuid := gen_random_uuid();
  proposal uuid;
begin
  insert into public.cali_submissions(id,protocol,status,service_slug,updated_at,contact_email)
  values(opportunity,'CALI-QA-V2-CREATE','edicao','cali-build',now(),'qa@example.invalid'),
    (other_opportunity,'PORTAL-OUTRO','edicao','cali-build',now(),'qa@example.invalid');
  insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id,operator_id,expires_at,pilot_package,pilot_price)
  values(a,opportunity,admin,now()+interval '1 hour','build_essential',175.50),
    (a,other_opportunity,admin,now()+interval '1 hour','build_essential',175.50);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_create_pilot_commercial_draft(a,opportunity);
    raise exception 'Criação sem MFA autorizada';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_create_pilot_commercial_draft(b,opportunity);
    raise exception 'Criação em outra empresa autorizada';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_create_pilot_commercial_draft(a,other_opportunity);
    raise exception 'Criação em oportunidade sem marcador sintético autorizada';
  exception when insufficient_privilege then null; end;
  assert exists(select 1 from jsonb_array_elements(cali_workspace.v2_read_pilot_commercial(a,1)->'entries') e
    where e->>'opportunityId'=opportunity::text and (e->>'canCreate')::boolean);
  proposal := cali_workspace.v2_create_pilot_commercial_draft(a,opportunity);
  assert cali_workspace.v2_create_pilot_commercial_draft(a,opportunity)=proposal;
  assert cali_workspace.v2_read_pilot_commercial_draft(a,proposal)->>'id'=proposal::text;
  reset role;
  assert (select count(*) from public.cali_proposals where submission_id=opportunity)=1;
  assert exists(select 1 from public.cali_proposals where id=proposal and status='rascunho'
    and version=1 and total_value=175.50 and package_code='build_essential');
  assert (select count(*) from cali_workspace.activity_log where entity_id=proposal
    and event_type='commercial_proposal_created')=1;
end $$;
rollback;
\echo Fase 4: rascunho criado uma vez, com preço sintético e escopo conferidos.
