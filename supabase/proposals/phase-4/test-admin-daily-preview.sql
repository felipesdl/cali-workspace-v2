alter table cali_workspace.notifications add column id uuid not null default gen_random_uuid(),
  add column created_at timestamptz not null default now();
\ir admin-daily-preview.sql
\ir admin-daily-queue.sql
begin;
alter table cali_workspace.profiles add column email text;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  old_company constant uuid:='00000000-0000-4000-8000-000000000003';
  instant constant timestamptz:='2026-11-07 22:00Z'; -- sábado, 19h Brasília
  receiver uuid;
  client uuid;
  payload jsonb;
  visible_report uuid := gen_random_uuid();
  withdrawn_report uuid := gen_random_uuid();
  later_report uuid := gen_random_uuid();
  inactive uuid := gen_random_uuid();
  missing_email uuid := gen_random_uuid();
  staff uuid := gen_random_uuid();
  not_enrolled uuid := gen_random_uuid();
begin
  select id into receiver from cali_workspace.profiles where role='admin' limit 1;
  select id into client from cali_workspace.profiles where role='client' and company_id=a limit 1;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,entity_type,entity_id,created_at,action_url)
  select a,receiver,'review_response','Ação '||i,repeat('x',181),'project',null,
    '2026-11-07 03:00Z'::timestamptz+i*interval '1 minute','/admin/projetos?section=deliverables'
  from generate_series(1,13) i;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,entity_type,entity_id,created_at)
  values (a,receiver,'review_response','Ação 1',repeat('x',181),'project',null,'2026-11-07 18:00Z'),
    (a,client,'deliverable_status','Entrega','Texto','deliverable',null,'2026-11-07 19:00Z'),
    (a,receiver,'record_message','Chat excluído','Texto','account_record',null,'2026-11-07 20:00Z'),
    (a,receiver,'staff_hours_edited','Staff excluído','Texto','hour_entry',null,'2026-11-07 20:00Z'),
    (a,receiver,'review_response','Anterior ao dia','Texto','project',null,'2026-11-07 02:59Z'),
    (a,receiver,'review_response','Após o corte','Texto','project',null,'2026-11-07 22:01Z'),
    (old_company,receiver,'review_response','Fora do piloto','Texto','project',null,'2026-11-07 19:00Z');
  insert into cali_workspace.hour_entries(id,company_id,work_date,minutes,description,client_visible)
  values(gen_random_uuid(),b,'2026-11-07',35,'Dia só com horas',false),
    (gen_random_uuid(),b,'2026-11-06',99,'Dia anterior',false),
    (gen_random_uuid(),old_company,'2026-11-07',99,'Fora do piloto',false);
  insert into cali_workspace.reports(id,company_id,title,status,period_start)
  values (visible_report,a,'Relatório sintético liberado','published','2026-10-01'),
    (withdrawn_report,a,'Relatório retirado antes do corte','draft','2026-10-01'),
    (later_report,a,'Relatório liberado depois do corte','published','2026-10-01');
  insert into cali_session_guard.phase4_report_approvals(report_id,company_id,version,approved_by,approved_at,snapshot)
  select id,company_id,1,receiver,instant,'{}'::jsonb from cali_workspace.reports
  where id in (visible_report,withdrawn_report,later_report);
  insert into cali_session_guard.phase4_report_pdfs(report_id,version,content)
  select id,1,convert_to('%PDF-1.4 fixture','UTF8') from cali_workspace.reports
  where id in (visible_report,withdrawn_report,later_report);
  insert into cali_session_guard.phase4_report_releases(report_id,version,released_at,released_by,requires_ack,withdrawn_at)
  values (visible_report,1,'2026-11-07 21:00Z',receiver,true,null),
    (withdrawn_report,1,'2026-11-07 20:00Z',receiver,true,'2026-11-07 21:00Z'),
    (later_report,1,'2026-11-07 22:01Z',receiver,true,null);
  payload:=cali_session_guard.phase4_build_admin_daily_preview(instant);
  assert payload->>'day'='2026-11-07' and payload->>'clientTotal'='13' and payload->>'caliTotal'='2';
  assert payload->>'minutes'='35' and jsonb_array_length(payload->'companies')=2;
  assert payload#>>'{companies,0,id}'=a::text and payload#>>'{companies,1,id}'=b::text;
  assert jsonb_array_length(payload#>'{companies,0,client,items}')=12;
  assert length(payload#>>'{companies,0,client,items,0,excerpt}')=180;
  assert payload#>>'{companies,0,client,items,0,title}'='Ação 1';
  assert payload#>>'{companies,1,client,total}'='0';
  assert payload#>>'{companies,0,cali,items,0,title}'='Relatório liberado';
  assert payload#>>'{companies,0,cali,items,0,excerpt}'='Relatório sintético liberado';
  assert payload#>>'{companies,0,cali,items,0,link}'='/admin/relatorios?companyId='||a::text;
  assert payload::text not like '%Relatório retirado%' and payload::text not like '%depois do corte%';
  assert payload::text not like '%Chat excluído%' and payload::text not like '%Staff excluído%';
  assert cali_session_guard.phase4_build_admin_daily_preview('2026-11-08 22:00Z')->'companies'='[]'::jsonb;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,created_at)
  select a,receiver,'review_response','Volume '||i,'Fixture','2026-11-09 04:00Z'::timestamptz
  from generate_series(1,2101) i;
  payload:=cali_session_guard.phase4_build_admin_daily_preview('2026-11-09 22:00Z');
  assert payload->>'clientTotal'='2101';
  assert jsonb_array_length(payload#>'{companies,0,client,items}')=12;
  update cali_workspace.profiles set email='admin@example.invalid' where id=receiver;
  update cali_workspace.profiles set email='client@example.invalid' where id=client;
  insert into cali_workspace.profiles(id,role,email,active) values
    (inactive,'admin','inactive@example.invalid',false),
    (missing_email,'admin','  ',true),
    (staff,'staff','staff@example.invalid',true),
    (not_enrolled,'admin','outside@example.invalid',true);
  insert into cali_session_guard.phase4_admin_digest_recipients values
    (receiver),(client),(inactive),(missing_email),(staff);
  assert cali_session_guard.phase4_enqueue_admin_digest(instant-interval '1 minute')=0;
  assert cali_session_guard.phase4_enqueue_admin_digest(instant+interval '1 minute')=0;
  assert cali_session_guard.phase4_enqueue_admin_digest('2026-11-08 22:00Z')=0;
  assert cali_session_guard.phase4_enqueue_admin_digest(instant+interval '29 seconds')=1;
  assert cali_session_guard.phase4_enqueue_admin_digest(instant)=0;
  assert (select profile_id from cali_session_guard.phase4_admin_digest_queue)=receiver;
  assert (select as_of from cali_session_guard.phase4_admin_digest_queue)=instant;
  assert (select q.payload->>'clientTotal' from cali_session_guard.phase4_admin_digest_queue q)='13';
  assert not has_function_privilege('authenticated','cali_session_guard.phase4_enqueue_admin_digest(timestamptz)','execute');
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_admin_daily_preview();
    raise exception 'Prévia abriu para Cliente';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_admin_daily_preview();
    raise exception 'Prévia abriu sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_read_pilot_admin_daily_preview() is not null;
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_admin_daily_preview()','execute');
end $$;
rollback;
\ir rollback-admin-daily-queue.sql
\ir rollback-admin-daily-preview.sql
\echo Fase 4C: resumo Admin com corte Brasília, exclusões, totais e limite visual.
