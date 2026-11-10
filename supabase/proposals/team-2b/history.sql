-- Movimentos e snapshots profissionais existentes. Sem valores privados ou novos fechamentos.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_read_pilot_team_history(
  p_company_id uuid,p_month date,p_member_id uuid,p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  if p_month is null or extract(day from p_month)<>1 or p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Período ou página inválidos.';
  end if;
  return (
    with events as (
      select t.id,t.member_id,m.full_name,t.created_at,
        case when t.after_state->>'archived_at' is not null and t.before_state->>'archived_at' is null then 'archived'
          when t.after_state ? 'archived_at' and t.after_state->>'archived_at' is null
            and t.before_state->>'archived_at' is not null then 'reactivated'
          else t.change_type end as kind
      from cali_workspace.team_changes t
      join cali_workspace.team_members m on m.id=t.member_id and m.company_id=t.company_id
      where t.company_id=p_company_id and t.reference_month=p_month
        and (p_member_id is null or t.member_id=p_member_id)
    ), page as (
      select * from events order by created_at desc,id limit 25 offset (p_page-1)*25
    ), snapshots as (
      select s.member_id,m.full_name,s.department,s.manager_code,s.job_title,s.status,
        s.admission_date,s.termination_date
      from cali_workspace.team_month_snapshots s
      join cali_workspace.team_members m on m.id=s.member_id and m.company_id=s.company_id
      where s.company_id=p_company_id and s.reference_month=p_month
        and (p_member_id is null or s.member_id=p_member_id)
    ), snapshot_page as (
      select * from snapshots order by full_name,member_id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object(
      'total',(select count(*) from events),
      'events',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb),
      'confirmed',exists(select 1 from cali_workspace.team_months where company_id=p_company_id and reference_month=p_month),
      'snapshotCount',(select count(*) from snapshots),
      'snapshots',coalesce((select jsonb_agg(to_jsonb(snapshot_page) order by full_name,member_id) from snapshot_page),'[]'::jsonb)
    )
  );
end;
$$;

create function cali_workspace.v2_read_pilot_team_structure(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  return (
    with groups as (
      select m.department, m.manager_code, g.full_name as manager_name, count(*) as total
      from cali_workspace.team_members m
      left join cali_workspace.team_members g on g.company_id=m.company_id and g.employee_code=m.manager_code
      where m.company_id=p_company_id and m.archived_at is null and m.status<>'terminated'
      group by m.department,m.manager_code,g.full_name
    )
    select coalesce(jsonb_agg(to_jsonb(groups) order by department,manager_name,manager_code),'[]'::jsonb)
    from groups
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_team_history(uuid,date,uuid,integer),
  cali_workspace.v2_read_pilot_team_structure(uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_team_history(uuid,date,uuid,integer),
  cali_workspace.v2_read_pilot_team_structure(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
