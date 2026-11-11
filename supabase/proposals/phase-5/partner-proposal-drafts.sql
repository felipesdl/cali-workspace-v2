begin;
set local lock_timeout='5s';

create table cali_session_guard.partner_proposal_assignments (
  submission_id uuid primary key references cali_session_guard.phase4_commercial_scope(submission_id) on delete cascade,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  assigned_by uuid not null
);
create table cali_session_guard.partner_proposal_drafts (
  id uuid primary key,
  submission_id uuid not null references cali_session_guard.partner_proposal_assignments(submission_id) on delete cascade,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  actor_id uuid not null,
  expected_at timestamptz not null,
  payment_terms text,
  public_notes text,
  validity_days integer not null check(validity_days between 1 and 120),
  state text not null default 'pending' check(state in ('pending','accepted','returned')),
  decided_by uuid,
  decision_note text,
  proposal_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
create unique index partner_proposal_pending on cali_session_guard.partner_proposal_drafts(submission_id)
where state='pending';
alter table cali_session_guard.partner_proposal_assignments enable row level security;
alter table cali_session_guard.partner_proposal_drafts enable row level security;
revoke all on cali_session_guard.partner_proposal_assignments,cali_session_guard.partner_proposal_drafts
from public,anon,authenticated,service_role;

create function cali_session_guard.lock_partner_proposal(p_company uuid,p_opportunity uuid)
returns cali_session_guard.phase4_commercial_scope
language plpgsql set search_path='' as $$
declare selected cali_session_guard.phase4_commercial_scope;
begin
  select g.* into selected from cali_session_guard.phase4_commercial_scope g
  join public.cali_submissions s on s.id=g.submission_id
  where g.company_id=p_company and g.submission_id=p_opportunity
    and g.expires_at>clock_timestamp() and g.delivered_at is null
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for update of g;
  if not found then raise exception using errcode='42501',message='Oportunidade indisponível.'; end if;
  return selected;
end;
$$;

create function cali_workspace.v2_partner_proposal_admin(p_company uuid,p_opportunity uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  if not exists(select 1 from cali_session_guard.phase4_commercial_scope g
    where g.company_id=p_company and g.submission_id=p_opportunity and g.operator_id=actor and g.expires_at>statement_timestamp())
  then raise exception using errcode='42501',message='Oportunidade indisponível.'; end if;
  return jsonb_build_object(
    'assigned',(select invite_id from cali_session_guard.partner_proposal_assignments where submission_id=p_opportunity),
    'options',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',m.full_name) order by m.full_name,i.id)
      from cali_session_guard.phase4_staff_invites i join cali_workspace.staff_members m on m.id=i.member_id
      where i.company_id=p_company and i.revoked_at is null and i.accepted_at is not null
        and m.role='partner'
        and cali_session_guard.phase4_staff_binding(p_company,i.member_id,i.member_revision,i.target_user_id)),'[]'::jsonb),
    'draft',(select jsonb_build_object('id',d.id,'state',d.state,'paymentTerms',d.payment_terms,
      'publicNotes',d.public_notes,'validityDays',d.validity_days,'author',m.full_name,'decision',d.decision_note)
      from cali_session_guard.partner_proposal_drafts d join cali_session_guard.phase4_staff_invites i on i.id=d.invite_id
      join cali_workspace.staff_members m on m.id=i.member_id where d.submission_id=p_opportunity
      order by d.created_at desc,d.id desc limit 1));
end;
$$;

