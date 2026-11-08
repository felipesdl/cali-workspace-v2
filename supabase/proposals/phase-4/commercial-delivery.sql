-- FLOW-03. Entrega no Workspace ao destinatário sintético e aceite da versão recebida.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_send_pilot_commercial_offer(
  p_company_id uuid,p_proposal_id uuid,p_expected timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  draft public.cali_proposals%rowtype;
  protocol text;
  sent timestamptz := clock_timestamp();
begin
  select g.* into scope from cali_session_guard.phase4_commercial_scope g
  where g.company_id=p_company_id and g.proposal_id=p_proposal_id and g.operator_id=actor
    and g.expires_at>statement_timestamp() and g.recipient_revoked_at is null
    and exists (
      select 1 from cali_session_guard.pilot_accounts a
      join cali_workspace.profiles p on p.id=a.profile_id and p.company_id=a.company_id
      where a.company_id=g.company_id and a.profile_id=g.recipient_id and a.revoked_at is null
        and p.active and p.role::text='client'
    )
  for update;
  if not found then
    raise exception using errcode='42501',message='Proposta indisponível.';
  end if;

  select s.protocol into protocol from public.cali_submissions s where s.id=scope.submission_id
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid';
  if not found then raise exception using errcode='42501',message='Proposta indisponível.'; end if;

  if scope.delivered_at is not null
    and (scope.offer->>'approvedAt')::timestamptz=p_expected then
    return p_proposal_id;
  end if;
  select p.* into draft from public.cali_proposals p
    where p.id=p_proposal_id and p.submission_id=scope.submission_id for update;
  if not found or scope.delivered_at is not null or draft.status<>'aprovada'
    or p_expected is null or draft.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.';
  end if;

  update cali_session_guard.phase4_commercial_scope set delivered_at=sent,
    accept_by=sent+make_interval(days=>draft.validity_days),
    offer=jsonb_build_object('protocol',protocol,'version',draft.version,'total',draft.total_value,
      'package',draft.package_code,'paymentTerms',draft.payment_terms,'publicNotes',draft.public_notes,
      'approvedAt',draft.updated_at)
    where submission_id=scope.submission_id;
  update public.cali_proposals set status='enviada',updated_at=sent where id=draft.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'commercial_proposal_delivered','commercial_proposal',draft.id,
    jsonb_build_object('version',draft.version,'channel','workspace'));
  return draft.id;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_received_offers(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',g.proposal_id,'protocol',g.offer->>'protocol',
      'version',g.offer->'version','total',g.offer->'total','package',g.offer->'package',
      'paymentTerms',g.offer->'paymentTerms','publicNotes',g.offer->'publicNotes',
      'acceptBy',g.accept_by,'acceptedAt',g.accepted_at,
      'canAccept',g.accepted_at is null and g.accept_by>statement_timestamp()
        and p.status='enviada' and p.updated_at=g.delivered_at)
      order by g.delivered_at desc,g.proposal_id)
    from cali_session_guard.phase4_commercial_scope g
    join public.cali_proposals p on p.id=g.proposal_id and p.submission_id=g.submission_id
    where g.company_id=p_company_id and g.recipient_id=actor and g.recipient_revoked_at is null
      and g.delivered_at is not null
  ),'[]'::jsonb);
end;
$$;

create or replace function cali_workspace.v2_accept_pilot_commercial_offer(
  p_company_id uuid,p_proposal_id uuid,p_version integer
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  accepted timestamptz := clock_timestamp();
begin
  select g.* into scope from cali_session_guard.phase4_commercial_scope g
  where g.company_id=p_company_id and g.proposal_id=p_proposal_id and g.recipient_id=actor
    and g.recipient_revoked_at is null and g.delivered_at is not null for update;
  if not found then raise exception using errcode='42501',message='Proposta indisponível.'; end if;
  if p_version is distinct from (scope.offer->>'version')::integer then
    raise exception using errcode='40001',message='A versão da proposta mudou.';
  end if;
  if scope.accepted_at is not null then return p_proposal_id; end if;
  if scope.accept_by<=accepted then
    raise exception using errcode='40001',message='O prazo desta proposta encerrou.';
  end if;
  update public.cali_proposals p set status='aceita',updated_at=accepted
  where p.id=p_proposal_id and p.submission_id=scope.submission_id
    and p.status='enviada' and p.updated_at=scope.delivered_at and p.version=p_version
    and p.total_value=(scope.offer->>'total')::numeric and p.package_code=scope.offer->>'package'
    and p.payment_terms is not distinct from scope.offer->>'paymentTerms'
    and p.public_notes is not distinct from scope.offer->>'publicNotes';
  if not found then raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.'; end if;
  update cali_session_guard.phase4_commercial_scope set accepted_at=accepted where submission_id=scope.submission_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'commercial_proposal_accepted','commercial_proposal',p_proposal_id,
    jsonb_build_object('version',p_version,'channel','workspace'));
  return p_proposal_id;
end;
$$;

revoke all on function cali_workspace.v2_send_pilot_commercial_offer(uuid,uuid,timestamptz),
  cali_workspace.v2_read_pilot_received_offers(uuid),
  cali_workspace.v2_accept_pilot_commercial_offer(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_send_pilot_commercial_offer(uuid,uuid,timestamptz),
  cali_workspace.v2_read_pilot_received_offers(uuid),
  cali_workspace.v2_accept_pilot_commercial_offer(uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
