-- FLOW-05/06. Histórico e detalhe paginados sem notas internas para Cliente.
begin;
set local lock_timeout = '5s';
create function cali_workspace.v2_read_pilot_project_journal(
  p_company_id uuid,p_project_id uuid,p_section text,p_page integer,
  p_delivery_id uuid default null,p_task_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 or p_section is null
    or p_section not in ('schedule','lifecycle','tasks','conversation','dependencies','delivery-history')
    or (p_section in ('schedule','lifecycle'))<>(p_delivery_id is null)
    or (p_task_id is not null and p_section<>'conversation') then
    raise exception using errcode='22023',message='Seleção do histórico inválida.';
  end if;
  if not exists(select 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
    and (admin or cali_workspace.client_can_view_project(p.id))) then return null; end if;
  if p_delivery_id is not null and not exists(select 1 from cali_workspace.deliverables d
    where d.id=p_delivery_id and d.company_id=p_company_id and d.project_id=p_project_id
    and (admin or cali_workspace.client_can_view_deliverable(d.id))) then return null; end if;
  if p_task_id is not null and not exists(select 1 from cali_workspace.deliverable_tasks t
    where t.id=p_task_id and t.deliverable_id=p_delivery_id and t.company_id=p_company_id
    and (admin or t.client_visible)) then return null; end if;

  return (
    with matched as (
      select r.id::text as id,r.request_number as position,r.created_at as instant,
        jsonb_build_object('id',r.id,'number',r.request_number,'status',r.status,'dueAt',r.response_due_at,
          'note',r.response_note,'resolution',r.resolution_note,'target',r.requested_changes->>'targetLabel') as row
      from cali_workspace.project_review_requests r where p_section='schedule'
        and r.company_id=p_company_id and r.project_id=p_project_id
      union all
      select l.id::text,0,l.created_at,jsonb_build_object('id',l.id,'action',l.action,
        'scope',coalesce(l.scope_label,'Projeto'),'at',l.created_at,'resume',l.resume_date,'note',case when admin then l.reason end)
      from cali_workspace.project_lifecycle_events l where p_section='lifecycle'
        and l.company_id=p_company_id and l.project_id=p_project_id and (admin or l.client_visible)
      union all
      select t.id::text,-t.sort_order,t.created_at,jsonb_build_object('id',t.id,'title',t.title,
        'description',t.description,'status',t.status,'due',t.due_at,'visible',t.client_visible,'updatedAt',t.updated_at,
        'complexity',t.complexity,'adjustments',coalesce(t.adjustment_count,0),'estimatedMinutes',case when admin then t.estimated_minutes end,
        'assignee',case when admin then t.assigned_user_id end)
      from cali_workspace.deliverable_tasks t where p_section='tasks'
        and t.company_id=p_company_id and t.deliverable_id=p_delivery_id and (admin or t.client_visible)
      union all
      select c.id::text,0,c.created_at,jsonb_build_object('id',c.id,'body',c.body,'role',coalesce(c.source_actor,'system'),
        'at',c.created_at,'internal',not coalesce(c.client_visible,false))
      from cali_workspace.comments c where p_section='conversation' and p_task_id is null
        and c.company_id=p_company_id and c.target_type='deliverable' and c.target_id=p_delivery_id
        and (admin or c.client_visible)
      union all
      select m.id::text,0,m.created_at,jsonb_build_object('id',m.id,'body',m.body,'role',m.author_role,
        'at',m.created_at,'internal',not coalesce(m.client_visible,false))
      from cali_workspace.task_messages m where p_section='conversation' and m.task_id=p_task_id
        and m.company_id=p_company_id and m.deliverable_id=p_delivery_id and (admin or m.client_visible)
      union all
      select d.id::text,0,d.created_at,jsonb_build_object('id',d.id,'title',d.title,'due',d.due_date,
        'status',d.status,'receivedAt',d.received_at)
      from cali_workspace.deliverable_client_dependencies d where p_section='dependencies'
        and d.company_id=p_company_id and d.deliverable_id=p_delivery_id
      union all
      select 'status-'||h.id::text,0,h.created_at,jsonb_build_object('id','status-'||h.id::text,
        'event','status','status',h.to_status,'at',h.created_at,'note',case when admin then h.note end,
        'previousDue',null,'nextDue',null,'score',null)
      from cali_workspace.deliverable_status_history h where p_section='delivery-history'
        and h.company_id=p_company_id and h.deliverable_id=p_delivery_id
        and (admin or h.to_status in ('client_review','adjustment_requested','approved','cancelled'))
      union all
      select 'due-'||v.id::text,0,v.created_at,jsonb_build_object('id','due-'||v.id::text,
        'event','deadline','status',v.cause,'at',v.created_at,'note',case when admin then v.reason end,
        'previousDue',v.previous_due,'nextDue',v.new_due,'score',null)
      from cali_workspace.deliverable_due_revisions v where p_section='delivery-history'
        and v.company_id=p_company_id and v.deliverable_id=p_delivery_id
      union all
      select 'correction-'||c.id::text,0,c.opened_at,jsonb_build_object('id','correction-'||c.id::text,
        'event','correction','status',null,'at',c.opened_at,'note',case when admin then c.reason end,
        'previousDue',null,'nextDue',null,'score',null)
      from cali_session_guard.phase4_delivery_corrections c where p_section='delivery-history'
        and c.company_id=p_company_id and c.delivery_id=p_delivery_id
      union all
      select 'approval-'||c.id::text,0,c.approved_at,jsonb_build_object('id','approval-'||c.id::text,
        'event','correction-approval','status',null,'at',c.approved_at,'note',case when admin then c.comment end,
        'previousDue',null,'nextDue',null,'score',case when admin then c.score end)
      from cali_session_guard.phase4_delivery_corrections c where p_section='delivery-history'
        and c.company_id=p_company_id and c.delivery_id=p_delivery_id and c.approved_at is not null
    ), page as (
      select * from matched order by position desc,instant desc,id desc limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'projectId',p_project_id,'deliveryId',p_delivery_id,
      'section',p_section,'total',(select count(*) from matched),
      'rows',coalesce((select jsonb_agg(row order by position desc,instant desc,id desc) from page),'[]'::jsonb),
      'assignees',case when admin and p_section='tasks' then coalesce((select jsonb_agg(to_jsonb(a)) from (
        select id,coalesce(nullif(full_name,''),'Admin CALI') as name from cali_workspace.profiles
        where active and role::text='admin' order by full_name,id limit 50
      ) a),'[]'::jsonb) else '[]'::jsonb end)
  );
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_project_journal(uuid,uuid,text,integer,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_project_journal(uuid,uuid,text,integer,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
