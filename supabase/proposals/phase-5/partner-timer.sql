-- Aplicar após partner-pilot e partner-hour-review. Somente convites sintéticos do piloto.
create table if not exists cali_session_guard.phase5_partner_timers (
  timer_id uuid primary key references cali_workspace.work_timers(id) on delete cascade,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id)
);
alter table cali_session_guard.phase5_partner_timers enable row level security;
revoke all on cali_session_guard.phase5_partner_timers from public,anon,authenticated,service_role;

create or replace function cali_session_guard.require_phase5_partner(p_company uuid,p_module text)
returns jsonb language plpgsql stable set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
begin
  if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text
    or not coalesce((access->'modules') ? p_module,false) then
    raise exception using errcode='42501',message='Módulo indisponível.';
  end if;
  return access;
end;
$$;

create or replace function cali_session_guard.phase5_partner_hour_targets(p_company uuid)
returns table(kind text,id uuid,title text,project_id uuid,delivery_id uuid,task_id uuid,record_id uuid)
language sql stable set search_path='' as $$
  with projects as (
    select p.id,p.name
    from cali_workspace.projects p
    join cali_session_guard.phase4_project_qa q on q.company_id=p.company_id and q.project_id=p.id
    where p.company_id=p_company and p.execution_status='normal'
      and cali_workspace.hour_project_operational(p.id)
  ), deliveries as (
    select d.id,d.title,d.project_id from cali_workspace.deliverables d join projects p on p.id=d.project_id
    where d.company_id=p_company and d.execution_status='normal'
      and d.status not in ('approved','cancelled') and d.work_closed_at is null
  )
  select 'project',p.id,p.name,p.id,null::uuid,null::uuid,null::uuid from projects p
  union all
  select 'delivery',d.id,p.name||' / '||d.title,d.project_id,d.id,null::uuid,null::uuid
    from deliveries d join projects p on p.id=d.project_id
  union all
  select 'task',t.id,p.name||' / '||d.title||' / '||t.title,d.project_id,d.id,t.id,null::uuid
    from cali_workspace.deliverable_tasks t join deliveries d on d.id=t.deliverable_id
    join projects p on p.id=d.project_id where t.company_id=p_company
      and t.status not in ('done','cancelled') and t.work_closed_at is null
  union all
  select 'record',r.id,r.title,r.project_id,null::uuid,null::uuid,r.id
    from cali_workspace.account_records r
    join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
    where r.company_id=p_company and r.visibility='client' and r.workflow_status not in ('completed','cancelled')
      and (r.project_id is null or exists(select 1 from projects p where p.id=r.project_id))
$$;

