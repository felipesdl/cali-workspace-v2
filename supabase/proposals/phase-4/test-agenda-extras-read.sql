begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  online uuid := gen_random_uuid();
  event uuid := gen_random_uuid();
  payload jsonb;
begin
  insert into cali_workspace.scheduling_requests(id,company_id,title,request_mode,online_extra_requested,
    online_extra_quote_cents,online_extra_quote_accepted_at)
    values(online,a,'Extra online QA','remote',true,30000,now());
  insert into cali_workspace.scheduling_requests(company_id,title,request_mode,extra_visit,
    extra_visit_fee_cents,extra_visit_cancellation_fee_cents,billing_acknowledged_at)
    values(a,'Visita QA','in_person',true,50000,10000,now());
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility)
    values(event,a,'Reunião pública QA','meeting',now()+interval '1 day',now()+interval '25 hours','client');
  insert into cali_workspace.scheduling_requests(company_id,title,request_mode,status,confirmed_event_id)
    values(a,'Reunião pública QA','remote','confirmed',event);
  insert into cali_workspace.event_attendees(event_id,company_id,name,email,attendee_type,status)
    values(event,a,'Participante QA','agenda-qa@example.invalid','client','accepted'),
      (event,b,'Participante de outra empresa','b@example.invalid','external','pending');

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_respond_pilot_appointment(a,online,'decline','Operação ordinária',null);
    raise exception 'Decisão ordinária aceitou extra online';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  payload := cali_workspace.v2_list_pilot_agenda_extras(a,1);
  assert payload->>'total'='2';
  assert exists(select 1 from jsonb_array_elements(payload->'entries') item
    where item->>'id'=online::text and item->>'mode'='remote' and item->>'amountCents'='30000'
      and item->>'acceptedAt' is not null);
  assert exists(select 1 from jsonb_array_elements(payload->'entries') item
    where item->>'mode'='in_person' and item->>'amountCents'='50000' and item->>'cancellationCents'='10000');
  payload := cali_workspace.v2_list_pilot_appointments(a,1);
  assert jsonb_array_length(payload)=1 and jsonb_array_length(payload#>'{0,participants}')=1;
  assert payload#>>'{0,participants,0,name}'='Participante QA';
  assert payload::text not like '%@example.invalid%';
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_list_pilot_agenda_extras(b,1)->>'total'='0';
  begin
    perform cali_workspace.v2_list_pilot_agenda_extras(a,1);
    raise exception 'Leitura de extra de outra empresa';
  exception when insufficient_privilege then null; end;

  reset role;
  update cali_workspace.events set cancelled_at=clock_timestamp() where id=event;
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>'{0,participants}'='[]'::jsonb;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_pilot_appointments(a,1)#>>'{0,participants,0,name}'='Participante QA';
end;
$$;
rollback;
