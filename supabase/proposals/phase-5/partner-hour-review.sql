-- Fase 5. Horas manuais entram em fila privada e só são lançadas após decisão Admin.
create table cali_session_guard.phase5_partner_hours (
  id uuid primary key,
  company_id uuid not null,
  actor_id uuid not null,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  day date not null,
  minutes integer not null check (minutes between 1 and 1440),
  description text not null,
  justification text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid,
  decision_note text,
  decided_at timestamptz,
  hour_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
alter table cali_session_guard.phase5_partner_hours enable row level security;
revoke all on cali_session_guard.phase5_partner_hours from public,anon,authenticated,service_role;

create function cali_workspace.v2_submit_partner_pilot_hours(
  p_company uuid,p_request uuid,p_day date,p_minutes integer,p_description text,p_justification text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
  invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  existing cali_session_guard.phase5_partner_hours;
begin
  if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text
    or not coalesce((access->'modules') ? 'hours',false) or invitation.id is null then
    raise exception using errcode='42501',message='Horas indisponíveis.';
  end if;
  if p_request is null or p_day is null or p_day>(now() at time zone 'America/Sao_Paulo')::date
    or p_minutes is null or p_minutes not between 1 and 1440
    or coalesce(length(btrim(p_description)),0) not between 3 and 1000
    or coalesce(length(btrim(p_justification)),0) not between 3 and 1000 then
    raise exception using errcode='22023',message='Confira data, duração, descrição e justificativa.';
  end if;
  insert into cali_session_guard.phase5_partner_hours
    (id,company_id,actor_id,invite_id,day,minutes,description,justification)
  values(p_request,p_company,auth.uid(),invitation.id,p_day,p_minutes,btrim(p_description),btrim(p_justification))
  on conflict(id) do nothing;
  select * into strict existing from cali_session_guard.phase5_partner_hours where id=p_request;
  if row(existing.company_id,existing.actor_id,existing.invite_id,existing.day,existing.minutes,
    existing.description,existing.justification) is distinct from
    row(p_company,auth.uid(),invitation.id,p_day,p_minutes,btrim(p_description),btrim(p_justification)) then
    raise exception using errcode='40001',message='A solicitação já foi usada.';
  end if;
  return p_request;
end;
$$;

create function cali_workspace.v2_list_partner_pilot_hour_requests(p_company uuid,p_admin boolean,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb;
  actor uuid;
begin
  if p_admin is null or p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Consulta inválida.';
  end if;
  if p_admin then
    actor:=cali_session_guard.require_phase4_role(p_company,'admin');
  else
    access:=cali_workspace.v2_read_partner_pilot();
    if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text
      or not coalesce((access->'modules') ? 'hours',false) then
      raise exception using errcode='42501',message='Horas indisponíveis.';
    end if;
    actor:=auth.uid();
  end if;
  return (
    with matched as (
      select h.id,h.day,h.minutes,h.description,h.justification,h.status,h.decision_note,h.created_at,
        case when p_admin then m.full_name end as member_name
      from cali_session_guard.phase5_partner_hours h
      join cali_session_guard.phase4_staff_invites i on i.id=h.invite_id
      left join cali_workspace.staff_members m on m.id=i.member_id
      where h.company_id=p_company and (p_admin or h.actor_id=actor)
    ), page as (
      select * from matched order by created_at desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),'rows',
      coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb))
  );
end;
$$;

create function cali_workspace.v2_decide_partner_pilot_hours(p_company uuid,p_request uuid,p_approve boolean,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  submission cali_session_guard.phase5_partner_hours;
  invitation cali_session_guard.phase4_staff_invites;
  next_status text:=case when p_approve then 'approved' else 'rejected' end;
  note text:=nullif(btrim(p_note),'');
  posted uuid;
begin
  if p_approve is null or coalesce(length(note),0)>1000 or (not p_approve and coalesce(length(note),0)<3) then
    raise exception using errcode='22023',message='Confira a decisão e o motivo da recusa.';
  end if;
  select * into submission from cali_session_guard.phase5_partner_hours
    where id=p_request and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Solicitação indisponível.'; end if;
  if submission.status=next_status and submission.decision_note is not distinct from note then return p_request; end if;
  if submission.status<>'pending' then raise exception using errcode='40001',message='Solicitação já decidida.'; end if;
  if p_approve then
    select * into strict invitation from cali_session_guard.phase4_staff_invites where id=submission.invite_id for share;
    if invitation.revoked_at is not null or not cali_session_guard.phase4_staff_binding(
      p_company,invitation.member_id,invitation.member_revision,submission.actor_id
    ) then raise exception using errcode='42501',message='A atribuição do Partner mudou.'; end if;
    posted:=cali_workspace.add_manual_hour_entry(p_company_id=>p_company,p_work_date=>submission.day,
      p_minutes=>submission.minutes,p_description=>submission.description,p_client_visible=>false,
      p_internal_note=>'Equipe CALI · Justificativa: '||submission.justification);
  end if;
  update cali_session_guard.phase5_partner_hours set status=next_status,decided_by=actor,
    decision_note=note,decided_at=clock_timestamp(),hour_id=posted where id=p_request;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,actor,'partner_pilot_hours_'||next_status,'staff_hour_submission',p_request,
      jsonb_build_object('minutes',submission.minutes,'hour_id',posted));
  return p_request;
end;
$$;

revoke all on function cali_workspace.v2_submit_partner_pilot_hours(uuid,uuid,date,integer,text,text),
  cali_workspace.v2_list_partner_pilot_hour_requests(uuid,boolean,integer),
  cali_workspace.v2_decide_partner_pilot_hours(uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_submit_partner_pilot_hours(uuid,uuid,date,integer,text,text),
  cali_workspace.v2_list_partner_pilot_hour_requests(uuid,boolean,integer),
  cali_workspace.v2_decide_partner_pilot_hours(uuid,uuid,boolean,text) to authenticated;
