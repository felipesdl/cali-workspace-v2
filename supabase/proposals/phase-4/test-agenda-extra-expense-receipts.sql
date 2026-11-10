begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  title constant text := '[TESTE V2] Realização e comprovante QA';
  meeting uuid := gen_random_uuid();
  visit uuid := gen_random_uuid();
  expense uuid := gen_random_uuid();
  operation uuid := gen_random_uuid();
  pdf text := encode(convert_to('%PDF-1.4 fixture','UTF8'),'base64');
begin
  insert into cali_session_guard.phase4_agenda_qa(company_id,title) values(a,title);
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,
    schedule_class,source_type,source_entity_id)
  values(meeting,a,title,'meeting',now()-interval '2 hours',now()-interval '1 hour','client',
    'extra','scheduling_request',visit);
  insert into cali_workspace.scheduling_requests(id,company_id,title,status,request_mode,confirmed_event_id,extra_visit,billable_extra)
    values(visit,a,title,'confirmed','in_person',meeting,true,true);
  insert into cali_workspace.extra_visit_expenses(id,company_id,request_id,expense_kind,amount_cents,protocol)
    values(expense,a,visit,'parking',1875,'CALI-DESP-QA');

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_save_pilot_extra_expense_pdf(a,expense,operation,'qa.pdf',pdf);
    raise exception 'Comprovante disponível antes do registro de realização';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,canCompleteVisit}'='true';
  assert cali_workspace.v2_complete_pilot_appointment(a,visit)=visit;
  assert cali_workspace.v2_complete_pilot_appointment(a,visit)=visit;
  assert cali_workspace.v2_list_pilot_agenda_extras(a,1)#>>'{entries,0,expenses,0,protocol}'='CALI-DESP-QA';
  assert cali_workspace.v2_save_pilot_extra_expense_pdf(a,expense,operation,'qa.pdf',pdf)=expense;
  assert cali_workspace.v2_save_pilot_extra_expense_pdf(a,expense,operation,'qa.pdf',pdf)=expense;
  assert cali_workspace.v2_read_pilot_extra_expense_pdf(a,expense)->>'content'=pdf;
  begin
    perform cali_workspace.v2_save_pilot_extra_expense_pdf(a,expense,gen_random_uuid(),'outro.pdf',pdf);
    raise exception 'Substituição sem histórico';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_read_pilot_extra_expense_pdf(b,expense);
    raise exception 'Comprovante disponível em outra empresa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_list_pilot_agenda_extras(a,1)#>'{entries,0,expenses}'='null'::jsonb;
  begin
    perform cali_workspace.v2_read_pilot_extra_expense_pdf(a,expense);
    raise exception 'Comprovante disponível para cliente';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
