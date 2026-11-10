alter table cali_workspace.projects add column created_at timestamptz,
  add column completed_at timestamptz, add column target_end_date date;
\ir report-client-source-counts.sql
begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  project uuid:=gen_random_uuid();
  draft uuid:=gen_random_uuid();
  delivery uuid:=gen_random_uuid();
  hidden uuid:=gen_random_uuid();
  report uuid:=gen_random_uuid();
  boundary constant timestamptz := '2031-08-01 00:00 America/Sao_Paulo';
  expected jsonb:='{"projects":1,"tasksCreated":1,"tasksCompleted":1,"events":1,"documentsPublished":1,"comments":1}';
  actual jsonb;
begin
  insert into cali_workspace.projects(id,company_id,name,planning_status,created_at)
  values(project,a,'Projeto visível','active',boundary),(draft,a,'Projeto oculto','draft',boundary),
    (gen_random_uuid(),b,'Projeto de B','active',boundary);
  insert into cali_workspace.deliverables(id,company_id,project_id,title,status,client_visible)
  values(delivery,a,project,'Entregável visível','approved',true),(hidden,a,draft,'Entregável oculto','approved',true);
  insert into cali_workspace.deliverable_tasks(id,company_id,deliverable_id,title,client_visible,created_at,completed_at)
  values(gen_random_uuid(),a,delivery,'Visível',true,boundary,boundary),
    (gen_random_uuid(),a,delivery,'Interna',false,boundary,boundary),
    (gen_random_uuid(),a,hidden,'Projeto oculto',true,boundary,boundary);
  insert into cali_workspace.events(id,company_id,title,visibility,starts_at,cancelled_at)
  values(gen_random_uuid(),a,'Visível','client',boundary,null),
    (gen_random_uuid(),a,'Cancelado','client',boundary,boundary),
    (gen_random_uuid(),a,'Interno','internal',boundary,null),
    (gen_random_uuid(),a,'Dia anterior','client',boundary-interval '1 second',null);
  insert into cali_workspace.files(id,company_id,title,status,published_at,client_visible,deliverable_id)
  values(gen_random_uuid(),a,'Visível','published',boundary,true,delivery),
    (gen_random_uuid(),a,'Oculto','published',boundary,true,hidden);
  insert into cali_workspace.comments(id,company_id,target_type,target_id,client_visible,created_at)
  values(gen_random_uuid(),a,'deliverable',delivery,true,boundary),
    (gen_random_uuid(),a,'deliverable',delivery,false,boundary),
    (gen_random_uuid(),a,'deliverable',hidden,true,boundary);

  actual:=cali_session_guard.phase4_report_client_counts(a,'2031-08-01','2031-08-31');
  assert actual=expected, actual::text;
  insert into cali_workspace.reports(id,company_id,title,period_start,period_end,version,status)
  values(report,a,'Relatório das contagens','2031-08-01','2031-08-31',1,'approved');
  insert into cali_session_guard.phase4_report_approvals(report_id,company_id,version,approved_by,approved_at,snapshot)
  values(report,a,1,gen_random_uuid(),now(),'{"periodStart":"2031-08-01","periodEnd":"2031-08-31"}');
  update cali_workspace.deliverable_tasks set client_visible=false where deliverable_id=delivery;
  assert (select snapshot->'clientSourceCounts' from cali_session_guard.phase4_report_approvals where report_id=report)=expected;

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  actual:=cali_workspace.v2_prepare_pilot_report_pdf(a,report,1)#>'{input,clientSourceCounts}';
  assert actual=expected;
  select entry->'reportClientSourceCounts' into actual
    from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
    where entry->>'id'=report::text;
  assert actual=expected;
  perform cali_workspace.fixture_as('clientA');
  assert not exists(select 1 from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
    where entry->>'id'=report::text);
end;
$$;
rollback;
drop trigger phase4_freeze_report_client_counts on cali_session_guard.phase4_report_approvals;
drop function cali_session_guard.phase4_freeze_report_client_counts();
drop function cali_session_guard.phase4_report_client_counts(uuid,date,date);
