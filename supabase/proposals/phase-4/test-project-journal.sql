\ir ../../../tests/fixtures/phase4/project-journal.sql
\ir project-journal.sql
\ir project-collaboration.sql
begin;
do $$
<<qa>>
declare
 a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 project uuid:=gen_random_uuid(); delivery uuid:=gen_random_uuid(); task_id uuid:=gen_random_uuid();
 internal_task uuid:=gen_random_uuid(); dependency uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid();
 review uuid; expected text; args jsonb; linked_timer uuid; hour_id uuid; hour_request uuid:=gen_random_uuid();
begin
 set local role authenticated;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_create_pilot_project(a,project,'Colaboração sintética',null,'2026-11-09');
 perform cali_workspace.v2_add_pilot_project_item(a,project,delivery,'deliverable','Entrega sintética',null,'2026-11-15 16:00');
 review:=cali_workspace.v2_share_pilot_schedule(a,project);
 perform cali_workspace.fixture_as('clientA');
 perform cali_workspace.v2_respond_pilot_schedule(a,project,review,'approve',null);
 perform cali_workspace.fixture_as('admin1');
 begin
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,task_id,'task-save','{"title":"Subtarefa visível","visible":true}');
  raise exception 'Admin sem MFA criou subtarefa';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 args:='{"title":"Subtarefa visível","visible":true,"due":"2026-11-14T16:00","estimatedMinutes":45,"complexity":"MC2"}';
 assert cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,task_id,'task-save',args)=task_id;
 assert cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,task_id,'task-save',args)=task_id;
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,internal_task,'task-save','{"title":"Subtarefa interna","visible":false}');
 assert cali_workspace.v2_pilot_hour_link(a,delivery,task_id)->>'taskName'='Subtarefa visível';
 assert cali_workspace.v2_pilot_hour_link(b,delivery,task_id) is null;
 hour_id:=cali_workspace.v2_pilot_linked_hour_action(a,hour_request,'manual',project,delivery,task_id,'2026-11-09',15,'Horas vinculadas','Teste',false);
 assert cali_workspace.v2_pilot_linked_hour_action(a,hour_request,'manual',project,delivery,task_id,'2026-11-09',15,'Horas vinculadas','Teste',false)=hour_id;
 begin
  perform cali_workspace.v2_pilot_linked_hour_action(a,hour_request,'manual',project,delivery,internal_task,'2026-11-09',15,'Horas vinculadas','Teste',false);
  raise exception 'Recibo aceitou outra subtarefa';
 exception when serialization_failure then null; end;
 linked_timer:=cali_workspace.v2_pilot_linked_hour_action(a,gen_random_uuid(),'start',project,delivery,task_id,null,null,'Timer vinculado',null,false);
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'pause',p_timer_id=>linked_timer);
 linked_timer:=cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'resume',p_timer_id=>linked_timer);
 perform cali_workspace.v2_pilot_hour_action(a,gen_random_uuid(),'stop',p_timer_id=>linked_timer);
 reset role;
 assert exists(select 1 from cali_workspace.hour_entries h where h.id=hour_id and h.deliverable_id=delivery and h.task_id=qa.task_id);
 assert exists(select 1 from cali_workspace.work_timers t where t.id=linked_timer and t.deliverable_id=delivery and t.task_id=qa.task_id);
 set local role authenticated;
 perform cali_workspace.fixture_as('clientA');
 begin
  perform cali_workspace.v2_pilot_hour_link(a,delivery,task_id);
  raise exception 'Cliente abriu contexto de lançamento';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'message','{"note":"Nota da CALI","internal":true}');
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,request_id,'message','{"note":"Mensagem compartilhada","internal":false}');
 assert cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,request_id,'message','{"note":"Mensagem compartilhada","internal":false}')=request_id;
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,dependency,'dependency-create','{"title":"Retorno de teste","day":"2026-11-13"}');
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'dependency-state',jsonb_build_object('item',dependency,'status','received'));
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'dependencies',1,delivery)#>>'{rows,0,status}'='received';
 expected:=cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}';
 begin
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'deadline',jsonb_build_object('expected',expected,'due','2026-11-13T16:00','cause','scope','note','Prazo inválido'));
  raise exception 'Prazo anterior à subtarefa aceito';
 exception when invalid_parameter_value then null; end;
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'deadline',jsonb_build_object('expected',expected,'due','2026-11-16T16:00','cause','internal','note','Motivo reservado'));
 expected:=cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)#>>'{rows,0,updatedAt}';
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'task-status',jsonb_build_object('task',task_id,'expected',expected,'status','client_review'));
 perform cali_workspace.fixture_as('clientB');
 assert cali_workspace.v2_read_pilot_project_journal(b,project,'tasks',1,delivery) is null;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)->>'total'='1';
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'conversation',1,delivery)->>'total'='1';
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'delivery-history',1,delivery)#>>'{rows,0,note}' is null;
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'conversation',1,delivery,internal_task) is null;
 for round in 1..2 loop
  expected:=cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)#>>'{rows,0,updatedAt}';
  args:=jsonb_build_object('task',task_id,'expected',expected,'note','Rever parte sintética do material');
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'task-adjust',args);
  perform cali_workspace.fixture_as('admin');
  expected:=cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)#>>'{rows,0,updatedAt}';
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'task-status',jsonb_build_object('task',task_id,'expected',expected,'status','client_review'));
  perform cali_workspace.fixture_as('clientA');
 end loop;
 expected:=cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)#>>'{rows,0,updatedAt}';
 begin
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'task-adjust',jsonb_build_object('task',task_id,'expected',expected,'note','Terceiro ajuste sintético'));
  raise exception 'Terceiro ajuste aceito';
 exception when invalid_parameter_value then null; end;
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'conversation',1,delivery,task_id)->>'total'='2';
 perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'task-approve',jsonb_build_object('task',task_id,'expected',expected));
 assert cali_workspace.v2_read_pilot_project_journal(a,project,'tasks',1,delivery)#>>'{rows,0,status}'='approved';
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,status}'='not_started';
 begin
  perform cali_workspace.v2_pilot_delivery_collaboration(a,project,delivery,gen_random_uuid(),'message',jsonb_build_object('task',task_id,'note','Mensagem depois do encerramento'));
  raise exception 'Conversa encerrada aceitou mensagem';
 exception when serialization_failure then null; end;
 perform cali_workspace.fixture_as('admin');
 expected:=cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}';
 perform cali_workspace.v2_pilot_project_item_lifecycle(a,project,delivery,'deliverable',expected::timestamptz,'pause','Pausa de teste',null);
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,execution_status}'='paused';
 begin
  perform cali_workspace.v2_pilot_project_item_lifecycle(a,project,delivery,'deliverable',expected::timestamptz,'resume','Retomada de teste',null);
  raise exception 'Retomada com versão antiga aceita';
 exception when serialization_failure then null; end;
 expected:=cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,updated_at}';
 perform cali_workspace.v2_pilot_project_item_lifecycle(a,project,delivery,'deliverable',expected::timestamptz,'resume','Retomada de teste',null);
 assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,execution_status}'='normal';
end $$;
rollback;
\echo Fase 4A: subtarefas, ajustes, conversas, dependências e histórico validados.
