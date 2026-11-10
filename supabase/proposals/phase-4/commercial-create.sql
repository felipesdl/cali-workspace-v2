-- FLOW-03. Criação de uma única versão na oportunidade sintética delegada.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_create_pilot_commercial_draft(p_company_id uuid,p_submission_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  service text;
  proposal uuid;
begin
  select g.* into scope from cali_session_guard.phase4_commercial_scope g
  join public.cali_submissions s on s.id=g.submission_id
  where g.company_id=p_company_id and g.submission_id=p_submission_id
    and g.operator_id=actor and g.expires_at>statement_timestamp()
    and g.pilot_package is not null and g.pilot_price>0
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for update of g;
  if not found then
    raise exception using errcode='42501',message='Oportunidade indisponível.';
  end if;
  if scope.proposal_id is not null then return scope.proposal_id; end if;

  select s.service_slug into service from public.cali_submissions s
  where s.id=p_submission_id and s.status='edicao'
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for update;
  if not found then
    raise exception using errcode='40001',message='A oportunidade mudou. Atualize a consulta.';
  end if;
  if exists(select 1 from public.cali_proposals where submission_id=p_submission_id) then
    raise exception using errcode='40001',message='A oportunidade já tem uma proposta.';
  end if;
  insert into public.cali_proposals(submission_id,status,version,service_slug,package_code,
    base_price,subtotal,final_unit,total_value,validity_days)
  values(p_submission_id,'rascunho',1,service,scope.pilot_package,
    scope.pilot_price,scope.pilot_price,scope.pilot_price,scope.pilot_price,15)
  returning id into proposal;
  update cali_session_guard.phase4_commercial_scope set proposal_id=proposal where submission_id=p_submission_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'commercial_proposal_created','commercial_proposal',proposal,'{"version":1}'::jsonb);
  return proposal;
end;
$$;

revoke all on function cali_workspace.v2_create_pilot_commercial_draft(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_create_pilot_commercial_draft(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
