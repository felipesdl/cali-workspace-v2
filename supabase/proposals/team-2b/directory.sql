-- FLOW-08: leitura profissional no piloto A/B. Sem alteração em RLS ou GRANTs legados.
begin;
set local lock_timeout = '5s';

create function cali_session_guard.require_pilot_team_actor(p_company_id uuid)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from cali_session_guard.pilot_companies where company_id=p_company_id
  ) then
    raise exception using errcode='42501', message='Equipe indisponível.';
  end if;
  if exists (
    select 1 from cali_workspace.profiles where id=actor and active and role::text='admin'
  ) then
    perform cali_session_guard.require_pilot_admin_session();
  elsif not exists (
    select 1 from cali_session_guard.pilot_accounts a
    join cali_workspace.profiles p on p.id=a.profile_id and p.company_id=a.company_id
    where a.profile_id=actor and a.company_id=p_company_id and a.revoked_at is null
      and p.active and p.role::text='client'
      and cali_session_guard.session_is_live()
  ) then
    raise exception using errcode='42501', message='Equipe indisponível.';
  end if;
  if (cali_workspace.v2_read_terms_state()->>'accepted')::boolean is distinct from true then
    raise exception using errcode='42501', message='Equipe indisponível.';
  end if;
  return actor;
end;
$$;

create function cali_workspace.v2_list_pilot_team(
  p_company_id uuid, p_query text, p_status text, p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  term text := lower(btrim(coalesce(p_query,'')));
  result jsonb;
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  if length(term)>120 or p_page is null or p_page not between 1 and 10000
    or p_status is null or p_status not in ('all','active','leave','terminated','archived') then
    raise exception using errcode='22023', message='Filtros de Equipe inválidos.';
  end if;
  with matched as (
    select m.id, m.employee_code, m.full_name, m.job_title, m.department, m.manager_code,
      manager.full_name as manager_name, m.admission_date, m.status, m.archived_at
    from cali_workspace.team_members m
    left join cali_workspace.team_members manager
      on manager.company_id=m.company_id and manager.employee_code=m.manager_code
    where m.company_id=p_company_id
      and case when p_status='archived' then m.archived_at is not null
        else m.archived_at is null and (p_status='all' or m.status=p_status) end
      and (term='' or strpos(lower(m.full_name),term)>0 or strpos(lower(m.job_title),term)>0
        or strpos(lower(m.department),term)>0 or strpos(lower(m.employee_code),term)>0)
  ), page as (
    select * from matched order by full_name,id limit 25 offset (p_page-1)*25
  )
  select jsonb_build_object('companyId',p_company_id,'companyName',c.display_name,
    'total',(select count(*) from matched),
    'members',coalesce((select jsonb_agg(to_jsonb(page) order by full_name,id) from page),'[]'::jsonb))
  into result
  from cali_workspace.companies c where c.id=p_company_id;
  return result;
end;
$$;

create function cali_workspace.v2_read_pilot_team_member(p_company_id uuid,p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  return (
    select to_jsonb(professional) from (
      select id, company_id, employee_code, full_name, work_email, work_phone, admission_date,
        job_title, seniority, department, team_area, manager_code, is_leader, employment_type,
        weekly_hours, work_model, location, status, leave_reason, leave_start_date,
        expected_return_date, termination_date, termination_initiative, termination_reason,
        notice_type, archived_at, updated_at
      from cali_workspace.team_members where id=p_member_id and company_id=p_company_id
    ) professional
  );
end;
$$;

revoke all on function cali_session_guard.require_pilot_team_actor(uuid),
  cali_workspace.v2_list_pilot_team(uuid,text,text,integer),
  cali_workspace.v2_read_pilot_team_member(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_team(uuid,text,text,integer),
  cali_workspace.v2_read_pilot_team_member(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
