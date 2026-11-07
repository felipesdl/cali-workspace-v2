-- FLOW-05/06. Projeção de leitura do piloto. Sem alterar RLS, gatilhos ou dados legados.
begin;
set local lock_timeout = '5s';

create or replace function cali_workspace.v2_list_pilot_projects(p_company_id uuid, p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página de projetos inválida.';
  end if;
  return (
    with matched as (
      select p.id, p.name, p.protocol, p.planning_status, p.execution_status,
        p.roadmap_start_date, p.roadmap_end_date
      from cali_workspace.projects p
      where p.company_id=p_company_id and (admin or cali_workspace.client_can_view_project(p.id))
    ), page as (
      select * from matched order by name,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object(
      'companyId',p_company_id,'total',(select count(*) from matched),
      'projects',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb)
    )
  );
end;
$$;

create or replace function cali_workspace.v2_read_pilot_project(
  p_company_id uuid, p_project_id uuid, p_section text, p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000
    or p_section is null or p_section not in ('deliverables','workstreams') then
    raise exception using errcode='22023', message='Seleção de projeto inválida.';
  end if;
  return (
    select jsonb_build_object(
      'companyId',p_company_id,
      'project',jsonb_build_object('id',p.id,'name',p.name,'protocol',p.protocol,
        'description',p.description,'updated_at',p.updated_at,'planning_status',p.planning_status,'execution_status',p.execution_status,
        'roadmap_start_date',p.roadmap_start_date,'roadmap_end_date',p.roadmap_end_date),
      'review',(select jsonb_build_object('id',r.id,'status',r.status,'number',r.request_number,'dueAt',r.response_due_at,
        'pastDue',coalesce(r.status='pending' and r.response_due_at<=now(),false),
        'note',r.response_note,'changes',r.requested_changes)
        from cali_workspace.project_review_requests r
        where r.company_id=p_company_id and r.project_id=p.id
        order by r.request_number desc,r.created_at desc,r.id desc limit 1),
      'items',(
        with matched as (
          select d.id,d.title as name,d.protocol,d.status,d.execution_status,d.due_at,d.sort_order,d.updated_at,
            d.description,d.workstream_id,d.complexity
          from cali_workspace.deliverables d
          where p_section='deliverables' and d.company_id=p_company_id and d.project_id=p.id
            and (admin or cali_workspace.client_can_view_deliverable(d.id))
          union all
          select w.id,w.name,w.protocol,w.status,w.execution_status,null::timestamptz,w.sort_order,w.updated_at,
            w.objective,null::uuid,null::text
          from cali_workspace.project_workstreams w
          where p_section='workstreams' and w.company_id=p_company_id and w.project_id=p.id
        ), page as (
          select * from matched order by sort_order,id limit 25 offset (p_page-1)*25
        )
        select jsonb_build_object('total',(select count(*) from matched),
          'rows',coalesce((select jsonb_agg(to_jsonb(page) order by sort_order,id) from page),'[]'::jsonb))
      )
    )
    from cali_workspace.projects p
    where p.company_id=p_company_id and p.id=p_project_id
      and (admin or cali_workspace.client_can_view_project(p.id))
  );
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_projects(uuid,integer),
  cali_workspace.v2_read_pilot_project(uuid,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_projects(uuid,integer),
  cali_workspace.v2_read_pilot_project(uuid,uuid,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
