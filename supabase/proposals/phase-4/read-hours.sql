-- FLOW-07. Extrato visível e resumo de capacidade do mesmo período.
begin;
set local lock_timeout = '5s';

create or replace function cali_workspace.v2_read_pilot_hours(p_company_id uuid, p_month date, p_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone='UTC'
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  can_correct boolean := admin and to_regprocedure(
    'cali_workspace.v2_correct_pilot_hour(uuid,uuid,uuid,text,text,text,date,integer,text,boolean)'
  ) is not null;
begin
  if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1
    or p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Período ou página de horas inválidos.';
  end if;
  if not admin and not coalesce(cali_workspace.client_hours_enabled_for_period(p_company_id,p_month),false) then
    return jsonb_build_object('companyId',p_company_id,'month',p_month,'visible',false);
  end if;
  return (
    with matched as (
      select h.id,h.work_date,h.minutes,h.description,h.category,
        case when admin then h.internal_note end as internal_note,
        case when can_correct then h.client_visible end as "clientVisible",
        case when can_correct then encode(sha256(convert_to(to_jsonb(h)::text,'UTF8')),'hex') end as "editVersion"
      from cali_workspace.hour_entries h
      where h.company_id=p_company_id and h.work_date>=p_month
        and h.work_date<(p_month+interval '1 month')::date
        and (admin or (h.client_visible and cali_workspace.hour_project_operational(h.project_id)))
    ), page as (
      select * from matched order by work_date desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'month',p_month,'visible',true,
      'total',(select count(*) from matched),'minutes',(select coalesce(sum(minutes),0) from matched),
      'capacity',jsonb_build_object(
        'contractedMinutes',case when capacity.contracted_minutes>0 then capacity.contracted_minutes end,
        'consumedMinutes',capacity.used_minutes,
        'remainingMinutes',case when capacity.contracted_minutes>0
          then greatest(0,capacity.contracted_minutes-capacity.used_minutes) end,
        'overMinutes',case when capacity.contracted_minutes>0
          then greatest(0,capacity.used_minutes-capacity.contracted_minutes) end
      ),
      'capacityControl',case when admin and to_regprocedure(
        'cali_workspace.v2_set_pilot_capacity_pause(uuid,date,uuid,timestamptz,boolean)'
      ) is not null then jsonb_build_object(
        'version',(select coalesce(p.resumed_at,p.paused_at) from cali_workspace.capacity_pauses p
          where p.company_id=p_company_id and p.month=p_month),
        'canPause',coalesce(capacity.contracted_minutes>0 and capacity.used_minutes>capacity.contracted_minutes,false)
      ) end,
      'capacityHistory',jsonb_build_object(
        'paused',exists(select 1 from cali_workspace.capacity_pauses p
          where p.company_id=p_company_id and p.month=p_month and p.resumed_at is null),
        'milestones',coalesce((select jsonb_agg(jsonb_build_object(
          'kind',e.kind,'percent',e.percent,'at',e.created_at,'occurrence',e.occurrence_number)
          order by e.created_at,e.id)
          from cali_workspace.capacity_events e where e.company_id=p_company_id and e.month=p_month
            and (e.kind in ('m75','m100','excess') or (admin and e.kind in ('tolerance','review')))
          ),
          '[]'::jsonb)
      ),
      'entries',coalesce((select jsonb_agg(jsonb_strip_nulls(to_jsonb(page)) order by work_date desc,id) from page),'[]'::jsonb))
    from cali_workspace.capacity_month(p_company_id,p_month) capacity
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_hours(uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_hours(uuid,date,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
