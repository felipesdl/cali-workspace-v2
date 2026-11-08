begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  admin constant uuid := '00000000-0000-4000-8000-000000000014';
  recipient constant uuid := '00000000-0000-4000-8000-000000000011';
  opportunity uuid := gen_random_uuid();
  proposal uuid := gen_random_uuid();
  approved timestamptz := clock_timestamp();
  original_deadline timestamptz;
  offers jsonb;
begin
  insert into public.cali_submissions(id,protocol,status,service_slug,updated_at,contact_email)
  values(opportunity,'CALI-QA-V2-DELIVERY','edicao','cali-build',approved,'qa@example.invalid');
  insert into public.cali_proposals(id,submission_id,status,version,total_value,package_code,updated_at,payment_terms)
  values(proposal,opportunity,'aprovada',1,175.50,'build_essential',approved,'À vista');
  insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id,operator_id,proposal_id,expires_at,recipient_id)
  values(a,opportunity,admin,proposal,now()+interval '1 hour',recipient);
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_read_pilot_received_offers(a)='[]'::jsonb;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_send_pilot_commercial_offer(a,proposal,approved-interval '1 second');
    raise exception 'Envio de uma revisão obsoleta foi autorizado';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_send_pilot_commercial_offer(a,proposal,approved)=proposal;
  assert cali_workspace.v2_send_pilot_commercial_offer(a,proposal,approved)=proposal;
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_read_pilot_received_offers(b)='[]'::jsonb;
  begin
    perform cali_workspace.v2_accept_pilot_commercial_offer(b,proposal,1);
    raise exception 'Outra empresa aceitou a proposta';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  offers := cali_workspace.v2_read_pilot_received_offers(a);
  assert jsonb_array_length(offers)=1 and offers#>>'{0,paymentTerms}'='À vista'
    and (offers#>>'{0,total}')::numeric=175.50 and (offers#>>'{0,canAccept}')::boolean;
  begin
    perform cali_workspace.v2_accept_pilot_commercial_offer(a,proposal,2);
    raise exception 'Outra versão foi aceita';
  exception when serialization_failure then null; end;
  reset role;
  update cali_session_guard.phase4_commercial_scope set accept_by=clock_timestamp()-interval '1 second'
    where proposal_id=proposal returning delivered_at+interval '15 days' into original_deadline;
  set local role authenticated;
  begin
    perform cali_workspace.v2_accept_pilot_commercial_offer(a,proposal,1);
    raise exception 'Proposta vencida foi aceita';
  exception when serialization_failure then null; end;
  reset role;
  update cali_session_guard.phase4_commercial_scope set accept_by=original_deadline where proposal_id=proposal;
  set local role authenticated;
  assert cali_workspace.v2_accept_pilot_commercial_offer(a,proposal,1)=proposal;
  assert cali_workspace.v2_accept_pilot_commercial_offer(a,proposal,1)=proposal;
  assert cali_workspace.v2_read_pilot_received_offers(a)#>>'{0,canAccept}'='false';
  reset role;
  assert (select count(*) from cali_workspace.activity_log where entity_id=proposal)=2;
  assert exists(select 1 from public.cali_proposals where id=proposal and status='aceita' and total_value=175.50);
  update cali_session_guard.phase4_commercial_scope set recipient_revoked_at=clock_timestamp() where proposal_id=proposal;
  set local role authenticated;
  assert cali_workspace.v2_read_pilot_received_offers(a)='[]'::jsonb;
end $$;
rollback;
\echo Fase 4: entrega e aceite no Workspace validados por versão, destinatário, prazo e reenvio.
