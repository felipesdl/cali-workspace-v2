-- Usado também com o ator sintético do CALI MAPA via fixture_as('admin').
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  ticket uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  saved uuid;
  bytes bytea:=convert_to('%PDF-1.4'||repeat('x',10485760-8),'UTF8');
  payload text:=replace(encode(bytes,'base64'),chr(10),'');
  manifest jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_pilot_record_action(a,gen_random_uuid(),ticket,'open','[TESTE V2] Lote 50 MiB','Ocorrência fictícia');
  select jsonb_agg(jsonb_build_object('fileName','arquivo-'||i||'.pdf','sha256',encode(sha256(bytes),'hex')) order by i)
    into manifest from generate_series(1,5) i;
  begin
    perform cali_workspace.v2_stage_pilot_record_attachment(b,request,ticket,1,'arquivo-1.pdf',payload);
    raise exception 'Envio cruzado aceito';
  exception when insufficient_privilege then null; end;
  for i in 1..5 loop
    perform cali_workspace.v2_stage_pilot_record_attachment(a,request,ticket,i,'arquivo-'||i||'.pdf',payload);
    if i=1 then
      begin
        perform cali_workspace.v2_post_pilot_staged_record_batch(a,request,ticket,'Parcial',true,manifest);
        raise exception 'Publicação parcial aceita';
      exception when serialization_failure then null; end;
    end if;
  end loop;
  saved:=cali_workspace.v2_post_pilot_staged_record_batch(a,request,ticket,'Lote completo',true,manifest);
  perform cali_workspace.v2_stage_pilot_record_attachment(a,request,ticket,1,'arquivo-1.pdf',payload);
  assert cali_workspace.v2_post_pilot_staged_record_batch(a,request,ticket,'Lote completo',true,manifest)=saved;
  begin
    perform cali_workspace.v2_post_pilot_staged_record_batch(a,request,ticket,'Alterado',true,manifest);
    raise exception 'Recibo reaproveitado com conteúdo diferente';
  exception when serialization_failure then null; end;
  assert exists(select 1 from jsonb_array_elements(cali_workspace.v2_read_pilot_record(a,ticket,1)->'messages') m
    where m->>'id'=saved::text and jsonb_array_length(m->'attachments')=5);
  reset role;
  assert (select count(*) from cali_workspace.account_record_messages where record_id=ticket)=2;
  assert (select sum(octet_length(content)) from cali_session_guard.phase4_record_attachments where message_id=saved)=52428800;
  assert not exists(select 1 from cali_session_guard.phase4_record_attachment_staging where request_id=request);
end;
$$;
