-- FLOW-03. A delegação da V2 vale somente para a proposta sintética inscrita.
begin;
set local lock_timeout = '5s';

create or replace function cali_session_guard.require_phase4_commercial_proposal(p_company_id uuid,p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  perform 1 from cali_session_guard.phase4_commercial_scope s
  join public.cali_proposals p on p.id=s.proposal_id and p.submission_id=s.submission_id
  where s.company_id=p_company_id and s.proposal_id=p_proposal_id
    and s.operator_id=actor and s.expires_at>statement_timestamp()
  for share of s;
  if not found then
    raise exception using errcode='42501',message='Proposta indisponível.';
  end if;
  return actor;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_commercial_draft(p_company_id uuid,p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  draft public.cali_proposals%rowtype;
begin
  perform cali_session_guard.require_phase4_commercial_proposal(p_company_id,p_proposal_id);
  select p.* into draft from public.cali_proposals p
  join cali_session_guard.phase4_commercial_scope s on s.proposal_id=p.id and s.submission_id=p.submission_id
  where p.id=p_proposal_id and p.status='rascunho';
  if not found then return null; end if;
  return jsonb_build_object('id',draft.id,'updatedAt',draft.updated_at,'paymentTerms',draft.payment_terms,
    'publicNotes',draft.public_notes,'validityDays',draft.validity_days,
    'pricing',case when draft.service_slug='cali-build' and draft.package_code in ('ESSENCIAL','COMPLETO')
      and to_regprocedure('cali_workspace.v2_price_pilot_commercial_draft(uuid,uuid,timestamptz,numeric,numeric,integer)') is not null
      and exists(select 1 from cali_session_guard.phase4_commercial_scope g where g.proposal_id=draft.id
        and g.pilot_price between 50 and 100000)
      then jsonb_build_object('extras',draft.extras,'discount',coalesce(draft.calculator_data#>'{pilotBuild,discount}',to_jsonb(draft.discount_pct)),
        'months',draft.contract_months,'subtotal',draft.subtotal,'monthly',draft.final_unit) end);
end;
$$;

create or replace function cali_workspace.v2_save_pilot_commercial_draft(
  p_company_id uuid,p_proposal_id uuid,p_expected timestamptz,p_action text,
  p_payment_terms text,p_public_notes text,p_validity_days integer
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  draft public.cali_proposals%rowtype;
  actor uuid;
  next_status text;
begin
  if p_action is null or p_action not in ('edit','approve') or p_expected is null
    or (p_action='edit' and (coalesce(p_validity_days,0) not between 1 and 120
      or length(p_payment_terms)>2000 or length(p_public_notes)>4000))
    or (p_action='approve' and (p_payment_terms is not null or p_public_notes is not null or p_validity_days is not null)) then
    raise exception using errcode='22023',message='Confira os dados da proposta.';
  end if;
  actor := cali_session_guard.require_phase4_commercial_proposal(p_company_id,p_proposal_id);
  select p.* into draft from public.cali_proposals p
  join cali_session_guard.phase4_commercial_scope s on s.proposal_id=p.id and s.submission_id=p.submission_id
  where p.id=p_proposal_id for update of p;
  if not found then raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.'; end if;
  if draft.status<>'rascunho' or draft.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.';
  end if;
  next_status := case when p_action='approve' then 'aprovada' else draft.status end;
  update public.cali_proposals set status=next_status,updated_at=clock_timestamp(),
    payment_terms=case when p_action='edit' then nullif(btrim(p_payment_terms),'') else draft.payment_terms end,
    public_notes=case when p_action='edit' then nullif(btrim(p_public_notes),'') else draft.public_notes end,
    validity_days=case when p_action='edit' then p_validity_days else draft.validity_days end
  where id=draft.id;
  if not found then raise exception using errcode='42501',message='Proposta indisponível.'; end if;

  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,case when p_action='approve' then 'commercial_proposal_approved' else 'commercial_proposal_edited' end,
    'commercial_proposal',draft.id,jsonb_build_object('version',draft.version));
  return draft.id;
end;
$$;

drop function if exists cali_workspace.v2_require_pilot_commercial_scope(uuid,uuid);
revoke all on function cali_session_guard.require_phase4_commercial_proposal(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function
  cali_workspace.v2_read_pilot_commercial_draft(uuid,uuid),
  cali_workspace.v2_save_pilot_commercial_draft(uuid,uuid,timestamptz,text,text,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function
  cali_workspace.v2_read_pilot_commercial_draft(uuid,uuid),
  cali_workspace.v2_save_pilot_commercial_draft(uuid,uuid,timestamptz,text,text,text,integer)
  to authenticated;
notify pgrst,'reload schema';
commit;
