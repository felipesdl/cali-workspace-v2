\ir ../../../tests/fixtures/phase4/write-context.sql
\ir ../../../tests/fixtures/phase4/agenda-changes.sql
\ir ../../../tests/fixtures/phase4/record-reviews.sql
\ir ../../../tests/fixtures/phase4/admin-read.sql
\ir ../../../tests/fixtures/phase4/satisfaction.sql
\ir ../../../tests/fixtures/phase4/forms-draft.sql
\ir read-projects.sql
\ir read-hours.sql
\ir read-catalogs.sql
\ir pilot-role.sql
\ir admin-audit-read.sql
\ir operation-receipts.sql
\ir capacity-operations.sql
\ir test-capacity-operations.sql
\ir test-front-operations.sql
\ir forms-operations.sql
\ir forms-draft.sql
\ir forms-triage.sql
\ir test-forms-draft.sql
\ir test-forms-triage.sql
\ir test-forms-public-collection.sql
\ir project-operations.sql
\ir project-planning.sql
\ir document-operations.sql
\ir delivery-operations.sql
\ir repair-project-forecast.sql
\ir agenda-operations.sql
\ir agenda-qa-transport.sql
\ir agenda-extra-expense-receipts.sql
\ir agenda-extras-read.sql
\ir test-agenda-extras-read.sql
\ir agenda-change-operations.sql
\ir agenda-followup.sql
\ir agenda-material.sql
\ir agenda-guests.sql
\ir agenda-extra-actions.sql
\ir agenda-extra-intake.sql
\ir test-agenda-extra-expense-receipts.sql
\ir hours-operations.sql
\ir record-operations.sql
\ir record-review-operations.sql
\ir report-privacy-operations.sql
\ir notice-operations.sql
\ir report-draft-operations.sql
\ir report-release-operations.sql
\ir commercial-read.sql
\ir commercial-draft.sql
\ir commercial-create.sql
\ir commercial-delivery.sql
\ir commercial-pricing.sql
\ir commercial-email.sql
\ir satisfaction-operations.sql

begin;
\ir prove-project-roadmap.sql
rollback;
\echo Fase 4A: ordem e paginação do cronograma validadas.

begin;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 project uuid := gen_random_uuid();
 front uuid := gen_random_uuid();
 delivery uuid := gen_random_uuid();
 review uuid;
 next_review uuid;
 timer uuid;
 resumed_timer uuid;
 ticket uuid := gen_random_uuid();
 request uuid := gen_random_uuid();
 message_id uuid;
 right_id uuid;
 report_id uuid := (select id from cali_workspace.reports where status='published');
 payload jsonb;
