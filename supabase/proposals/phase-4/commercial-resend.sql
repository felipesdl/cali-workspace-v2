-- FLOW-03. Reenvio explícito da mesma oferta no Workspace sem alterar prazo ou aceite.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_commercial_resends (
  request_id uuid primary key,
  company_id uuid not null,
  proposal_id uuid not null references public.cali_proposals(id),
  actor_id uuid not null references cali_workspace.profiles(id),
  version integer not null check(version>0),
  fingerprint bytea not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table cali_session_guard.phase4_commercial_resends enable row level security;
revoke all on cali_session_guard.phase4_commercial_resends from public,anon,authenticated,service_role;

create function cali_workspace.v2_resend_pilot_commercial_offer(
  p_company_id uuid,p_proposal_id uuid,p_expected timestamptz,p_request_id uuid
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company_id,'admin');
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  draft public.cali_proposals%rowtype;
  previous cali_session_guard.phase4_commercial_resends%rowtype;
  version integer;
  fingerprint_value bytea;
begin
  if p_request_id is null or p_expected is null then
    raise exception using errcode='22023',message='Confirme novamente o envio da proposta.';
  end if;
  select g.* into scope from cali_session_guard.phase4_commercial_scope g
  where g.company_id=p_company_id and g.proposal_id=p_proposal_id and g.operator_id=actor
    and g.expires_at>statement_timestamp() and g.recipient_id is not null
    and g.recipient_revoked_at is null and g.delivered_at is not null
    and g.accepted_at is null and g.accept_by>statement_timestamp()
    and exists (
      select 1 from cali_session_guard.pilot_accounts a
      join cali_workspace.profiles p on p.id=a.profile_id and p.company_id=a.company_id
      where a.company_id=g.company_id and a.profile_id=g.recipient_id and a.revoked_at is null
        and p.active and p.role::text='client'
    )
  for update;
  if not found then raise exception using errcode='42501',message='Proposta indisponível para reenvio.'; end if;

  select p.* into draft from public.cali_proposals p
  join public.cali_submissions s on s.id=p.submission_id
  where p.id=p_proposal_id and p.submission_id=scope.submission_id
    and p.status='enviada' and p.updated_at=scope.delivered_at
    and p.updated_at=p_expected and p.version=(scope.offer->>'version')::integer
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for update of p;
  if not found then raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.'; end if;

  version:=draft.version;
  fingerprint_value:=sha256(convert_to(jsonb_build_array(scope.offer,scope.accept_by,scope.recipient_id)::text,'UTF8'));
  select * into previous from cali_session_guard.phase4_commercial_resends where request_id=p_request_id for update;
  if found then
    if row(previous.company_id,previous.proposal_id,previous.actor_id,previous.version,previous.fingerprint)
      is not distinct from row(p_company_id,p_proposal_id,actor,version,fingerprint_value) then
      return p_proposal_id;
    end if;
    raise exception using errcode='40001',message='A confirmação já foi usada em outro envio.';
  end if;

  insert into cali_session_guard.phase4_commercial_resends(request_id,company_id,proposal_id,actor_id,version,fingerprint)
    values(p_request_id,p_company_id,p_proposal_id,actor,version,fingerprint_value);
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,entity_type,entity_id,
    action_url,relevance,email_required)
  values(p_company_id,scope.recipient_id,'commercial_proposal_resent','Proposta reenviada',
    'Sua proposta está disponível no Workspace.','commercial_proposal',p_proposal_id,
    '/cliente/propostas','normal',false);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'commercial_proposal_resent','commercial_proposal',p_proposal_id,
      jsonb_build_object('version',version,'channel','workspace','requestId',p_request_id));
  return p_proposal_id;
end;
$$;

revoke all on function cali_workspace.v2_resend_pilot_commercial_offer(uuid,uuid,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_resend_pilot_commercial_offer(uuid,uuid,timestamptz,uuid)
  to authenticated;
notify pgrst,'reload schema';
commit;
