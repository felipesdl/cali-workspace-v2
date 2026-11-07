-- FLOW-10. PDF e mensagem confirmam juntos. O arquivo nunca fica acessível por URL.
begin;
set local lock_timeout='5s';
create function cali_workspace.v2_post_pilot_record_pdf(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_body text,p_internal boolean,
  p_file_name text,p_pdf_base64 text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  bytes bytea;
  signature bytea;
  saved uuid;
begin
  if coalesce(length(p_file_name),0) not between 5 and 180 or lower(right(p_file_name,4))<>'.pdf'
    or p_file_name ~ '[[:cntrl:]/]' or position(chr(92) in p_file_name)>0
    or coalesce(length(p_pdf_base64),0) not between 12 and 2796204 then
    raise exception using errcode='22023',message='Selecione um PDF de até 2 MiB.';
  end if;
  begin
    bytes:=decode(p_pdf_base64,'base64');
  exception when invalid_parameter_value then
    raise exception using errcode='22023',message='PDF inválido.';
  end;
  if octet_length(bytes) not between 8 and 2097152 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
    raise exception using errcode='22023',message='PDF inválido.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('record-pdf',p_record_id,btrim(p_body),coalesce(p_internal,false),
    p_file_name,encode(sha256(bytes),'hex'))::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  saved:=cali_workspace.v2_pilot_record_action(p_company_id,gen_random_uuid(),p_record_id,'message',
    p_body=>p_body,p_internal=>p_internal);
  insert into cali_session_guard.phase4_record_attachments(message_id,file_name,content)
  values(saved,p_file_name,bytes);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return saved;
end;
$$;

create function cali_workspace.v2_read_pilot_record_pdf(p_company_id uuid,p_record_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  payload jsonb;
begin
  select jsonb_build_object('id',a.message_id,'fileName',a.file_name,
    'content',encode(a.content,'base64'),'sha256',encode(sha256(a.content),'hex')) into payload
  from cali_session_guard.phase4_record_attachments a
  join cali_workspace.account_record_messages m on m.id=a.message_id
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and a.withdrawn_at is null and m.deleted_at is null
    and (admin or (r.visibility='client' and m.visibility='client'))
  for share of r,m,a;
  if not found then
    raise exception using errcode='42501',message='Anexo indisponível para este acesso.';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

create function cali_workspace.v2_withdraw_pilot_record_pdf(
  p_company_id uuid,p_record_id uuid,p_message_id uuid,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  reason text := btrim(p_reason);
begin
  if coalesce(length(reason),0) not between 3 and 1000 then
    raise exception using errcode='22023',message='Informe o motivo da retirada.';
  end if;
  perform 1 from cali_workspace.account_record_messages m
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and m.author_role='admin' and m.deleted_at is null
  for share of r,m;
  if not found then raise exception using errcode='42501',message='Anexo indisponível.'; end if;
  update cali_session_guard.phase4_record_attachments set withdrawn_at=clock_timestamp(),withdrawn_by=actor
  where message_id=p_message_id and withdrawn_at is null;
  if found then
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'record_attachment_withdrawn','account_record',p_record_id,
      jsonb_build_object('message_id',p_message_id,'reason',reason));
  elsif not exists(select 1 from cali_session_guard.phase4_record_attachments where message_id=p_message_id) then
    raise exception using errcode='42501',message='Anexo indisponível.';
  end if;
  return p_message_id;
end;
$$;

revoke all on function cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text),
  cali_workspace.v2_read_pilot_record_pdf(uuid,uuid,uuid),
  cali_workspace.v2_withdraw_pilot_record_pdf(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text),
  cali_workspace.v2_read_pilot_record_pdf(uuid,uuid,uuid),
  cali_workspace.v2_withdraw_pilot_record_pdf(uuid,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
