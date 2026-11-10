begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  item uuid := gen_random_uuid();
  private_item uuid := gen_random_uuid();
  ticket uuid;
  request uuid := gen_random_uuid();
  feedback uuid;
begin
  insert into cali_workspace.account_records(id,company_id,title,workflow_status,visibility)
  values(item,b,'Ocorrência QA','completed','client'),(private_item,b,'Ocorrência interna QA','completed','internal');
  set local role authenticated;
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'request_reopen',null,'A questão voltou',null);
    raise exception 'Reabertura sem avaliação aceita';
  exception when sqlstate 'P4C01' then null; end;
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'evaluate',2,'',null);
    raise exception 'Nota baixa sem comentário aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),private_item,'evaluate',5,null,null);
    raise exception 'Avaliação de ocorrência interna aceita';
  exception when insufficient_privilege then null; end;
  feedback := cali_workspace.v2_review_pilot_record(b,request,item,'evaluate',2,'Resposta incompleta',null);
  assert cali_workspace.v2_review_pilot_record(b,request,item,'evaluate',2,'Resposta incompleta',null)=feedback;
  assert cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'evaluate',2,'Resposta incompleta',null)=feedback;
  assert cali_workspace.v2_read_pilot_record(b,item,1)#>>'{feedback,score}'='2';
  perform cali_workspace.fixture_as('clientB2');
  assert cali_workspace.v2_read_pilot_record(b,item,1)->'feedback'='null'::jsonb;
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'request_reopen',null,'Ainda preciso de ajuda',null);
    raise exception 'Avaliação de outro acesso foi reaproveitada';
  exception when sqlstate 'P4C01' then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_review_pilot_record(a,gen_random_uuid(),item,'evaluate',5,null,null);
    raise exception 'Avaliação cruzada aceita';
  exception when insufficient_privilege then null; end;

  perform cali_workspace.fixture_as('clientB');
  ticket := cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'request_reopen',null,'Rever o assunto @CALI',null);
  assert cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'request_reopen',null,'Pedido repetido',null)=ticket;
  assert cali_workspace.v2_read_pilot_record(b,item,1)->>'status'='completed';
  assert cali_workspace.v2_read_pilot_record(b,item,1)#>>'{reopen,status}'='pending';
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'approve_reopen',null,null,ticket);
    raise exception 'Aprovação sem MFA aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'reject_reopen',null,'Falta evidência',ticket)=ticket;
  assert cali_workspace.v2_read_pilot_record(b,item,1)->>'status'='completed';
  assert cali_workspace.v2_read_pilot_record(b,item,1)#>>'{reopen,status}'='rejected';
  begin
    perform cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'approve_reopen',null,null,ticket);
    raise exception 'Decisão incompatível aceita';
  exception when serialization_failure then null; end;

  perform cali_workspace.fixture_as('clientB');
  ticket := cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'request_reopen',null,'Anexei a evidência',null);
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'approve_reopen',null,'Nova análise',ticket)=ticket;
  assert cali_workspace.v2_review_pilot_record(b,gen_random_uuid(),item,'approve_reopen',null,'Nova análise',ticket)=ticket;
  assert cali_workspace.v2_read_pilot_record(b,item,1)->>'status'='in_progress';
  perform cali_workspace.v2_pilot_record_action(b,gen_random_uuid(),private_item,'change_status',p_expected_status=>'completed',p_next_status=>'in_progress');
  assert cali_workspace.v2_read_pilot_record(b,private_item,1)->>'status'='in_progress';
  reset role;
  assert (select count(*) from cali_workspace.account_record_feedback where record_id=item and score=2)=1;
  assert (select count(*) from cali_workspace.notifications where entity_id=item and notification_type='record_feedback')=1;
  assert (select count(*) from cali_workspace.notifications where entity_id=item and notification_type='record_reopen_request')=2;
  assert not exists(select 1 from cali_workspace.notifications where entity_id=item and notification_type='chat_mention' and email_required);
end $$;
rollback;
\echo Fase 4: avaliação, pedido, recusa e aprovação de reabertura validados no piloto descartável.
