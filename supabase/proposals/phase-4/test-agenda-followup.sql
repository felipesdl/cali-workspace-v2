begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  appointment uuid := gen_random_uuid();
  event uuid := gen_random_uuid();
  quote uuid := gen_random_uuid();
  request uuid := gen_random_uuid();
  client uuid;
  version text;
  quote_version text;
  accepted timestamptz;
begin
  perform cali_workspace.fixture_as('clientA');
  client:=auth.uid();
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,source_type,source_entity_id)
  values(event,a,'Reunião realizada','meeting',now()-interval '2 hours',now()-interval '1 hour','client','scheduling_request',appointment);
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode,status,confirmed_event_id)
  values(appointment,a,'Reunião realizada','remote','completed',event);
  insert into cali_workspace.event_outcomes(event_id,company_id,outcome,note)
  values(event,a,'occurred','Nota interna da reunião');
  insert into cali_workspace.scheduling_requests(id,company_id,requested_by,title,request_mode,online_extra_requested,
    online_extra_quote_cents,billing_notice)
  values(quote,a,client,'Extra online','remote',true,25000,'Condições da versão original');

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  version:=cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,minutesVersion}';
  assert version is not null;
  assert cali_workspace.v2_save_pilot_meeting_minutes(a,appointment,request,version,'Ata publicada')=appointment;
  assert cali_workspace.v2_save_pilot_meeting_minutes(a,appointment,request,version,'Ata publicada')=appointment;
  begin
    perform cali_workspace.v2_save_pilot_meeting_minutes(a,appointment,gen_random_uuid(),version,'Ata sobrescrita');
    raise exception 'Ata desatualizada aceita';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,quoteVersion}' is null;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,minutes}'='Ata publicada';
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,minutesVersion}' is null;
  assert cali_workspace.v2_list_pilot_appointments(a,1)::text not like '%Nota interna%';
  begin
    perform cali_workspace.v2_save_pilot_meeting_minutes(a,appointment,gen_random_uuid(),version,'Ata alterada');
    raise exception 'Cliente alterou ata';
  exception when insufficient_privilege then null; end;
  quote_version:=cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,quoteVersion}';
  assert quote_version is not null;
  reset role;
  update cali_workspace.scheduling_requests set billing_notice='Condições revisadas' where id=quote;
  set local role authenticated;
  begin
    perform cali_workspace.v2_accept_pilot_online_extra_quote(a,quote,quote_version);
    raise exception 'Condições desatualizadas aceitas';
  exception when invalid_parameter_value then null; end;
  quote_version:=cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,quoteVersion}';
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_accept_pilot_online_extra_quote(b,quote,quote_version);
    raise exception 'Cliente de outra empresa aceitou';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_accept_pilot_online_extra_quote(a,quote,quote_version)=quote;
  accepted:=(cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,acceptedAt}')::timestamptz;
  assert accepted is not null;
  assert cali_workspace.v2_accept_pilot_online_extra_quote(a,quote,quote_version)=quote;
  assert (cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,acceptedAt}')::timestamptz=accepted;
  assert cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,amountCents}'='25000';
  reset role;
  assert (select count(*) from cali_workspace.activity_log where entity_id=event and event_type='calendar_minutes_saved')=1;
end $$;
rollback;
\echo Ata e orçamento online validados no PostgreSQL descartável.
