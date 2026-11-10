-- Fila privada. Apenas revisão de entregável e solicitação de encerramento do piloto.
create table cali_session_guard.phase5_partner_reviews (
  id uuid primary key,
  company_id uuid not null,
  actor_id uuid not null,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  kind text not null check(kind in ('deliverable','record_close')),
  item_id uuid not null,
  title text not null,
  note text,
  status text not null default 'pending' check(status in ('pending','approved','returned')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create unique index phase5_partner_one_open_review on cali_session_guard.phase5_partner_reviews(company_id,kind,item_id)
where status='pending';
alter table cali_session_guard.phase5_partner_reviews enable row level security;
revoke all on cali_session_guard.phase5_partner_reviews from public,anon,authenticated,service_role;

-- Revalida alvo inscrito, visibilidade e estado sob lock antes de transitar.
create function cali_session_guard.phase5_lock_review_target(p_company uuid,p_kind text,p_item uuid)
returns text language plpgsql set search_path='' as $$
declare
  title text;
begin
  if p_kind='deliverable' then
    select d.title into title from cali_workspace.deliverables d
      join cali_session_guard.phase4_project_qa q on q.project_id=d.project_id and q.company_id=d.company_id
      where d.id=p_item and d.company_id=p_company and d.client_visible
        and d.status not in ('approved','cancelled','client_review','rebriefing') and d.work_closed_at is null
      for update of d;
  elsif p_kind='record_close' then
    select r.title into title from cali_workspace.account_records r
      join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
      where r.id=p_item and r.company_id=p_company and r.visibility='client'
        and r.workflow_status not in ('completed','cancelled')
      for update of r;
  end if;
  if title is null then raise exception using errcode='42501',message='Item indisponível para revisão.'; end if;
  return title;
end;
$$;

create function cali_workspace.v2_submit_partner_pilot_review(
  p_company uuid,p_request uuid,p_kind text,p_item uuid,p_note text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  invite cali_session_guard.phase4_staff_invites;
  previous cali_session_guard.phase5_partner_reviews;
  title text;
  note text:=nullif(btrim(p_note),'');
begin
  if p_request is null or p_item is null or p_kind is null or p_kind not in ('deliverable','record_close')
    or coalesce(length(note),0)>2000 then raise exception using errcode='22023',message='Confira a solicitação.'; end if;
  perform cali_session_guard.require_phase5_partner(p_company,case when p_kind='deliverable' then 'projects' else 'records' end);
  invite:=cali_session_guard.phase5_partner_invite();
  perform pg_advisory_xact_lock(hashtextextended('phase5-review:'||p_company::text||':'||p_kind||':'||p_item::text,0));
  select * into previous from cali_session_guard.phase5_partner_reviews where id=p_request;
  if found then
    if row(previous.company_id,previous.actor_id,previous.invite_id,previous.kind,previous.item_id,previous.note)
      is not distinct from row(p_company,actor,invite.id,p_kind,p_item,note) then return p_request; end if;
    raise exception using errcode='40001',message='A solicitação já foi usada.';
  end if;
  title:=cali_session_guard.phase5_lock_review_target(p_company,p_kind,p_item);
  if exists(select 1 from cali_session_guard.phase5_partner_reviews r where r.company_id=p_company
    and r.kind=p_kind and r.item_id=p_item and r.status='pending') then
    raise exception using errcode='40001',message='Já existe uma revisão em andamento.';
  end if;
  insert into cali_session_guard.phase5_partner_reviews(id,company_id,actor_id,invite_id,kind,item_id,title,note)
    values(p_request,p_company,actor,invite.id,p_kind,p_item,title,note);
  if p_kind='deliverable' then
    perform set_config('cali_workspace.status_note','Enviado para revisão CALI',true);
    update cali_workspace.deliverables set status='internal_review',updated_at=now()
      where id=p_item and status<>'internal_review';
  end if;
  return p_request;
end;
$$;

create function cali_workspace.v2_list_partner_pilot_reviews(p_company uuid,p_admin boolean,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  access jsonb;
begin
  if p_page is null or p_page not between 1 and 10000 or p_admin is null then
    raise exception using errcode='22023',message='Consulta inválida.';
  end if;
  if p_admin then
    actor:=cali_session_guard.require_phase4_role(p_company,'admin');
  else
    access:=cali_workspace.v2_read_partner_pilot();
    if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text then
      raise exception using errcode='42501',message='Revisões indisponíveis.';
    end if;
  end if;
  return (
    with matched as (
      select r.id,r.kind,r.title,r.note,r.status,r.decision_note,r.created_at
      from cali_session_guard.phase5_partner_reviews r
      where r.company_id=p_company and (p_admin or (
        r.actor_id=actor and (access->'modules') ? case when r.kind='deliverable' then 'projects' else 'records' end
      ))
    ), page as (
      select * from matched order by (status='pending') desc,created_at desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((
      select jsonb_agg(to_jsonb(page) order by (status='pending') desc,created_at desc,id) from page
    ),'[]'::jsonb))
  );
end;
$$;

create function cali_workspace.v2_decide_partner_pilot_review(p_company uuid,p_request uuid,p_approve boolean,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  review cali_session_guard.phase5_partner_reviews;
  invite cali_session_guard.phase4_staff_invites;
  clean_note text:=nullif(btrim(p_note),'');
  decision text:=case when p_approve then 'approved' else 'returned' end;
begin
  if p_approve is null or coalesce(length(clean_note),0)>2000 or (not p_approve and coalesce(length(clean_note),0)<3) then
    raise exception using errcode='22023',message='Informe a decisão e o motivo da devolução.';
  end if;
  select * into review from cali_session_guard.phase5_partner_reviews
    where id=p_request and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Revisão indisponível.'; end if;
  if review.status=decision and review.decision_note is not distinct from clean_note then return p_request; end if;
  if review.status<>'pending' then raise exception using errcode='40001',message='Revisão já decidida.'; end if;
  if p_approve then
    select * into invite from cali_session_guard.phase4_staff_invites where id=review.invite_id for share;
    if not found or invite.revoked_at is not null or not cali_session_guard.phase4_staff_binding(
      p_company,invite.member_id,invite.member_revision,review.actor_id
    ) then raise exception using errcode='42501',message='A atribuição do Partner mudou.'; end if;
    perform cali_session_guard.phase5_lock_review_target(p_company,review.kind,review.item_id);
    if review.kind='deliverable' then
      if not exists(select 1 from cali_workspace.deliverables d where d.id=review.item_id and d.status='internal_review') then
        raise exception using errcode='40001',message='O entregável saiu da revisão CALI.';
      end if;
      perform cali_workspace.change_deliverable_status(review.item_id,'client_review',coalesce(clean_note,'Aprovado pela CALI.'));
    else
      perform cali_workspace.set_account_record_status(review.item_id,'completed');
    end if;
  end if;
  update cali_session_guard.phase5_partner_reviews set status=decision,decision_note=clean_note,
    decided_by=actor,decided_at=clock_timestamp() where id=p_request;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,actor,'partner_pilot_review_'||decision,'staff_review',p_request,
      jsonb_build_object('kind',review.kind,'item_id',review.item_id));
  return p_request;
end;
$$;

revoke all on function cali_session_guard.phase5_lock_review_target(uuid,text,uuid),
  cali_workspace.v2_submit_partner_pilot_review(uuid,uuid,text,uuid,text),
  cali_workspace.v2_list_partner_pilot_reviews(uuid,boolean,integer),
  cali_workspace.v2_decide_partner_pilot_review(uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_submit_partner_pilot_review(uuid,uuid,text,uuid,text),
  cali_workspace.v2_list_partner_pilot_reviews(uuid,boolean,integer),
  cali_workspace.v2_decide_partner_pilot_review(uuid,uuid,boolean,text) to authenticated;