create or replace function cali_workspace.v2_read_partner_pilot_timer(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb:=cali_session_guard.require_phase5_partner(p_company,'hours');
  invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
begin
  return jsonb_build_object('active',(
    select jsonb_build_object('id',t.id,'description',t.description,'startedAt',t.started_at,
      'lastSeenAt',coalesce(t.last_seen_at,t.started_at))
    from cali_workspace.work_timers t join cali_session_guard.phase5_partner_timers p on p.timer_id=t.id
    where t.company_id=p_company and t.user_id=auth.uid() and t.status='active' and p.invite_id=invitation.id
  ),'recoveryPending',exists(
    select 1 from cali_session_guard.phase5_partner_hours h
    join cali_workspace.activity_log l on l.entity_id=h.timer_id and l.entity_type='work_timer'
    where h.company_id=p_company and h.actor_id=auth.uid() and h.invite_id=invitation.id
      and h.status='pending' and h.adjustment_request_id is null
      and l.event_type='partner_pilot_timer_queued'
      and l.metadata->>'closing_event'='timer_auto_paused_inactivity'
  ),'targets',coalesce((
    select jsonb_agg(to_jsonb(x) order by x.title,x.kind,x.id) from (
      select h.kind,h.id,h.title from cali_session_guard.phase5_partner_hour_targets(p_company) h
      where case when h.kind='record' then (access->'modules') ? 'records' else (access->'modules') ? 'projects' end
      order by h.title,h.kind,h.id limit 200
    ) x
  ),'[]'::jsonb));
end;
$$;

-- Atualiza presença somente após interação explícita na tela; o servidor limita a 1 evento/90 s.
create or replace function cali_workspace.v2_touch_partner_pilot_timer(p_company uuid,p_timer uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  touched uuid;
begin
  perform cali_session_guard.require_phase5_partner(p_company,'hours');
  update cali_workspace.work_timers t set last_seen_at=clock_timestamp()
    from cali_session_guard.phase5_partner_timers p
    where t.id=p_timer and t.company_id=p_company and t.user_id=auth.uid()
      and t.status='active' and p.timer_id=t.id and p.invite_id=invitation.id
      and t.last_seen_at<=clock_timestamp()-interval '90 seconds'
    returning t.id into touched;
  if touched is null then return false; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,auth.uid(),'partner_pilot_timer_activity','work_timer',touched,
      jsonb_build_object('source','explicit_workspace_interaction'));
  return true;
end;
$$;

create or replace function cali_workspace.v2_change_partner_pilot_timer(
  p_company uuid,p_request uuid,p_action text,p_timer uuid,p_kind text,p_target uuid,p_description text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  access jsonb:=cali_session_guard.require_phase5_partner(p_company,'hours');
  invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  actor uuid:=auth.uid();
  target record;
  active cali_workspace.work_timers;
  result uuid;
  submission uuid;
  cycle uuid;
  ended timestamptz;
  seconds integer;
  duration integer;
  description text:=nullif(btrim(p_description),'');
  signature bytea;
begin
  if p_request is null or p_action is null or p_action not in ('start','stop') then
    raise exception using errcode='22023',message='Confira a operação do cronômetro.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('phase5-timer',invitation.id,p_action,p_timer,p_kind,p_target,description)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase5-timer:'||actor::text,0));
  result:=cali_session_guard.read_phase4_receipt(actor,p_company,p_request,signature);
  if result is null and p_action='start' then
    if p_timer is not null or coalesce(length(description),0) not between 3 and 500
      or (p_kind is null)<>(p_target is null) then
      raise exception using errcode='22023',message='Confira a descrição e o vínculo.';
    end if;
    if p_kind is not null then
      if not coalesce((access->'modules') ? (case when p_kind='record' then 'records' else 'projects' end),false) then
        raise exception using errcode='42501',message='Vínculo indisponível.';
      end if;
      select * into target from cali_session_guard.phase5_partner_hour_targets(p_company) h
        where h.kind=p_kind and h.id=p_target;
      if not found then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
      -- Ordem dos locks da operação de horas: projeto, entregável, subtarefa ou ocorrência.
      if target.project_id is not null then
        perform 1 from cali_workspace.projects where id=target.project_id for share;
      end if;
      if target.delivery_id is not null then
        select cycle_id into cycle from cali_workspace.deliverables where id=target.delivery_id for share;
      end if;
      if target.task_id is not null then
        perform 1 from cali_workspace.deliverable_tasks where id=target.task_id for share;
      end if;
      if target.record_id is not null then
        perform 1 from cali_workspace.account_records where id=target.record_id for share;
      end if;
      perform 1 from cali_session_guard.phase5_partner_hour_targets(p_company) h
        where h.kind=p_kind and h.id=p_target and
          row(h.project_id,h.delivery_id,h.task_id,h.record_id) is not distinct from
          row(target.project_id,target.delivery_id,target.task_id,target.record_id);
      if not found then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
    else
      select null::uuid as project_id,null::uuid as delivery_id,null::uuid as task_id,null::uuid as record_id into target;
    end if;
    if exists(select 1 from cali_workspace.work_timers t where t.user_id=actor and t.status in ('active','paused')) then
      raise exception using errcode='40001',message='Encerre o cronômetro atual antes de iniciar outro.';
    end if;
    insert into cali_workspace.work_timers(company_id,project_id,deliverable_id,task_id,account_record_id,
      cycle_id,user_id,category,description,client_visible,status,last_seen_at)
    values(p_company,target.project_id,target.delivery_id,target.task_id,target.record_id,
      cycle,actor,'Execução',description,false,'active',clock_timestamp()) returning id into result;
    insert into cali_session_guard.phase5_partner_timers values(result,invitation.id);
  elsif result is null then
    if p_timer is null or p_kind is not null or p_target is not null or description is not null then
      raise exception using errcode='22023',message='Confira o cronômetro a encerrar.';
    end if;
    select t.* into active from cali_workspace.work_timers t
      join cali_session_guard.phase5_partner_timers p on p.timer_id=t.id
      where t.id=p_timer and t.company_id=p_company and t.user_id=actor
        and p.invite_id=invitation.id and t.status='active' for update of t;
    if not found then raise exception using errcode='42501',message='Cronômetro indisponível.'; end if;
    ended:=clock_timestamp();
    seconds:=greatest(0,floor(extract(epoch from (ended-active.started_at)))::integer);
    duration:=case when seconds<30 then 0 else least(1440,ceil(seconds/60.0)::integer) end;
    if duration>0 then
      submission:=cali_session_guard.enqueue_phase5_partner_timer(
        active,invitation.id,ended,duration,'Trecho registrado pelo cronômetro.'
      );
      update cali_workspace.work_timers set status='stopped',stopped_at=ended,minutes=duration where id=p_timer;
    else
      update cali_workspace.work_timers set status='discarded',stopped_at=ended,minutes=0 where id=p_timer;
    end if;
    result:=p_timer;
  end if;
  if not exists(select 1 from cali_session_guard.phase4_operation_receipts
    where actor_id=actor and company_id=p_company and request_id=p_request) then
    insert into cali_session_guard.phase4_operation_receipts values(actor,p_company,p_request,signature,result);
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
      values(p_company,actor,'partner_pilot_timer_'||p_action,'work_timer',result,
        jsonb_build_object('submission_id',submission,'minutes',duration));
  end if;
  return (select jsonb_build_object('id',t.id,'status',t.status,'minutes',t.minutes)
    from cali_workspace.work_timers t where t.id=result);
