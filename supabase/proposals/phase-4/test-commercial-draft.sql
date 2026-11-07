begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  opportunity uuid := gen_random_uuid();
  proposal uuid := gen_random_uuid();
  other_version uuid := gen_random_uuid();
  admin constant uuid := '00000000-0000-4000-8000-000000000014';
  other_admin constant uuid := '00000000-0000-4000-8000-000000000016';
  initial timestamptz := '2026-11-01 12:00Z';
  current_version timestamptz;
begin
  insert into cali_workspace.profiles(id,role,active) values(other_admin,'admin',true);
  insert into public.cali_submissions(id,status,protocol,service_slug,updated_at)
  values(opportunity,'negociacao','PORTAL-TESTE','full',initial);
  insert into public.cali_proposals(id,submission_id,status,version,total_value,package_code,updated_at)
  values(proposal,opportunity,'rascunho',2,1234.56,'full',initial),
    (other_version,opportunity,'rascunho',3,500,'full',initial);
  insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id,operator_id,proposal_id,expires_at)
  values(a,opportunity,admin,proposal,statement_timestamp()-interval '1 minute');
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform set_config('cali.qa_portal_access','no',true);
  assert not exists(select 1 from public.cali_proposals where id=proposal);
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,proposal,initial,'edit','À vista',null,25);
    raise exception 'Admin com delegação expirada conseguiu editar';
  exception when insufficient_privilege then null; end;
  reset role;
  update cali_session_guard.phase4_commercial_scope set expires_at=statement_timestamp()+interval '1 hour'
    where submission_id=opportunity;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',other_admin,'aal','aal2')::text,true);
  assert cali_workspace.v2_read_pilot_commercial(a,1)->>'total'='0';
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,proposal,initial,'approve',null,null,null);
    raise exception 'Outro Admin conseguiu aprovar';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,proposal,initial,'approve',null,null,null);
    raise exception 'Admin sem MFA conseguiu aprovar';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(b,proposal,initial,'approve',null,null,null);
    raise exception 'Empresa diferente conseguiu aprovar';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_read_pilot_commercial_draft(a,other_version);
    raise exception 'Outra versão ficou visível';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,other_version,initial,'approve',null,null,null);
    raise exception 'Outra versão conseguiu ser aprovada';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_save_pilot_commercial_draft(a,proposal,initial,'edit','À vista','Texto novo',25)=proposal;
  current_version := (cali_workspace.v2_read_pilot_commercial_draft(a,proposal)->>'updatedAt')::timestamptz;
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,proposal,initial,'approve',null,null,null);
    raise exception 'Aprovação com rascunho obsoleto';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_save_pilot_commercial_draft(a,proposal,current_version,'approve',null,null,null)=proposal;
  assert cali_workspace.v2_read_pilot_commercial_draft(a,proposal) is null;
  begin
    perform cali_workspace.v2_save_pilot_commercial_draft(a,proposal,current_version,'edit','Outro preço',null,25);
    raise exception 'Versão aprovada editada';
  exception when serialization_failure then null; end;
  reset role;
  assert exists(select 1 from public.cali_proposals p where p.id=proposal and p.total_value=1234.56
    and p.version=2 and p.status='aprovada' and p.payment_terms='À vista' and p.validity_days=25);
  assert (select status from public.cali_submissions where id=opportunity)='negociacao';
  assert (select count(*) from cali_workspace.activity_log where entity_id=proposal)=2;
end $$;
rollback;
\echo Fase 4: edição e aprovação validadas com delegação, MFA, expiração e concorrência.
