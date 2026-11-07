begin;
do $$
<<qa>>
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  e uuid := gen_random_uuid();
  appointment uuid := gen_random_uuid();
  request uuid := gen_random_uuid();
  change uuid;
  conflict uuid := gen_random_uuid();
  past_meeting uuid := gen_random_uuid();
  past_appointment uuid := gen_random_uuid();
  absent_meeting uuid := gen_random_uuid();
  absent_appointment uuid := gen_random_uuid();
  current_at timestamptz := (current_date+8+time '10:00') at time zone 'America/Sao_Paulo';
  choice_day date := (select min(current_date+n) from generate_series(12,20) n where extract(isodow from current_date+n)<6);
  choices jsonb := jsonb_build_array(
    jsonb_build_object('start',choice_day||'T09:00','end',choice_day||'T10:00'),
    jsonb_build_object('start',choice_day||'T14:00','end',choice_day||'T15:00'));
  meeting timestamptz := (choice_day+time '09:00') at time zone 'America/Sao_Paulo';
begin
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,sync_status,source_type,source_entity_id)
  values(e,a,'Encontro de teste','meeting',current_at,current_at+interval '1 hour','client','synced','scheduling_request',appointment);
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode,status,requested_slots,confirmed_event_id)
  values(appointment,a,'Encontro de teste','remote','confirmed','[]',e);
  set local role authenticated;
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_request_pilot_agenda_change(b,appointment,request,'cancel','Outra empresa','[]');
    raise exception 'Pedido cruzado aceito';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_request_pilot_agenda_change(a,appointment,request,'reschedule','Horário repetido',
      jsonb_build_array(choices->0,choices->0));
    raise exception 'Opções iguais aceitas';
  exception when invalid_parameter_value then null; end;
  change := cali_workspace.v2_request_pilot_agenda_change(a,appointment,request,'reschedule','Conflito de agenda',choices);
  assert cali_workspace.v2_request_pilot_agenda_change(a,appointment,request,'reschedule','Conflito de agenda',choices)=change;
  assert (cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,meetingAt}')::timestamptz=current_at;
  begin
    perform cali_workspace.v2_request_pilot_agenda_change(a,appointment,gen_random_uuid(),'cancel','Pedido concorrente','[]');
    raise exception 'Segundo pedido pendente aceito';
  exception when serialization_failure then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_decide_pilot_agenda_change(a,change,true,'Horário confirmado',0);
    raise exception 'Decisão sem MFA aceita';
  exception when insufficient_privilege then null; end;

  reset role;
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility)
  values(conflict,a,'Evento concorrente','meeting',meeting,meeting+interval '1 hour','client');
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_complete_pilot_appointment(a,appointment);
    raise exception 'Admin registrou realização para encontro futuro';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_decide_pilot_agenda_change(a,change,true,'Horário confirmado',0);
    raise exception 'Conflito de horário aceito';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,latestChange,status}'='pending';

  reset role;
  update cali_workspace.events set cancelled_at=clock_timestamp() where id=conflict;
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_decide_pilot_agenda_change(a,change,true,'Horário confirmado',0)=change;
  assert cali_workspace.v2_decide_pilot_agenda_change(a,change,true,'Horário confirmado',0)=change;
  assert (cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,meetingAt}')::timestamptz=meeting;
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,sync_status}'='pending';
  perform cali_workspace.fixture_as('clientA');
  change := cali_workspace.v2_request_pilot_agenda_change(a,appointment,gen_random_uuid(),'cancel','Primeira tentativa','[]');
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_decide_pilot_agenda_change(a,change,false,'Manter a reunião',null)=change;
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,status}'='confirmed';
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,latestChange,status}'='declined';
  perform cali_workspace.fixture_as('clientA');
  change := cali_workspace.v2_request_pilot_agenda_change(a,appointment,gen_random_uuid(),'cancel','Motivo sintético','[]');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,status}'='confirmed';
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_decide_pilot_agenda_change(a,change,true,'Cancelamento confirmado',null)=change;
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,status}'='cancelled';
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,sync_status}' is null;
  reset role;
  assert (select count(*) from cali_workspace.events where title='Encontro de teste')=1;
  assert (select count(*) from cali_workspace.agenda_change_requests where event_id=e)=3;

  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,source_type,source_entity_id)
  values(past_meeting,a,'Encontro já realizado','meeting',now()-interval '2 hours',now()-interval '1 hour',
    'client','scheduling_request',past_appointment);
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode,status,requested_slots,confirmed_event_id)
  values(past_appointment,a,'Encontro já realizado','remote','confirmed','[]',past_meeting);
  insert into cali_workspace.agenda_change_requests(company_id,event_id,requested_by,action,reason,slots,original_starts_at)
  values(a,past_meeting,gen_random_uuid(),'cancel','Alteração ainda em análise','[]',now()-interval '2 hours');
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,canComplete}'='false';
  begin
    perform cali_workspace.v2_complete_pilot_appointment(a,past_appointment);
    raise exception 'Admin registrou realização com alteração pendente';
  exception when serialization_failure then null; end;
  reset role;
  update cali_workspace.agenda_change_requests set status='declined' where event_id=past_meeting;
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,canComplete}'='false';
  begin
    perform cali_workspace.v2_complete_pilot_appointment(a,past_appointment);
    raise exception 'Cliente registrou realização';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,canComplete}'='true';
  begin
    perform cali_workspace.v2_complete_pilot_appointment(b,past_appointment);
    raise exception 'Admin registrou realização em empresa divergente';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_complete_pilot_appointment(a,appointment);
    raise exception 'Admin registrou realização para encontro cancelado';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_complete_pilot_appointment(a,past_appointment)=past_appointment;
  assert cali_workspace.v2_complete_pilot_appointment(a,past_appointment)=past_appointment;
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,canComplete}'='false';
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,status}'='completed';
  reset role;
  assert (select count(*) from cali_workspace.event_outcomes where event_id=past_meeting and outcome='occurred')=1;
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,source_type,source_entity_id)
    values(absent_meeting,a,'Falta no encontro','meeting',now()-interval '2 hours',now()-interval '1 hour',
      'client','scheduling_request',absent_appointment);
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode,status,requested_slots,confirmed_event_id)
    values(absent_appointment,a,'Falta no encontro','remote','confirmed','[]',absent_meeting);
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_mark_pilot_appointment_absent(a,absent_appointment,absent_meeting,'cali',true,'Motivo reservado');
    raise exception 'Cliente registrou não realização';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_mark_pilot_appointment_absent(a,absent_appointment,past_meeting,'cali',true,'Motivo reservado');
    raise exception 'Resultado em evento diferente';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_mark_pilot_appointment_absent(a,absent_appointment,absent_meeting,'cali',true,'Motivo reservado')=absent_appointment;
  assert cali_workspace.v2_mark_pilot_appointment_absent(a,absent_appointment,absent_meeting,'cali',true,'Motivo reservado')=absent_appointment;
  begin
    perform cali_workspace.v2_mark_pilot_appointment_absent(a,absent_appointment,absent_meeting,'cali',false,'Motivo reservado');
    raise exception 'Resultado anterior alterado';
  exception when serialization_failure then null; end;
  perform cali_workspace.fixture_as('clientA');
  assert exists(select 1 from jsonb_array_elements(cali_workspace.v2_list_pilot_appointments(a,1)) item
    where item->>'id'=absent_appointment::text and item->>'status'='reschedule_review');
  assert cali_workspace.v2_list_pilot_appointments(a,1)::text not like '%Motivo reservado%';
  reset role;
  assert (select count(*) from cali_workspace.event_outcomes where event_id=absent_meeting and outcome='not_occurred')=1;
end $$;
rollback;
\echo Fase 4: pedido, remarcação, cancelamento e realização de reunião ordinária validados no piloto isolado.
