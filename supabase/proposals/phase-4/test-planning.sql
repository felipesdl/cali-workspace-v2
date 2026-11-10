\ir ../../../tests/fixtures/phase4/planning.sql
\ir project-qa-transport.sql
begin;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 project uuid:=gen_random_uuid(); front uuid:=gen_random_uuid(); destination uuid:=gen_random_uuid();
 delivery uuid:=gen_random_uuid(); expected timestamptz; review uuid;
begin
 set local role authenticated;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_create_pilot_project(a,project,'Planejamento sintético','Objetivo','2026-11-09');
 perform cali_workspace.v2_add_pilot_project_item(a,project,front,'workstream','Frente inicial',null,null);
 perform cali_workspace.v2_add_pilot_project_item(a,project,destination,'workstream','Outra frente',null,null);
 perform cali_workspace.v2_add_pilot_project_item(a,project,delivery,'deliverable','Entrega',front,'2026-11-10 15:00');
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.fixture_as('clientA');
 begin
  perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-12 16:00',front,'MC2',2);
  raise exception 'Cliente editou planejamento';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 begin
  perform cali_workspace.v2_edit_pilot_plan(b,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-12 16:00',front,'MC2',2);
  raise exception 'Projeto de outra empresa editado';
 exception when serialization_failure then null; end;
 perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-12 16:00',front,'MC2',2);
 begin
  perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Sobrescrita','',null,'2026-11-13 16:00',front,'MC1',1);
  raise exception 'Versão antiga sobrescreveu edição';
 exception when serialization_failure then null; end;
 reset role;
 assert (select title='Entrega alterada' and complexity='MC2' and sort_order=2
   and due_at='2026-11-12 19:00Z' from cali_workspace.deliverables where id=delivery);
 select updated_at into expected from cali_workspace.project_workstreams where id=front;
 set local role authenticated;
 begin
  perform cali_workspace.v2_edit_pilot_plan(a,project,front,'workstream',expected,'remove',null,null,null,null,null,null,null);
  raise exception 'Frente com entregáveis removida sem destino';
 exception when raise_exception then
  if sqlerrm='Frente com entregáveis removida sem destino' then raise; end if;
 end;
 perform cali_workspace.v2_edit_pilot_plan(a,project,front,'workstream',expected,'remove',null,null,null,null,destination,null,null);
 reset role;
 assert (select workstream_id=destination from cali_workspace.deliverables where id=delivery);
 assert not exists(select 1 from cali_workspace.project_workstreams where id=front);
 set local role authenticated;
 review := cali_workspace.v2_share_pilot_schedule(a,project);
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{review,pastDue}'='false';
 reset role;
 update cali_workspace.project_review_requests set response_due_at=now()-interval '1 minute' where id=review;
 set local role authenticated;
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{review,pastDue}'='true';
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 begin
  perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Troca indevida','',null,'2026-11-12 16:00',destination,'MC2',2);
  raise exception 'Planejamento em revisão editado';
 exception when serialization_failure then null; end;
 perform cali_workspace.fixture_as('clientA');
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'request_adjustment','Revisar a data','deliverable',delivery,'reschedule','2026-11-13');
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-13 16:00',destination,'MC2',2);
 assert (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,complexity}')='MC2';
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-13 16:00',null,'MC2',2);
 begin
  perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'accept_adjustment','Cronograma incompleto');
  raise exception 'Revisão abriu com frente sem entrega';
 exception when invalid_parameter_value then null; end;
 expected := (cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}')::timestamptz;
 perform cali_workspace.v2_edit_pilot_plan(a,project,delivery,'deliverable',expected,'save','Entrega alterada','Descrição',null,'2026-11-13 16:00',destination,'MC2',2);
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'accept_adjustment','Cronograma corrigido');

 reset role;
 insert into cali_session_guard.phase4_project_qa(project_id,company_id) values(project,a);
 insert into cali_workspace.notifications values(a,delivery,'deliverable_status','deliverable',true);
 insert into cali_workspace.notifications values(b,delivery,'deliverable_status','deliverable',true);
 assert not (select email_required from cali_workspace.notifications where company_id=a and entity_id=delivery);
 assert (select email_required from cali_workspace.notifications where company_id=b and entity_id=delivery);
 assert exists(select 1 from cali_workspace.activity_log where entity_id=delivery and event_type='project_plan_save');
end $$;
rollback;
\echo Fase 4A: edição, conflito, destino de frente, ajuste e transporte sintético validados.