begin
 set local role authenticated;
 perform cali_workspace.fixture_as('admin1');
 begin
   perform cali_workspace.v2_create_pilot_project(a,project,'Projeto novo',null,'2026-11-09');
   raise exception 'Criação sem MFA aceita';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 assert cali_workspace.v2_create_pilot_project(a,project,'Projeto novo',null,'2026-11-09')=project;
 assert cali_workspace.v2_create_pilot_project(a,project,'Projeto novo',null,'2026-11-09')=project;
 assert cali_workspace.v2_add_pilot_project_item(a,project,front,'workstream','Planejamento',null,null)=front;
 begin
   perform cali_workspace.v2_share_pilot_schedule(a,project);
   raise exception 'Cronograma vazio publicado';
 exception when invalid_parameter_value then null; end;
 assert cali_workspace.v2_add_pilot_project_item(a,project,delivery,'deliverable','Entrega nova',front,'2026-11-10 15:00')=delivery;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1) is null;
 perform cali_workspace.fixture_as('admin');
 review := cali_workspace.v2_share_pilot_schedule(a,project);
 assert (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{review,id}')::uuid=review;
 assert (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,due_at}')::timestamptz
  ='2026-11-10 18:00Z'::timestamptz;
 perform cali_workspace.fixture_as('clientB');
 begin
   perform cali_workspace.v2_respond_pilot_schedule(b,project,review,'approve',null);
   raise exception 'Aprovação cruzada aceita';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('clientA');
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'request_adjustment','Revisar datas','project');
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'accept_adjustment','Datas verificadas');
 next_review := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{review,id}')::uuid;
 assert next_review<>review;
 perform cali_workspace.fixture_as('clientA');
 begin
   perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'approve',null);
   raise exception 'Resposta antiga aceita';
 exception when serialization_failure then null; end;
 perform cali_workspace.v2_respond_pilot_schedule(a,project,next_review,'approve',null);

 perform cali_workspace.fixture_as('admin');
 assert cali_workspace.v2_pilot_hour_action(a,request,'manual',project,null,'2026-11-09',60,'Atividade','Justificativa')=
   cali_workspace.v2_pilot_hour_action(a,request,'manual',project,null,'2026-11-09',60,'Atividade','Justificativa');
 begin
   perform cali_workspace.v2_pilot_hour_action(a,request,'manual',project,null,'2026-11-09',90,'Atividade','Justificativa');
   raise exception 'Mudança em solicitação já usada';
 exception when serialization_failure then null; end;
 timer := cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'start',project,p_description=>'Timer QA');
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'pause',p_timer_id=>timer);
 assert cali_workspace.v2_pilot_active_timers(a)#>>'{0,status}'='paused';
 begin
  perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'start',project,p_description=>'Segundo timer');
  raise exception 'Segundo timer aceito com pausa ativa';
 exception when serialization_failure then null; end;
 request := gen_random_uuid();
 resumed_timer := cali_workspace.v2_pilot_hour_action(a,request,'resume',p_timer_id=>timer);
 assert resumed_timer<>timer;
 assert cali_workspace.v2_pilot_hour_action(a,request,'resume',p_timer_id=>timer)=resumed_timer;
 request := gen_random_uuid();
 perform cali_workspace.v2_pilot_hour_action(a,request,'stop',p_timer_id=>resumed_timer);
 perform cali_workspace.v2_pilot_hour_action(a,request,'stop',p_timer_id=>resumed_timer);
 assert cali_workspace.v2_pilot_active_timers(a)='[]'::jsonb;

 perform cali_workspace.fixture_as('clientA');
 request := gen_random_uuid();
 message_id := cali_workspace.v2_pilot_record_action(a,request,ticket,'open','Uma ocorrência','Mensagem inicial @CALI');
 assert cali_workspace.v2_pilot_record_action(a,request,ticket,'open','Uma ocorrência','Mensagem inicial @CALI')=message_id;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'message',p_body=>'Nota reservada',p_internal=>true);
 perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'message',p_body=>'Resposta pública');
 assert jsonb_array_length(cali_workspace.v2_read_pilot_record(a,ticket,1)->'messages')=3;
 begin
   perform cali_workspace.v2_start_pilot_record_timer(b,gen_random_uuid(),ticket);
   raise exception 'Timer cruzado aceito';
 exception when insufficient_privilege then null; end;
 request := gen_random_uuid();
 timer := cali_workspace.v2_start_pilot_record_timer(a,request,ticket);
 assert cali_workspace.v2_start_pilot_record_timer(a,request,ticket)=timer;
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'pause',p_timer_id=>timer);
 begin
   perform cali_workspace.v2_start_pilot_record_timer(a,gen_random_uuid(),ticket);
   raise exception 'Segundo timer de ocorrência aceito com pausa ativa';
 exception when serialization_failure then null; end;
 resumed_timer := cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'resume',p_timer_id=>timer);
 assert resumed_timer<>timer;
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'stop',p_timer_id=>resumed_timer);
 assert cali_workspace.v2_pilot_active_timers(a)='[]'::jsonb;
 reset role;
 update cali_workspace.account_records set workflow_status='completed' where id=ticket;
 set local role authenticated;
 begin
   perform cali_workspace.v2_start_pilot_record_timer(a,gen_random_uuid(),ticket);
   raise exception 'Timer aceito para ocorrência encerrada';
 exception when insufficient_privilege then null; end;
 reset role;
 update cali_workspace.account_records set workflow_status='in_progress' where id=ticket;
 set local role authenticated;
 assert cali_workspace.v2_pilot_report_readiness(a,'2026-11-01')->>'mode'='preview';
 perform cali_workspace.fixture_as('clientA');
 begin
   perform cali_workspace.v2_start_pilot_record_timer(a,gen_random_uuid(),ticket);
   raise exception 'Cliente iniciou timer';
 exception when insufficient_privilege then null; end;
 payload := cali_workspace.v2_read_pilot_record(a,ticket,1);
 assert jsonb_array_length(payload->'messages')=2 and payload::text not like '%Nota reservada%';
 begin
   perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'message',p_body=>'Nota forjada',p_internal=>true);
   raise exception 'Nota interna por cliente aceita';
 exception when insufficient_privilege then null; end;
 assert cali_workspace.v2_acknowledge_pilot_report(a,report_id)->>'protocol'='CIE-QA';
 perform cali_workspace.fixture_as('clientB');
 assert cali_workspace.v2_read_pilot_record(b,ticket,1) is null;
 begin
   perform cali_workspace.v2_acknowledge_pilot_report(b,report_id);
   raise exception 'Ciência cruzada aceita';
 exception when insufficient_privilege then null; end;
 request := gen_random_uuid();
 right_id := cali_workspace.v2_submit_pilot_privacy_request(b,request,'deletion','Pedido sintético de eliminação');
 assert cali_workspace.v2_submit_pilot_privacy_request(b,request,'deletion','Pedido sintético de eliminação')=right_id;
 perform cali_workspace.fixture_as('clientB2');
 assert cali_workspace.v2_list_pilot_privacy_requests(b,1)='[]'::jsonb;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_answer_pilot_privacy_request(b,right_id,'Resposta sintética');
 assert cali_workspace.v2_list_pilot_privacy_requests(b,1)#>>'{0,status}'='answered';
 reset role;
 assert (select count(*) from cali_workspace.hour_entries where description='Timer QA')=1;
 assert (select count(*) from cali_workspace.hour_entries where description='Atividade')=1;
 assert (select count(*) from cali_workspace.work_timers where id in (timer,resumed_timer) and account_record_id=ticket and not client_visible)=2;
 assert (select count(*) from cali_workspace.hour_entries where account_record_id=ticket and not client_visible)=1;
 assert (select count(*) from cali_workspace.notifications where entity_id=ticket)=3;
 assert not exists(select 1 from cali_workspace.notifications where entity_id=ticket and email_required);
 assert (select count(*) from cali_workspace.activity_log where entity_id=project and event_type='project_draft_created')=1;