end;
$$;

revoke all on function cali_session_guard.require_phase5_partner(uuid,text),
  cali_session_guard.phase5_partner_hour_targets(uuid),
  cali_workspace.v2_read_partner_pilot_timer(uuid),
  cali_workspace.v2_touch_partner_pilot_timer(uuid,uuid),
  cali_workspace.v2_change_partner_pilot_timer(uuid,uuid,text,uuid,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_partner_pilot_timer(uuid),
  cali_workspace.v2_touch_partner_pilot_timer(uuid,uuid),
  cali_workspace.v2_change_partner_pilot_timer(uuid,uuid,text,uuid,text,uuid,text) to authenticated;

-- Os caminhos antigos também enxergam work_timers. Restringir somente timers inscritos no piloto.
do $$
declare
  legacy_stop regprocedure:=to_regprocedure('cali_workspace.partner_stop_timer(uuid,text)');
  legacy_close regprocedure:=to_regprocedure('cali_workspace.close_timer_session_at(uuid,timestamptz,text,uuid)');
  legacy_idle regprocedure:=to_regprocedure('cali_workspace.close_stale_timers(interval)');
  definition text;
  anchor text;
begin
  if legacy_stop is not null then
    definition:=pg_get_functiondef(legacy_stop);
    anchor:=$anchor$  if v_timer.status not in ('active', 'paused')$anchor$;
    if strpos(definition,'Cronômetro do piloto: encerre pelo Workspace V2.')=0 then
      if strpos(definition,anchor)=0 then raise exception 'Confira a preimagem de partner_stop_timer.'; end if;
      execute replace(definition,anchor,$replacement$  if exists(
    select 1 from cali_session_guard.phase5_partner_timers p where p.timer_id=p_timer_id
  ) then
    raise exception 'Cronômetro do piloto: encerre pelo Workspace V2.' using errcode='42501';
  end if;
  if v_timer.status not in ('active', 'paused')$replacement$);
    end if;
  end if;
  if legacy_close is not null then
    definition:=pg_get_functiondef(legacy_close);
    anchor:=$anchor$  insert into cali_workspace.hour_entries($anchor$;
    if strpos(definition,'enqueue_phase5_partner_timer')=0 then
      if strpos(definition,anchor)=0 or strpos(definition,'v_raw_seconds')=0
        then raise exception 'Confira a preimagem de close_timer_session_at.'; end if;
      execute replace(definition,anchor,$replacement$  if exists(
    select 1 from cali_session_guard.phase5_partner_timers p where p.timer_id=v.id
  ) then
    v.description := v_description;
    v_minutes := least(v_minutes,1440);
    update cali_workspace.work_timers set minutes=v_minutes where id=v.id;
    v_entry_id := cali_session_guard.enqueue_phase5_partner_timer(
      v, (select p.invite_id from cali_session_guard.phase5_partner_timers p where p.timer_id=v.id),
      v_end, v_minutes, 'Trecho encerrado pelo Workspace. Revise o tempo registrado.'
    );
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(v.company_id,coalesce(p_actor_user_id,auth.uid()),'partner_pilot_timer_queued','work_timer',v.id,
      jsonb_build_object('submission_id',v_entry_id,'minutes',v_minutes,'closing_event',p_event_type));
    return v_minutes;
  end if;

  insert into cali_workspace.hour_entries($replacement$);
    end if;
  end if;
  if legacy_idle is not null then
    if legacy_close is null then raise exception 'Confira a preimagem de close_timer_session_at.'; end if;
    definition:=pg_get_functiondef(legacy_idle);
    anchor:=$anchor$    if v_role = 'partner' then
      v_seconds :=$anchor$;
    if strpos(definition,'cali_session_guard.phase5_partner_timers')=0 then
      if strpos(definition,anchor)=0 then raise exception 'Confira a preimagem de close_stale_timers.'; end if;
      execute replace(definition,anchor,$replacement$    if exists(
      select 1 from cali_session_guard.phase5_partner_timers p where p.timer_id=t.id
    ) then
      perform cali_workspace.close_timer_session_at(t.id,v_until,'timer_auto_paused_inactivity',t.user_id);
      v_role := 'partner';
    elsif v_role = 'partner' then
      v_seconds :=$replacement$);
    end if;
  end if;
end;
$$;
notify pgrst,'reload schema';
