-- FLOW-12. Agregados das fontes que a empresa já pode consultar, congelados na aprovação.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_report_client_counts(
  p_company_id uuid,p_start date,p_end date
)
returns jsonb language sql stable set search_path=''
as $$
  with bounds as (
    select p_start::timestamp at time zone 'America/Sao_Paulo' as begins,
      (p_end+1)::timestamp at time zone 'America/Sao_Paulo' as ends
  ), projects as (
    select p.id,p.start_date,p.created_at,p.completed_at,p.target_end_date
    from cali_workspace.projects p
    where p.company_id=p_company_id and p.planning_status in
      ('client_review','adjustment_requested','approved','active','rebriefing','closed')
  ), deliveries as (
    select d.id from cali_workspace.deliverables d join projects p on p.id=d.project_id
    where d.company_id=p_company_id and d.client_visible and d.status<>'cancelled'
  ), task_counts as (
    select count(*) filter(where t.created_at>=b.begins and t.created_at<b.ends) as created,
      count(*) filter(where t.completed_at>=b.begins and t.completed_at<b.ends) as completed
    from cali_workspace.deliverable_tasks t join deliveries d on d.id=t.deliverable_id cross join bounds b
    where t.company_id=p_company_id and t.client_visible
      and ((t.created_at>=b.begins and t.created_at<b.ends) or (t.completed_at>=b.begins and t.completed_at<b.ends))
  ), documents as (
    select f.id from cali_workspace.files f cross join bounds b
    where f.company_id=p_company_id and f.status='published' and f.client_visible
      and f.published_at>=b.begins and f.published_at<b.ends
      and (f.deliverable_id is null or exists(select 1 from deliveries d where d.id=f.deliverable_id))
    union
    select d.id from cali_session_guard.phase4_documents d cross join bounds b
    where d.company_id=p_company_id and d.delivery_id is null and d.published_revision is not null
      and exists(select 1 from cali_workspace.activity_log l
        where l.company_id=p_company_id and l.entity_type='document' and l.entity_id=d.id
          and l.event_type='document_published' and l.metadata->>'revisionId'=d.published_revision::text
          and l.created_at>=b.begins and l.created_at<b.ends)
  )
  select jsonb_build_object(
    'projects',(select count(*) from projects p
      where coalesce(p.start_date,(p.created_at at time zone 'America/Sao_Paulo')::date)<=p_end
        and coalesce((p.completed_at at time zone 'America/Sao_Paulo')::date,p.target_end_date,p_end)>=p_start),
    'tasksCreated',(select created from task_counts),
    'tasksCompleted',(select completed from task_counts),
    'events',(select count(*) from cali_workspace.events e cross join bounds b
      where e.company_id=p_company_id and e.visibility='client' and e.cancelled_at is null
        and e.starts_at>=b.begins and e.starts_at<b.ends),
    'documentsPublished',(select count(*) from documents),
    'comments',(select count(*) from cali_workspace.comments c join deliveries d on d.id=c.target_id cross join bounds b
      where c.company_id=p_company_id and c.target_type='deliverable' and c.client_visible
        and c.created_at>=b.begins and c.created_at<b.ends)
  );
$$;
revoke all on function cali_session_guard.phase4_report_client_counts(uuid,date,date)
  from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_freeze_report_client_counts()
returns trigger language plpgsql set search_path=''
as $$
begin
  new.snapshot:=new.snapshot||jsonb_build_object('clientSourceCounts',
    cali_session_guard.phase4_report_client_counts(new.company_id,
      (new.snapshot->>'periodStart')::date,(new.snapshot->>'periodEnd')::date));
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_freeze_report_client_counts()
  from public,anon,authenticated,service_role;
drop trigger if exists phase4_freeze_report_client_counts on cali_session_guard.phase4_report_approvals;
create trigger phase4_freeze_report_client_counts before insert on cali_session_guard.phase4_report_approvals
for each row execute function cali_session_guard.phase4_freeze_report_client_counts();
commit;