end $$;
rollback;
\echo Fase 4: operações locais de projetos, horas, ocorrências, ciência e privacidade validadas.
\ir test-planning.sql
\ir test-project-journal.sql
\ir test-delivery-agenda.sql
\ir test-legacy-delivery-files.sql
\ir test-agenda-changes.sql
\ir test-agenda-followup.sql
\ir test-agenda-material-guests.sql
\ir test-agenda-qa-transport.sql
\ir test-record-reviews.sql
\ir test-record-qa-transport.sql
\ir test-record-attachments.sql
\ir test-privacy-qa-transport.sql
\ir test-catalog-actions.sql
\ir test-notice-interactions.sql
\ir notice-interactions.sql
\ir test-notice-covers.sql
\ir rollback-notice-interactions.sql
\ir test-documents.sql
grant usage on schema cali_workspace to service_role;
\ir test-report-release.sql
\ir test-report-client-source-counts.sql
\ir test-admin-read.sql
\ir test-staff-roster.sql
\ir test-staff-pilot-admission.sql
\ir test-mapa-operations.sql
\ir test-commercial-draft.sql
\ir test-commercial-create.sql
\ir test-commercial-delivery.sql
\ir test-commercial-email.sql
\ir test-commercial-portfolio.sql
\ir test-satisfaction.sql
\ir test-data-lifecycle-read.sql
\ir test-hour-corrections.sql
\ir test-admin-daily-preview.sql
\ir rollback-forms.sql
do $$
begin
 assert to_regprocedure('cali_workspace.v2_list_pilot_forms(uuid,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_open_pilot_public_form(uuid,uuid,text,boolean)') is null;
 assert to_regprocedure('cali_workspace.v2_save_pilot_form_triage(uuid,uuid,uuid,text,text,text,text)') is null;
 assert to_regprocedure('cali_workspace.v2_create_pilot_project(uuid,uuid,text,text,date)') is not null;
 assert to_regprocedure('cali_session_guard.require_phase4_role(uuid,text)') is not null;
 assert to_regclass('cali_session_guard.phase4_operation_receipts') is not null;
end $$;
\ir rollback-report-release.sql
\ir rollback-privacy.sql
do $$
begin
 assert to_regprocedure('cali_workspace.v2_read_pilot_report_catalog(uuid,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer)') is not null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_privacy_requests(uuid,integer)') is null;
 assert to_regclass('cali_session_guard.phase4_privacy_qa') is not null;
 assert to_regclass('cali_session_guard.phase4_report_releases') is not null;
end $$;
\ir rollback-write.sql
\ir rollback-project-forecast.sql
do $$
begin
 assert to_regprocedure('cali_workspace.v2_create_pilot_project(uuid,uuid,text,text,date)') is null;
 assert to_regprocedure('cali_workspace.v2_pilot_active_timers(uuid)') is null;
 assert to_regprocedure('cali_workspace.v2_start_pilot_record_timer(uuid,uuid,uuid)') is null;
 assert to_regprocedure('cali_workspace.v2_read_pilot_record(uuid,uuid,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_acknowledge_pilot_report(uuid,uuid)') is null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_privacy_requests(uuid,integer)') is null;
 assert to_regclass('cali_session_guard.phase4_operation_receipts') is not null;
 assert to_regprocedure('cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer)') is null;
 assert to_regclass('cali_session_guard.phase4_report_approvals') is not null;
 assert (select count(*) from cali_workspace.projects)=3;
end $$;
