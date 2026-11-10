-- FLOW-07. As regras de ciclo, capacidade e arredondamento continuam nas funções instaladas.
begin;
set local lock_timeout = '5s';

-- A pausa legada fecha o trecho. A retomada usa outra sessão com o mesmo contexto.
create table if not exists cali_session_guard.phase4_hour_holds (
  timer_id uuid primary key references cali_workspace.work_timers(id) on delete cascade,
  company_id uuid not null,
  actor_id uuid not null,
  paused_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz
);
create unique index if not exists phase4_one_pending_hour_hold on cali_session_guard.phase4_hour_holds(company_id,actor_id)
where resolved_at is null;
alter table cali_session_guard.phase4_hour_holds enable row level security;
revoke all on cali_session_guard.phase4_hour_holds from public,anon,authenticated,service_role;

create or replace function cali_session_guard.pilot_hour_action(
  p_company_id uuid, p_request_id uuid, p_action text, p_project_id uuid default null,
  p_timer_id uuid default null, p_date date default null, p_minutes integer default null,
  p_description text default null, p_note text default null, p_client_visible boolean default false,
  p_deliverable_id uuid default null, p_task_id uuid default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  result_id uuid;
  timer cali_workspace.work_timers%rowtype;
  timer_project uuid;
  timer_record uuid;
  open_hold boolean;
begin
  if p_request_id is null or p_action is null or p_action not in ('manual','start','pause','resume','stop')
    or length(p_description)>1000 or length(p_note)>1000 then
    raise exception using errcode='22023', message='Revise os dados de horas.';
  end if;
  signature := sha256(convert_to((jsonb_build_array('hours',p_action,p_project_id,p_timer_id,p_date,
    p_minutes,p_description,p_note,p_client_visible)
    || case when p_deliverable_id is not null or p_task_id is not null
      then jsonb_build_array(p_deliverable_id,p_task_id) else '[]'::jsonb end)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-hours:'||p_company_id::text||':'||actor::text,0));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;

  if p_project_id is not null and not exists(select 1 from cali_workspace.projects p
    where p.id=p_project_id and p.company_id=p_company_id and cali_workspace.hour_project_operational(p.id)) then
    raise exception using errcode='42501', message='Projeto indisponível para horas.';
  end if;

  if p_deliverable_id is not null or p_task_id is not null then
    if p_project_id is null or p_deliverable_id is null or p_action not in ('manual','start') then
      raise exception using errcode='22023', message='Confira o projeto e o entregável.';
    end if;
    perform 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
      and cali_workspace.hour_project_operational(p.id)
      and (p_action='manual' or p.execution_status='normal') for share;
    if not found then raise exception using errcode='42501',message='Projeto indisponível para horas.'; end if;
    perform 1 from cali_workspace.deliverables d where d.id=p_deliverable_id and d.company_id=p_company_id
      and d.project_id=p_project_id and d.status not in ('approved','cancelled') and d.work_closed_at is null
      and (p_action='manual' or d.execution_status='normal') for update;
    if not found then raise exception using errcode='42501',message='Entregável indisponível para horas.'; end if;
    if p_task_id is not null then
      perform 1 from cali_workspace.deliverable_tasks t where t.id=p_task_id and t.company_id=p_company_id
        and t.deliverable_id=p_deliverable_id and t.status not in ('done','cancelled') and t.work_closed_at is null for update;
      if not found then raise exception using errcode='42501',message='Subtarefa indisponível para horas.'; end if;
    end if;
  end if;

  if p_action='manual' then
    if p_date is null or not isfinite(p_date) or coalesce(p_minutes,0) not between 1 and 1440
      or nullif(btrim(p_description),'') is null or nullif(btrim(p_note),'') is null then
      raise exception using errcode='22023', message='Informe data, minutos, descrição e justificativa.';
    end if;
    result_id := cali_workspace.add_manual_hour_entry(
      p_company_id,p_project_id,p_deliverable_id,p_task_id,p_date,p_minutes,btrim(p_description),'Execução',btrim(p_note),
      coalesce(p_client_visible,false),null,null
    );
  elsif p_action='start' then
    if exists(select 1 from cali_workspace.work_timers t where t.user_id=actor and t.company_id=p_company_id
      and t.status in ('active','paused')) or exists(select 1 from cali_session_guard.phase4_hour_holds h
      where h.actor_id=actor and h.company_id=p_company_id and h.resolved_at is null) then
      raise exception using errcode='40001', message='Conclua o timer aberto antes de iniciar outro.';
    end if;
    if p_project_id is not null then
      perform 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
        and p.execution_status='normal' for share;
      if not found then raise exception using errcode='42501',message='Retome a execução do projeto antes de iniciar.'; end if;
    end if;
    if nullif(btrim(p_description),'') is null then
      raise exception using errcode='22023', message='Informe a descrição da atividade.';
    end if;
    result_id := cali_workspace.start_work_timer_v2(
      p_company_id,p_project_id,p_deliverable_id,p_task_id,'Execução',btrim(p_description),coalesce(p_client_visible,false)
    );
  else
    select t.project_id,t.account_record_id into timer_project,timer_record from cali_workspace.work_timers t
    where t.id=p_timer_id and t.company_id=p_company_id and t.user_id=actor;
    if not found then raise exception using errcode='42501', message='Timer indisponível.'; end if;
    -- Respeita a ordem projeto → timer usada por ciclo e aprovação de entregável.
    if timer_project is not null then
      perform 1 from cali_workspace.projects p where p.id=timer_project and p.company_id=p_company_id
        and (p_action<>'resume' or p.execution_status='normal') for share;
      if not found then raise exception using errcode='42501',message='Retome a execução do projeto antes do timer.'; end if;
    end if;
    if p_action='resume' and timer_record is not null then
      perform 1 from cali_workspace.account_records r where r.id=timer_record and r.company_id=p_company_id
        and r.project_id is not distinct from timer_project
        and r.workflow_status not in ('completed','cancelled') for update;
      if not found then raise exception using errcode='42501',message='A ocorrência não aceita novas horas.'; end if;
    end if;
    select * into timer from cali_workspace.work_timers t where t.id=p_timer_id
      and t.company_id=p_company_id and t.user_id=actor for update;
    if not found or timer.project_id is distinct from timer_project
      or timer.account_record_id is distinct from timer_record then
      raise exception using errcode='40001',message='O timer mudou de contexto.';
    end if;
    open_hold := exists(select 1 from cali_session_guard.phase4_hour_holds h where h.timer_id=timer.id
      and h.company_id=p_company_id and h.actor_id=actor and h.resolved_at is null);
    result_id := p_timer_id;
    case p_action
      when 'pause' then
        if timer.status<>'active' then raise exception using errcode='40001',message='O timer mudou de estado.'; end if;
        perform cali_workspace.pause_work_timer(timer.id);
        if exists(select 1 from cali_workspace.work_timers t where t.id=timer.id and t.status in ('stopped','discarded')) then
          insert into cali_session_guard.phase4_hour_holds(timer_id,company_id,actor_id) values(timer.id,p_company_id,actor);
        end if;
      when 'resume' then
        if timer.deliverable_id is not null and not exists(select 1 from cali_workspace.deliverables d
          where d.id=timer.deliverable_id and d.company_id=p_company_id and d.execution_status='normal'
            and d.status not in ('approved','cancelled') and d.work_closed_at is null) then
          raise exception using errcode='42501',message='Retome a execução do entregável antes do timer.';
        end if;
        if timer.task_id is not null and not exists(select 1 from cali_workspace.deliverable_tasks t
          where t.id=timer.task_id and t.deliverable_id=timer.deliverable_id and t.company_id=p_company_id
            and t.status not in ('done','cancelled') and t.work_closed_at is null) then
          raise exception using errcode='42501',message='A subtarefa já foi encerrada.';
        end if;
        if exists(select 1 from cali_workspace.work_timers t where t.user_id=actor and t.company_id=p_company_id
          and t.status in ('active','paused') and t.id<>timer.id) then
          raise exception using errcode='40001',message='Conclua o outro timer antes de retomar.';
        end if;
        if open_hold and timer.status in ('stopped','discarded') then
          if timer_record is not null then
            result_id := cali_workspace.start_account_record_timer(timer_record);
          else
            result_id := cali_workspace.start_work_timer_v2(p_company_id,timer.project_id,timer.deliverable_id,
              timer.task_id,timer.category,timer.description,timer.client_visible);
          end if;
          update cali_session_guard.phase4_hour_holds set resolved_at=clock_timestamp() where timer_id=timer.id;
        elsif timer.status='paused' then
          perform cali_workspace.resume_work_timer(timer.id);
        else
          raise exception using errcode='40001',message='O timer mudou de estado.';
        end if;
      when 'stop' then
        if open_hold then
          update cali_session_guard.phase4_hour_holds set resolved_at=clock_timestamp() where timer_id=timer.id;
        elsif timer.status='active' then
          perform cali_workspace.stop_work_timer(timer.id,null);
        else
          raise exception using errcode='40001',message='O timer mudou de estado.';
        end if;
    end case;
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

create or replace function cali_workspace.v2_start_pilot_record_timer(
  p_company_id uuid,p_request_id uuid,p_record_id uuid
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  result_id uuid;
  record_project uuid;
begin
  if p_request_id is null or p_record_id is null then
    raise exception using errcode='22023',message='Informe a ocorrência.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('record-timer',p_record_id)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-hours:'||p_company_id::text||':'||actor::text,0));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;

  select r.project_id into record_project from cali_workspace.account_records r
  where r.id=p_record_id and r.company_id=p_company_id;
  if record_project is not null then
    perform 1 from cali_workspace.projects p where p.id=record_project and p.company_id=p_company_id
      and p.execution_status='normal' and cali_workspace.hour_project_operational(p.id) for share;
    if not found then raise exception using errcode='42501',message='Projeto indisponível para horas.'; end if;
  end if;
  perform 1 from cali_workspace.account_records r where r.id=p_record_id and r.company_id=p_company_id
    and r.project_id is not distinct from record_project
    and r.workflow_status not in ('completed','cancelled') for update;
  if not found then raise exception using errcode='42501',message='A ocorrência não aceita novas horas.'; end if;
  if exists(select 1 from cali_workspace.work_timers t where t.user_id=actor and t.company_id=p_company_id
    and t.status in ('active','paused')) or exists(select 1 from cali_session_guard.phase4_hour_holds h
    where h.actor_id=actor and h.company_id=p_company_id and h.resolved_at is null) then
    raise exception using errcode='40001',message='Conclua o timer aberto antes de iniciar outro.';
  end if;
  result_id := cali_workspace.start_account_record_timer(p_record_id);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

revoke all on function cali_workspace.v2_start_pilot_record_timer(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_start_pilot_record_timer(uuid,uuid,uuid) to authenticated;

revoke all on function cali_session_guard.pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean,uuid,uuid)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_pilot_hour_action(
  p_company_id uuid,p_request_id uuid,p_action text,p_project_id uuid default null,
  p_timer_id uuid default null,p_date date default null,p_minutes integer default null,
  p_description text default null,p_note text default null,p_client_visible boolean default false
)
returns uuid language sql security definer set search_path=''
as $$
  select cali_session_guard.pilot_hour_action(p_company_id,p_request_id,p_action,p_project_id,
    p_timer_id,p_date,p_minutes,p_description,p_note,p_client_visible);
$$;

create or replace function cali_workspace.v2_pilot_linked_hour_action(
  p_company_id uuid,p_request_id uuid,p_action text,p_project_id uuid,p_deliverable_id uuid,p_task_id uuid,
  p_date date,p_minutes integer,p_description text,p_note text,p_client_visible boolean
)
returns uuid language sql security definer set search_path=''
as $$
  select cali_session_guard.pilot_hour_action(p_company_id,p_request_id,p_action,p_project_id,
    null,p_date,p_minutes,p_description,p_note,p_client_visible,p_deliverable_id,p_task_id);
$$;

create or replace function cali_workspace.v2_pilot_hour_link(p_company_id uuid,p_deliverable_id uuid,p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  return (
    select jsonb_build_object('project',p.id,'projectName',p.name,'delivery',d.id,'deliveryName',d.title,
      'task',t.id,'taskName',t.title,'canStart',p.execution_status='normal' and d.execution_status='normal')
    from cali_workspace.deliverables d
    join cali_workspace.projects p on p.id=d.project_id and p.company_id=d.company_id
    left join cali_workspace.deliverable_tasks t on t.id=p_task_id and t.deliverable_id=d.id
      and t.company_id=d.company_id and t.status not in ('done','cancelled') and t.work_closed_at is null
    where d.id=p_deliverable_id and d.company_id=p_company_id and d.status not in ('approved','cancelled')
      and d.work_closed_at is null and cali_workspace.hour_project_operational(p.id)
      and (p_task_id is null or t.id is not null)
  );
end;
$$;

revoke all on function cali_workspace.v2_pilot_linked_hour_action(uuid,uuid,text,uuid,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_hour_link(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_linked_hour_action(uuid,uuid,text,uuid,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_hour_link(uuid,uuid,uuid) to authenticated;

create or replace function cali_workspace.v2_pilot_active_timers(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'description',t.description,
      'status',case when h.timer_id is not null then 'paused' else t.status end,'startedAt',t.started_at,
      'closedSegment',h.timer_id is not null) order by t.started_at desc,t.id),'[]'::jsonb)
    from cali_workspace.work_timers t left join cali_session_guard.phase4_hour_holds h
      on h.timer_id=t.id and h.company_id=t.company_id and h.actor_id=t.user_id and h.resolved_at is null
    where t.company_id=p_company_id and t.user_id=actor and (t.status in ('active','paused') or h.timer_id is not null)
  );
end;
$$;

revoke all on function cali_workspace.v2_pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_active_timers(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_active_timers(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
