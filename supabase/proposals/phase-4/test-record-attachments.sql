\ir record-attachments.sql
\ir record-attachment-batches.sql
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
do $$
declare
  company constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  record_id uuid:=gen_random_uuid();
  request_id uuid:=gen_random_uuid();
  message_id uuid;
  office text:='UEsDBBQAAAAIACqfaF10JJxTuwAAAD4BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbJWQuQ7CMAyGX6XKiqgRAwNquwArMPACVuq2EbkUuxxvT8o1sDHa//FZrk73SFzcnPVcq0EkrgFYD+SQyxDJZ6ULyaHkMfUQUZ+xJ1guFivQwQt5mcvUoZpqSx2OVordLa/ZBF+rRJZVsXkZJ1atMEZrNErW4eLbH8r8TShz8unhwUSeZYOCpjpcKCXTUnHEJHt0uQ6uIbXQBj26jCgn41+80HVG0zc/tcUUNDEb3ztbfhWHxn/ugOfbmgdQSwMEFAAAAAgAKp9oXWF7L0OJAAAA8gAAAAsAAABfcmVscy8ucmVsc43POw4CIRAG4KsQDrCzWlgYoLLZ1ngBAsMjLo8MGPX2UlisxsJy5p98f0accdU9ltxCrI090pqb5KH3egRoJmDSbSoV80hcoaT7GMlD1eaqPcJ+ng9AW4MrsTXZYiWnxe44uzwr/mMX56LBUzG3hLn/qPi6GLImj13yeyEL9r2eBstBCfh4Ub0AUEsDBBQAAAAIACqfaF2/951peQAAAJkAAAARAAAAd29yZC9kb2N1bWVudC54bWxFzkEKwjAQBdCrlB7AKS5chBgorgQ3HiEmsS10MmEmEr29nbpw8z6fYeDbZiKFF6ZcuzeuWUw793OtxQBImBN6OVBJebs9idHXrfIEjTgWppBEljzhCsdhOAH6JffONvOg+NEsCivVXcbbtbuPFrSovFt2fw/wH+O+UEsBAhQDFAAAAAgAKp9oXXQknFO7AAAAPgEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACAAqn2hdYXsvQ4kAAADyAAAACwAAAAAAAAAAAAAAgAHsAAAAX3JlbHMvLnJlbHNQSwECFAMUAAAACAAqn2hdv/edaXkAAACZAAAAEQAAAAAAAAAAAAAAgAGeAQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMAAwC5AAAARgIAAAAA';
  exact_pdf text:=replace(encode(convert_to('%PDF-'||repeat(' ',2097147),'UTF8'),'base64'),chr(10),'');
  full_limit text:=replace(encode(convert_to('%PDF-'||repeat(' ',10485755),'UTF8'),'base64'),chr(10),'');
  too_large text:=replace(encode(convert_to('%PDF-'||repeat(' ',10485756),'UTF8'),'base64'),chr(10),'');
  files jsonb;
  bad_files jsonb;
  details jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_pilot_record_action(company,gen_random_uuid(),record_id,'open','QA batch','Mensagem inicial');
  files:=jsonb_build_array(jsonb_build_object('fileName','documento.docx','base64',office));
  files:=files||jsonb_build_array(jsonb_build_object('fileName','limite.pdf','base64',exact_pdf));
  foreach bad_files in array array[
    files||jsonb_build_array(jsonb_build_object('fileName','troca.xlsx','base64',office)),
    jsonb_build_array(jsonb_build_object('fileName','excesso.pdf','base64',too_large)),
    files||files||files,
    files||jsonb_build_array(jsonb_build_object('fileName','teto.pdf','base64',full_limit))
  ] loop
    begin
      perform cali_workspace.v2_post_pilot_record_batch(company,gen_random_uuid(),record_id,'Lote inválido',false,bad_files);
      raise exception 'O lote inválido foi aceito.';
    exception when invalid_parameter_value then null; end;
  end loop;
  assert jsonb_array_length(cali_workspace.v2_read_pilot_record(company,record_id,1)->'messages')=1;
  message_id:=cali_workspace.v2_post_pilot_record_batch(company,request_id,record_id,'Lote válido',false,files);
  assert cali_workspace.v2_post_pilot_record_batch(company,request_id,record_id,'Lote válido',false,files)=message_id;
  details:=cali_workspace.v2_read_pilot_record(company,record_id,1);
  assert details->>'attachmentBatchesEnabled'='true';
  assert jsonb_array_length(details->'messages')=2 and jsonb_array_length(details#>'{messages,0,attachments}')=2;
  assert cali_workspace.v2_read_pilot_record_pdf(company,record_id,message_id)->>'fileName'='documento.docx';
  assert cali_workspace.v2_withdraw_pilot_record_attachment(company,record_id,message_id,1,'Teste de retirada')=message_id;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_read_pilot_record_attachment(company,record_id,message_id,2)->>'fileName'='limite.pdf';
  begin
    perform cali_workspace.v2_read_pilot_record_attachment(company,record_id,message_id,1);
    raise exception 'Arquivo retirado ainda disponível.';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_read_pilot_record_attachment(company,record_id,message_id,2);
    raise exception 'Arquivo de outra empresa disponível.';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo Fase 4C: anexos atômicos com mensagem, visibilidade, reexecução e retirada validados.

\ir record-attachment-staging.sql
begin;
\ir prove-record-attachment-staging.sql
rollback;
drop function cali_workspace.v2_stage_pilot_record_attachment(uuid,uuid,uuid,integer,text,text);
drop function cali_workspace.v2_post_pilot_staged_record_batch(uuid,uuid,uuid,text,boolean,jsonb);
drop table cali_session_guard.phase4_record_attachment_staging;
\ir rollback-record-attachments.sql
