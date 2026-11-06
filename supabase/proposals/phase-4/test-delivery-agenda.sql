begin;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 project uuid := gen_random_uuid();
 delivery uuid := gen_random_uuid();
 review uuid;
 appointment uuid;
 request uuid := gen_random_uuid();
 expected timestamptz;
 draft_expected timestamptz;
 future text := to_char(current_date+10,'YYYY-MM-DD');
 slots jsonb := jsonb_build_array(jsonb_build_object('start',future||'T09:00','end',future||'T10:00'));
begin
 set local role authenticated;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_create_pilot_project(a,project,'Projeto para ciclo',null,'2026-11-09');
 perform cali_workspace.v2_add_pilot_project_item(a,project,delivery,'deliverable','Entrega avaliada',null,'2026-11-10 15:00');
 review := cali_workspace.v2_share_pilot_schedule(a,project);
 perform cali_workspace.fixture_as('clientA');
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'approve',null);
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_pilot_project_lifecycle(a,project,'normal','pause','Motivo da pausa',null);
 perform cali_workspace.v2_pilot_project_lifecycle(a,project,'paused','resume','Motivo da retomada',null);
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,expected,'status','client_review');
 perform cali_workspace.fixture_as('clientA');
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,expected,'approve',p_score=>5);
 perform cali_workspace.fixture_as('admin');
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,expected,'reopen',p_note=>'Corrigir escopo');
 draft_expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,total}'='0';
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,draft_expected,'status','client_review');
 perform cali_workspace.fixture_as('clientA');
 begin
   perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,expected,'approve',p_score=>5);
   raise exception 'Aprovação antiga aceita';
 exception when serialization_failure then null; end;
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_pilot_delivery_action(a,project,delivery,expected,'approve',p_score=>4);

 begin
   perform cali_workspace.v2_request_pilot_appointment(a,gen_random_uuid(),'remote','Extra QA',null,null,
     jsonb_build_array(jsonb_build_object('start',future||'T21:00','end',future||'T22:00')));
   raise exception 'Adicional sem condição explícita aceito';
 exception when invalid_parameter_value then null; end;
 appointment := cali_workspace.v2_request_pilot_appointment(a,request,'remote','Reunião QA',null,null,slots);
 assert cali_workspace.v2_request_pilot_appointment(a,request,'remote','Reunião QA',null,null,slots)=appointment;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_respond_pilot_appointment(a,appointment,'offer',null,0);
 perform cali_workspace.fixture_as('clientB');
 begin
   perform cali_workspace.v2_respond_pilot_appointment(b,appointment,'confirm',null,0);
   raise exception 'Pedido de outra empresa confirmado';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('clientA');
 perform cali_workspace.v2_respond_pilot_appointment(a,appointment,'confirm',null,0);
 assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,status}'='confirmed';
 assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,sync_status}'='pending';
 begin
   perform cali_workspace.v2_respond_pilot_appointment(a,appointment,'confirm',null,0);
   raise exception 'Confirmação duplicada';
 exception when serialization_failure then null; end;
 reset role;
 assert (select count(*) from cali_workspace.fixture_feedback where delivery_id=delivery)=2;
 assert (select count(*) from cali_workspace.events where title='Reunião QA')=1;
 assert (select count(*) from cali_workspace.scheduling_requests where title='Reunião QA')=1;
end $$;
rollback;
\echo Fase 4: nova aprovação, ocultação, agenda e confirmação única validadas no cenário local.
