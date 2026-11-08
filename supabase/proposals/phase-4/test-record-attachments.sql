\ir record-attachments.sql
begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  ticket uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  bytes text:=encode(convert_to('%PDF-1.4 sintético','UTF8'),'base64');
  shared uuid;
  hidden uuid;
  client_file uuid;
  image_id uuid;
  image_request uuid:=gen_random_uuid();
  png text:='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSuoAAAAASUVORK5CYII=';
  payload jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'open','Ocorrência PDF','Mensagem inicial');
  begin
    perform cali_workspace.v2_post_pilot_record_pdf(a,gen_random_uuid(),ticket,'Inválida',false,'inválido.pdf',encode(convert_to('arquivo sem cabeçalho','UTF8'),'base64'));
    raise exception 'Arquivo inválido aceito';
  exception when invalid_parameter_value then null; end;
  assert jsonb_array_length(cali_workspace.v2_read_pilot_record(a,ticket,1)->'messages')=1;
  client_file:=cali_workspace.v2_post_pilot_record_pdf(a,gen_random_uuid(),ticket,'Anexo Cliente',false,'cliente.pdf',bytes);
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_post_pilot_record_image(a,gen_random_uuid(),ticket,'Imagem inválida',false,'renomeado.png',bytes);
    raise exception 'Arquivo com extensão incompatível aceito';
  exception when invalid_parameter_value then null; end;
  image_id:=cali_workspace.v2_post_pilot_record_image(a,image_request,ticket,'Imagem pública',false,'pixel.png',png);
  assert cali_workspace.v2_post_pilot_record_image(a,image_request,ticket,'Imagem pública',false,'pixel.png',png)=image_id;
  shared:=cali_workspace.v2_post_pilot_record_pdf(a,request,ticket,'Mensagem pública',false,'publico.pdf',bytes);
  assert cali_workspace.v2_post_pilot_record_pdf(a,request,ticket,'Mensagem pública',false,'publico.pdf',bytes)=shared;
  begin
    perform cali_workspace.v2_post_pilot_record_pdf(a,request,ticket,'Mensagem pública',false,'outro.pdf',bytes);
    raise exception 'Pedido reaproveitado para outro PDF';
  exception when serialization_failure then null; end;
  hidden:=cali_workspace.v2_post_pilot_record_pdf(a,gen_random_uuid(),ticket,'Nota privada',true,'interno.pdf',bytes);
  assert cali_workspace.v2_read_pilot_record(a,ticket,1)::text like '%interno.pdf%';
  assert cali_workspace.v2_read_pilot_record_pdf(a,ticket,hidden)->>'id'=hidden::text;
  begin
    perform cali_workspace.v2_withdraw_pilot_record_pdf(a,ticket,client_file,'Mensagem original');
    raise exception 'Anexo original do Cliente retirado';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_read_pilot_record(b,ticket,1) is null;
  begin
    perform cali_workspace.v2_read_pilot_record_pdf(b,ticket,shared);
    raise exception 'PDF da outra empresa disponível';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_read_pilot_record_pdf(b,ticket,image_id);
    raise exception 'Imagem da outra empresa disponível';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  payload:=cali_workspace.v2_read_pilot_record(a,ticket,1);
  assert payload->>'attachmentsEnabled'='true';
  assert payload->>'imageAttachmentsEnabled'='true';
  assert decode(cali_workspace.v2_read_pilot_record_pdf(a,ticket,image_id)->>'content','base64')=decode(png,'base64');
  assert payload::text like '%publico.pdf%' and payload::text not like '%interno.pdf%';
  assert cali_workspace.v2_read_pilot_record_pdf(a,ticket,shared)->>'content'=bytes;
  assert current_setting('response.headers') like '%private, no-store%';
  begin
    perform cali_workspace.v2_read_pilot_record_pdf(a,ticket,hidden);
    raise exception 'PDF interno disponível';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_withdraw_pilot_record_pdf(a,ticket,shared,'Retirada QA')=shared;
  assert cali_workspace.v2_withdraw_pilot_record_pdf(a,ticket,shared,'Retirada QA')=shared;
  perform cali_workspace.fixture_as('clientA');
  payload:=cali_workspace.v2_read_pilot_record(a,ticket,1);
  assert payload::text like '%Mensagem pública%' and payload::text not like '%publico.pdf%';
  begin
    perform cali_workspace.v2_read_pilot_record_pdf(a,ticket,shared);
    raise exception 'PDF retirado disponível';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select count(*) from cali_workspace.account_record_messages where record_id=ticket)=5;
  assert (select count(*) from cali_workspace.activity_log where entity_id=ticket and event_type='record_attachment_withdrawn')=1;
  assert not exists(select 1 from cali_workspace.notifications where entity_id=ticket and email_required);
  assert not has_table_privilege('authenticated','cali_session_guard.phase4_record_attachments','select');
end $$;
rollback;
\ir rollback-record-attachments.sql
\echo Fase 4C: anexos atômicos com mensagem, visibilidade, reexecução e retirada validados.
