-- FLOW-05/06. Reabertura sem arquivos usa o mesmo registro e preserva a avaliação anterior.
begin;
set local lock_timeout = '5s';

-- A nota da correção é por revisão. Os índices legados preservam uma nota por usuário e item.
create table if not exists cali_session_guard.phase4_delivery_corrections (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  delivery_id uuid not null,
  opened_by uuid not null,
  opened_at timestamptz not null default clock_timestamp(),
  reason text not null,
  previous_approved_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  score integer check (score between 1 and 5),
  comment text
);
revoke all on cali_session_guard.phase4_delivery_corrections from public,anon,authenticated,service_role;
create unique index if not exists phase4_one_open_delivery_correction
  on cali_session_guard.phase4_delivery_corrections(company_id,delivery_id) where approved_at is null;

create function cali_workspace.v2_pilot_delivery_action(
  p_company_id uuid,p_project_id uuid,p_delivery_id uuid,p_expected timestamptz,
  p_action text,p_status text default null,p_note text default null,p_score integer default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid;
  delivery cali_workspace.deliverables%rowtype;
  admin boolean;
  correction bigint;
  timer_id uuid;
  approved_time timestamptz;

begin
  if p_action is null or p_action not in ('status','reopen','approve','adjust')
    or length(p_note)>4000 then
    raise exception using errcode='22023', message='Revise os dados da operação.';
  end if;
  admin := p_action in ('status','reopen');
  actor := cali_session_guard.require_phase4_role(p_company_id,case when admin then 'admin' else 'client' end);
  perform 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
    and p.planning_status in ('active','rebriefing') and p.execution_status='normal' for update;
  if not found then raise exception using errcode='42501', message='Projeto indisponível para execução.'; end if;
  select * into delivery from cali_workspace.deliverables d where d.id=p_delivery_id and d.company_id=p_company_id
    and d.project_id=p_project_id and d.execution_status='normal' for update;
  if not found then raise exception using errcode='42501', message='Entregável indisponível.'; end if;
  if delivery.updated_at is distinct from p_expected then
    raise exception using errcode='40001', message='O entregável mudou. Recarregue o projeto.';
  end if;
  if not admin and (delivery.status<>'client_review' or not cali_workspace.client_can_view_deliverable(p_delivery_id)) then
    raise exception using errcode='42501', message='O entregável não está disponível para revisão.';
  end if;

  case p_action
    when 'approve' then
      if coalesce(p_score,0) not between 1 and 5 or (p_score<=3 and coalesce(length(btrim(p_note)),0)<3) then
        raise exception using errcode='22023', message='Confira a avaliação e o comentário.';
      end if;
      select c.id into correction from cali_session_guard.phase4_delivery_corrections c
      where c.company_id=p_company_id and c.delivery_id=p_delivery_id and c.approved_at is null for update;
      if correction is null then
        perform cali_workspace.client_approve_deliverable_with_feedback(p_delivery_id,p_score,p_note);
      else
        approved_time := clock_timestamp();
        for timer_id in select t.id from cali_workspace.work_timers t where t.company_id=p_company_id
          and t.deliverable_id=p_delivery_id and t.status in ('active','paused') for update
        loop
          perform cali_workspace.close_timer_session_at(timer_id,approved_time,'timer_closed_by_client_approval',actor);
        end loop;
        update cali_session_guard.phase4_delivery_corrections set approved_by=actor,approved_at=approved_time,
          score=p_score,comment=nullif(btrim(p_note),'') where id=correction;
        update cali_workspace.deliverables set status='approved',client_response_at=approved_time,approved_at=approved_time,
          work_closed_at=coalesce(work_closed_at,approved_time),work_close_reason=coalesce(work_close_reason,'client_approval'),
          locked_at=approved_time,updated_at=approved_time where id=p_delivery_id;
        update cali_workspace.deliverable_tasks set status='done',completed_at=coalesce(completed_at,approved_time),
          work_closed_at=coalesce(work_closed_at,approved_time),work_close_reason=coalesce(work_close_reason,'client_approval')
        where deliverable_id=p_delivery_id and status<>'cancelled';
        insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
        values(p_company_id,actor,'deliverable_client_approved','deliverable',p_delivery_id,
          jsonb_build_object('correction_id',correction,'score',p_score,'comment_provided',nullif(btrim(p_note),'') is not null));
      end if;
    when 'adjust' then
      if coalesce(length(btrim(p_note)),0)<3 then raise exception using errcode='22023', message='Informe o ajuste.'; end if;
      perform cali_workspace.request_deliverable_adjustment(p_delivery_id,p_note,0);
    when 'status' then
      if p_status is null or p_status not in ('in_progress','internal_review','client_review','standby','rebriefing','cancelled')
        or p_status=delivery.status or delivery.status in ('approved','cancelled')
        or (p_status in ('standby','rebriefing','cancelled') and coalesce(length(btrim(p_note)),0)<3) then
        raise exception using errcode='22023', message='Transição indisponível.';
      end if;
      if p_status='client_review' then
        update cali_workspace.deliverables set client_visible=true where id=p_delivery_id;
      end if;
      perform cali_workspace.change_deliverable_status(p_delivery_id,p_status,p_note);
    when 'reopen' then
      if delivery.status<>'approved' or coalesce(length(btrim(p_note)),0)<3 then
        raise exception using errcode='22023', message='A reabertura exige aprovação anterior e motivo.';
      end if;
      if delivery.is_document or delivery.final_drive_url is not null
        or exists(select 1 from cali_workspace.files f where f.deliverable_id=p_delivery_id) then
        raise exception using errcode='22023', message='A reabertura deste item exige retirada dos arquivos publicados.';
      end if;
      insert into cali_session_guard.phase4_delivery_corrections(company_id,delivery_id,opened_by,reason,previous_approved_at)
      values(p_company_id,p_delivery_id,actor,btrim(p_note),delivery.approved_at);
      insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
      values(p_company_id,actor,'deliverable_reopened','deliverable',p_delivery_id,
        jsonb_build_object('reason',btrim(p_note),'previous_approval',delivery.approved_at,
          'previous_review_requested',delivery.approval_requested_at,'previous_client_response',delivery.client_response_at));
      update cali_workspace.deliverables set status='internal_review',client_visible=false,approved_at=null,
        approval_requested_at=null,client_response_at=null,locked_at=null,work_closed_at=null,
        work_close_reason=null,work_closed_by=null,updated_at=clock_timestamp()
      where id=p_delivery_id;
  end case;
  return p_delivery_id;
end;
$$;

create function cali_workspace.v2_pilot_project_lifecycle(
  p_company_id uuid,p_project_id uuid,p_expected text,p_action text,p_note text,p_resume date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  current_state text;
begin
  if p_action is null or p_action not in ('pause','suspend','cancel','resume')
    or coalesce(length(btrim(p_note)),0) not between 3 and 4000
    or (p_resume is not null and not isfinite(p_resume)) then
    raise exception using errcode='22023', message='Confira os dados da execução.';
  end if;
  select p.execution_status into current_state from cali_workspace.projects p
  where p.id=p_project_id and p.company_id=p_company_id and p.planning_status in ('active','rebriefing') for update;
  if not found then raise exception using errcode='42501', message='Projeto indisponível para execução.'; end if;
  if current_state is distinct from p_expected or current_state='cancelled'
    or (p_action='resume' and current_state not in ('paused','suspended'))
    or (p_action in ('pause','suspend') and current_state<>'normal') then
    raise exception using errcode='40001', message='A execução mudou de estado.';
  end if;
  perform cali_workspace.admin_set_project_lifecycle_v44(p_project_id,p_action,'project',null,btrim(p_note),p_resume);
  return p_project_id;
end;
$$;

revoke all on function cali_workspace.v2_pilot_delivery_action(uuid,uuid,uuid,timestamptz,text,text,text,integer),
  cali_workspace.v2_pilot_project_lifecycle(uuid,uuid,text,text,text,date) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_delivery_action(uuid,uuid,uuid,timestamptz,text,text,text,integer),
  cali_workspace.v2_pilot_project_lifecycle(uuid,uuid,text,text,text,date) to authenticated;
notify pgrst, 'reload schema';
commit;
