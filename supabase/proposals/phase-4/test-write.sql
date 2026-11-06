\ir ../../../tests/fixtures/phase4/write-context.sql
\ir read-projects.sql
\ir read-catalogs.sql
\ir project-operations.sql
\ir document-operations.sql
\ir delivery-operations.sql
\ir operation-receipts.sql
\ir agenda-operations.sql
\ir hours-operations.sql
\ir record-operations.sql
\ir report-privacy-operations.sql
\ir notice-operations.sql
\ir report-draft-operations.sql
\ir forms-operations.sql

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
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'resume',p_timer_id=>timer);
 request := gen_random_uuid();
 perform cali_workspace.v2_pilot_hour_action(a,request,'stop',p_timer_id=>timer);
 perform cali_workspace.v2_pilot_hour_action(a,request,'stop',p_timer_id=>timer);
 assert cali_workspace.v2_pilot_active_timers(a)='[]'::jsonb;

 perform cali_workspace.fixture_as('clientA');
 request := gen_random_uuid();
 message_id := cali_workspace.v2_pilot_record_action(a,request,ticket,'open','Uma ocorrência','Mensagem inicial @CALI');
 assert cali_workspace.v2_pilot_record_action(a,request,ticket,'open','Uma ocorrência','Mensagem inicial @CALI')=message_id;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'message',p_body=>'Nota reservada',p_internal=>true);
 perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'message',p_body=>'Resposta pública');
 assert jsonb_array_length(cali_workspace.v2_read_pilot_record(a,ticket,1)->'messages')=3;
 assert cali_workspace.v2_pilot_report_readiness(a,'2026-11-01')->>'mode'='preview';
 perform cali_workspace.fixture_as('clientA');
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
 assert (select count(*) from cali_workspace.notifications where entity_id=ticket)=3;
 assert not exists(select 1 from cali_workspace.notifications where entity_id=ticket and email_required);
 assert (select count(*) from cali_workspace.activity_log where entity_id=project and event_type='project_draft_created')=1;
end $$;
rollback;
\echo Fase 4: operações locais de projetos, horas, ocorrências, ciência e privacidade validadas.
\ir test-delivery-agenda.sql
\ir test-catalog-actions.sql
\ir test-documents.sql
\ir rollback-write.sql
do $$
begin
 assert to_regprocedure('cali_workspace.v2_create_pilot_project(uuid,uuid,text,text,date)') is null;
 assert to_regprocedure('cali_workspace.v2_pilot_active_timers(uuid)') is null;
 assert to_regprocedure('cali_workspace.v2_read_pilot_record(uuid,uuid,integer)') is null;
 assert to_regprocedure('cali_workspace.v2_acknowledge_pilot_report(uuid,uuid)') is null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_privacy_requests(uuid,integer)') is null;
 assert to_regclass('cali_session_guard.phase4_operation_receipts') is not null;
 assert to_regprocedure('cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer)') is null;
 assert to_regclass('cali_session_guard.phase4_report_approvals') is not null;
 assert (select count(*) from cali_workspace.projects)=3;
end $$;