create function cali_workspace.v2_assign_partner_proposal(p_company uuid,p_opportunity uuid,p_invite uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  target cali_session_guard.phase4_commercial_scope:=cali_session_guard.lock_partner_proposal(p_company,p_opportunity);
begin
  if target.operator_id is distinct from actor or not exists (
    select 1 from cali_session_guard.phase4_staff_invites i join cali_workspace.staff_members m on m.id=i.member_id
    where i.id=p_invite and i.company_id=p_company and i.revoked_at is null and i.accepted_at is not null
      and m.role='partner'
      and cali_session_guard.phase4_staff_binding(p_company,i.member_id,i.member_revision,i.target_user_id)
  ) then raise exception using errcode='42501',message='Parceiro indisponível para esta oportunidade.'; end if;
  if exists(select 1 from cali_session_guard.partner_proposal_drafts
    where submission_id=p_opportunity and state in ('pending','accepted'))
  then raise exception using errcode='40001',message='A proposta já está em revisão.'; end if;
  insert into cali_session_guard.partner_proposal_assignments values(p_opportunity,p_invite,actor)
  on conflict(submission_id) do update set invite_id=excluded.invite_id,assigned_by=excluded.assigned_by;
end;
$$;

create function cali_session_guard.partner_proposal_invite(p_company uuid)
returns uuid language plpgsql stable set search_path='' as $$
declare access jsonb:=cali_workspace.v2_read_partner_pilot();
begin
  if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text
  then raise exception using errcode='42501',message='Propostas indisponíveis.'; end if;
  return (cali_session_guard.phase5_partner_invite()).id;
end;
$$;

create function cali_workspace.v2_list_partner_proposal_drafts(p_company uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare invitation uuid:=cali_session_guard.partner_proposal_invite(p_company);
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (with available as (
    select s.id,s.protocol,s.service_slug as service,coalesce(p.updated_at,s.updated_at) as "expectedAt",
      d.state,d.payment_terms as "paymentTerms",d.public_notes as "publicNotes",d.validity_days as "validityDays",d.decision_note as decision,
      coalesce(g.delivered_at is null and (d.state is null or d.state='returned') and
        (p.status='rascunho' or (p.id is null and s.status='edicao')),false) as "canSubmit"
    from cali_session_guard.partner_proposal_assignments a
    join cali_session_guard.phase4_commercial_scope g on g.submission_id=a.submission_id and g.company_id=p_company
    join public.cali_submissions s on s.id=g.submission_id
    left join public.cali_proposals p on p.id=g.proposal_id and p.submission_id=s.id
    left join lateral (select x.* from cali_session_guard.partner_proposal_drafts x
      where x.submission_id=s.id and x.invite_id=invitation order by x.created_at desc,x.id desc limit 1) d on true
    where a.invite_id=invitation and g.expires_at>statement_timestamp()
      and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  ), page as (
    select * from available order by "expectedAt" desc,id limit 25 offset (p_page-1)*25
  ) select jsonb_build_object('total',(select count(*) from available),
    'rows',coalesce(jsonb_agg(to_jsonb(page) order by "expectedAt" desc,id),'[]'::jsonb)) from page);
end;
$$;

create function cali_workspace.v2_submit_partner_proposal_draft(
  p_company uuid,p_opportunity uuid,p_expected timestamptz,p_request uuid,p_payment text,p_notes text,p_validity integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  invitation uuid:=cali_session_guard.partner_proposal_invite(p_company);
  actor uuid:=auth.uid();
  target cali_session_guard.phase4_commercial_scope:=cali_session_guard.lock_partner_proposal(p_company,p_opportunity);
  prior cali_session_guard.partner_proposal_drafts;
  payment text:=nullif(btrim(p_payment),'');
  notes text:=nullif(btrim(p_notes),'');
begin
  if p_request is null or p_expected is null or length(payment)>2000 or length(notes)>4000
    or coalesce(p_validity,0) not between 1 and 120
  then raise exception using errcode='22023',message='Confira as condições da proposta.'; end if;
  if not exists(select 1 from cali_session_guard.partner_proposal_assignments a
    where a.submission_id=p_opportunity and a.invite_id=invitation)
  then raise exception using errcode='42501',message='Oportunidade indisponível.'; end if;
  select * into prior from cali_session_guard.partner_proposal_drafts where id=p_request;
  if found then
    if row(prior.submission_id,prior.invite_id,prior.actor_id,prior.expected_at,prior.payment_terms,prior.public_notes,prior.validity_days)
      is not distinct from row(p_opportunity,invitation,actor,p_expected,payment,notes,p_validity)
    then return p_request; end if;
    raise exception using errcode='40001',message='Operação já utilizada.';
  end if;
  if not exists(select 1 from public.cali_submissions s
    left join public.cali_proposals p on p.id=target.proposal_id and p.submission_id=s.id
    where s.id=p_opportunity and coalesce(p.updated_at,s.updated_at)=p_expected
      and (p.status='rascunho' or (p.id is null and s.status='edicao')))
    or exists(select 1 from cali_session_guard.partner_proposal_drafts
      where submission_id=p_opportunity and state in ('pending','accepted'))
  then raise exception using errcode='40001',message='A proposta mudou ou já está em revisão.'; end if;
  insert into cali_session_guard.partner_proposal_drafts
    (id,submission_id,invite_id,actor_id,expected_at,payment_terms,public_notes,validity_days)
  values(p_request,p_opportunity,invitation,actor,p_expected,payment,notes,p_validity);
  return p_request;
end;
$$;

create function cali_workspace.v2_decide_partner_proposal_draft(
  p_company uuid,p_opportunity uuid,p_draft uuid,p_accept boolean,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  target cali_session_guard.phase4_commercial_scope:=cali_session_guard.lock_partner_proposal(p_company,p_opportunity);
  draft cali_session_guard.partner_proposal_drafts;
  note text:=nullif(btrim(p_note),'');
  next_state text:=case when p_accept then 'accepted' else 'returned' end;
  proposal uuid;
  expected timestamptz;
begin
  if target.operator_id is distinct from actor then raise exception using errcode='42501',message='Proposta indisponível.'; end if;
  if p_accept is null or length(note)>1000 or (not p_accept and coalesce(length(note),0)<3)
  then raise exception using errcode='22023',message='Confira a decisão e o motivo.'; end if;
  select * into draft from cali_session_guard.partner_proposal_drafts
  where id=p_draft and submission_id=p_opportunity for update;
  if not found then raise exception using errcode='42501',message='Rascunho indisponível.'; end if;
  if draft.state=next_state and draft.decision_note is not distinct from note then return p_draft; end if;
  if draft.state<>'pending' then raise exception using errcode='40001',message='Rascunho já decidido.'; end if;
  if p_accept then
    if not exists(select 1 from cali_session_guard.phase4_staff_invites i
      join cali_session_guard.partner_proposal_assignments a on a.invite_id=i.id and a.submission_id=p_opportunity
      where i.id=draft.invite_id and i.revoked_at is null
        and cali_session_guard.phase4_staff_binding(p_company,i.member_id,i.member_revision,draft.actor_id))
    then raise exception using errcode='42501',message='A atribuição do parceiro mudou.'; end if;
    if target.proposal_id is null then
      perform 1 from public.cali_submissions s where s.id=p_opportunity and s.updated_at=draft.expected_at for update;
      if not found then raise exception using errcode='40001',message='A oportunidade mudou.'; end if;
      proposal:=cali_workspace.v2_create_pilot_commercial_draft(p_company,p_opportunity);
      select p.updated_at into strict expected from public.cali_proposals p where p.id=proposal;
    else
      proposal:=target.proposal_id;
      expected:=draft.expected_at;
    end if;
    perform cali_workspace.v2_save_pilot_commercial_draft(p_company,proposal,expected,'edit',
      draft.payment_terms,draft.public_notes,draft.validity_days);
  end if;
  update cali_session_guard.partner_proposal_drafts set state=next_state,decided_by=actor,
    decision_note=note,proposal_id=proposal where id=p_draft;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'partner_proposal_draft_'||next_state,'commercial_opportunity',p_opportunity,
    jsonb_build_object('draft_id',p_draft,'proposal_id',proposal));
  return p_draft;
end;
$$;

revoke all on function cali_session_guard.lock_partner_proposal(uuid,uuid),
  cali_session_guard.partner_proposal_invite(uuid),
  cali_workspace.v2_partner_proposal_admin(uuid,uuid),cali_workspace.v2_assign_partner_proposal(uuid,uuid,uuid),
  cali_workspace.v2_list_partner_proposal_drafts(uuid,integer),
  cali_workspace.v2_submit_partner_proposal_draft(uuid,uuid,timestamptz,uuid,text,text,integer),
  cali_workspace.v2_decide_partner_proposal_draft(uuid,uuid,uuid,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_partner_proposal_admin(uuid,uuid),
  cali_workspace.v2_assign_partner_proposal(uuid,uuid,uuid),
  cali_workspace.v2_list_partner_proposal_drafts(uuid,integer),
  cali_workspace.v2_submit_partner_proposal_draft(uuid,uuid,timestamptz,uuid,text,text,integer),
  cali_workspace.v2_decide_partner_proposal_draft(uuid,uuid,uuid,boolean,text)
  to authenticated;
notify pgrst,'reload schema';
commit;
