-- FLOW-07. As regras de ciclo, capacidade e arredondamento continuam nas funções instaladas.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_pilot_hour_action(
  p_company_id uuid, p_request_id uuid, p_action text, p_project_id uuid default null,
  p_timer_id uuid default null, p_date date default null, p_minutes integer default null,
  p_description text default null, p_note text default null, p_client_visible boolean default false
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  result_id uuid;
  timer_status text;
begin
  if p_request_id is null or p_action is null or p_action not in ('manual','start','pause','resume','stop')
    or length(p_description)>1000 or length(p_note)>1000 then
    raise exception using errcode='22023', message='Revise os dados de horas.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('hours',p_action,p_project_id,p_timer_id,p_date,
    p_minutes,p_description,p_note,p_client_visible)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-hours:'||p_company_id::text||':'||actor::text,0));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;

  if p_project_id is not null and not exists(select 1 from cali_workspace.projects p
    where p.id=p_project_id and p.company_id=p_company_id and cali_workspace.hour_project_operational(p.id)) then
    raise exception using errcode='42501', message='Projeto indisponível para horas.';
  end if;

  if p_action='manual' then
    if p_date is null or not isfinite(p_date) or coalesce(p_minutes,0) not between 1 and 1440
      or nullif(btrim(p_description),'') is null or nullif(btrim(p_note),'') is null then
      raise exception using errcode='22023', message='Informe data, minutos, descrição e justificativa.';
    end if;
    result_id := cali_workspace.add_manual_hour_entry(
      p_company_id,p_project_id,null,null,p_date,p_minutes,btrim(p_description),'Execução',btrim(p_note),
      coalesce(p_client_visible,false),null,null
    );
  elsif p_action='start' then
    if nullif(btrim(p_description),'') is null then
      raise exception using errcode='22023', message='Informe a descrição da atividade.';
    end if;
    result_id := cali_workspace.start_work_timer_v2(
      p_company_id,p_project_id,null,null,'Execução',btrim(p_description),coalesce(p_client_visible,false)
    );
  else
    select t.status into timer_status from cali_workspace.work_timers t
    where t.id=p_timer_id and t.company_id=p_company_id and t.user_id=actor for update;
    if not found then raise exception using errcode='42501', message='Timer indisponível.'; end if;
    if (p_action in ('pause','stop') and timer_status<>'active') or (p_action='resume' and timer_status<>'paused') then
      raise exception using errcode='40001', message='O timer mudou de estado.';
    end if;
    if p_action='resume' and exists(select 1 from cali_workspace.work_timers t
      where t.user_id=actor and t.company_id=p_company_id and t.status='active') then
      raise exception using errcode='40001', message='Pause o timer ativo antes de retomar outro.';
    end if;
    case p_action
      when 'pause' then perform cali_workspace.pause_work_timer(p_timer_id);
      when 'resume' then perform cali_workspace.resume_work_timer(p_timer_id);
      when 'stop' then perform cali_workspace.stop_work_timer(p_timer_id,null);
    end case;
    result_id := p_timer_id;
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

create function cali_workspace.v2_pilot_active_timers(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'description',t.description,
      'status',t.status,'startedAt',t.started_at) order by t.started_at desc,t.id),'[]'::jsonb)
    from cali_workspace.work_timers t where t.company_id=p_company_id and t.user_id=actor
      and t.status in ('active','paused')
  );
end;
$$;

revoke all on function cali_workspace.v2_pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_active_timers(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean),
  cali_workspace.v2_pilot_active_timers(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
