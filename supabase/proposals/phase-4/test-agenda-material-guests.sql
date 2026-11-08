begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  done uuid:=gen_random_uuid();
  upcoming uuid:=gen_random_uuid();
  done_event uuid:=gen_random_uuid();
  next_event uuid:=gen_random_uuid();
  pdf_id uuid;
  link_id uuid;
  guest_id uuid;
  request uuid:=gen_random_uuid();
  base64_pdf text:=encode(convert_to('%PDF-1.7 fixture','UTF8'),'base64');
begin
  insert into cali_workspace.events(id,company_id,event_type,starts_at,ends_at,visibility,source_type,source_entity_id,sync_status)
  values(done_event,a,'meeting',now()-interval '2 hours',now()-interval '1 hour','client','scheduling_request',done,'local'),
        (next_event,a,'meeting',now()+interval '1 day',now()+interval '25 hours','client','scheduling_request',upcoming,'local');
  insert into cali_workspace.event_outcomes(event_id,company_id,outcome) values(done_event,a,'occurred');
  insert into cali_workspace.scheduling_requests(id,company_id,title,status,confirmed_event_id)
  values(done,a,'Reunião concluída','completed',done_event),(upcoming,a,'Reunião futura','confirmed',next_event);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  pdf_id:=cali_workspace.v2_save_pilot_agenda_material(a,done,request,'pdf',null,'ata.pdf',base64_pdf);
  assert cali_workspace.v2_save_pilot_agenda_material(a,done,request,'pdf',null,'ata.pdf',base64_pdf)=pdf_id;
  link_id:=cali_workspace.v2_save_pilot_agenda_material(a,done,gen_random_uuid(),'link',null,'Material','https://example.invalid/ata');
  assert link_id is not null;
  begin
    perform cali_workspace.v2_save_pilot_agenda_material(a,done,gen_random_uuid(),'link',link_id,'Inseguro','https://example.invalid@externo.invalid');
    raise exception 'URL com credencial aceita';
  exception when invalid_parameter_value then null; end;
  guest_id:=cali_workspace.v2_change_pilot_agenda_guest(a,upcoming,gen_random_uuid(),null,'Convidado sintético','agenda@example.invalid');
  begin
    perform cali_workspace.v2_change_pilot_agenda_guest(a,upcoming,gen_random_uuid(),null,'Duplicado','AGENDA@example.invalid');
    raise exception 'E-mail duplicado aceito';
  exception when invalid_parameter_value then null; end;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_read_pilot_agenda_material(a,done,pdf_id)->>'content'=base64_pdf;
  assert cali_workspace.v2_read_pilot_agenda_material(a,done)#>>'{link,url}'='https://example.invalid/ata';
  assert cali_workspace.v2_list_pilot_appointments(a,1)::text not like '%agenda@example.invalid%';
  begin
    perform cali_workspace.v2_change_pilot_agenda_guest(a,upcoming,gen_random_uuid(),guest_id,null,null);
    raise exception 'Cliente retirou convidado';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_read_pilot_agenda_material(b,done,pdf_id);
    raise exception 'Cliente B leu PDF de A';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_change_pilot_agenda_guest(a,upcoming,gen_random_uuid(),guest_id,null,null)=guest_id;
  perform cali_workspace.v2_save_pilot_agenda_material(a,done,gen_random_uuid(),'pdf',pdf_id,null,null);
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_agenda_material(a,done,pdf_id);
    raise exception 'PDF retirado permaneceu disponível';
  exception when insufficient_privilege then null; end;
  reset role;
  assert exists(select 1 from cali_session_guard.phase4_agenda_material where id=pdf_id and content is not null and not current);
end $$;
rollback;
\echo Fase 4B: materiais, isolamento, retirada e convidados locais validados.
