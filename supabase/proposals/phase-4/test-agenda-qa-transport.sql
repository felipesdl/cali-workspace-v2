-- Fixture sem fila de envio: valida a marca que o dispatcher leria.
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  appointment uuid:=gen_random_uuid(); event uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
begin
  insert into cali_session_guard.phase4_agenda_qa(company_id,title) values(a,'[TESTE V2] Agenda sintética');
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode)
  values(appointment,a,'[TESTE V2] Agenda sintética','remote'),(other,a,'Outro pedido','remote');
  insert into cali_workspace.events(id,company_id,source_type,source_entity_id) values(event,a,'scheduling_request',appointment);
  insert into cali_workspace.notifications values(a,appointment,'scheduling_request','scheduling_request',true),
    (a,event,'scheduling_response','event',true),(a,other,'scheduling_request','scheduling_request',true),
    (b,event,'scheduling_response','event',true);
  assert not exists(select 1 from cali_workspace.notifications where company_id=a and entity_id in (appointment,event) and email_required);
  assert (select email_required from cali_workspace.notifications where entity_id=other);
  assert (select email_required from cali_workspace.notifications where company_id=b and entity_id=event);
end $$;
rollback;
\echo Fase 4B: transporte de agenda restrito ao pedido sintético e ao evento derivado.
