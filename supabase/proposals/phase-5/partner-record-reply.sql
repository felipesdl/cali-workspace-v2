-- Partner responde somente ocorrências inscritas, no módulo atribuído. Chat sem e-mail.
create function cali_workspace.v2_reply_partner_pilot_record(
  p_company uuid,p_request uuid,p_record uuid,p_body text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  record_row cali_workspace.account_records;
  body text:=nullif(btrim(p_body),'');
  receipt bytea;
  result uuid;
  previous_chat_context text;
begin
  perform cali_session_guard.require_phase5_partner(p_company,'records');
  if p_request is null or p_record is null or coalesce(length(body),0) not between 1 and 4000 then
    raise exception using errcode='22023',message='Confira a mensagem.';
  end if;
  receipt:=sha256(convert_to(jsonb_build_array('phase5-record-reply',invitation.id,p_record,body)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase5-record:'||actor::text||':'||p_company::text,0));
  result:=cali_session_guard.read_phase4_receipt(actor,p_company,p_request,receipt);
  if result is not null then return result; end if;

  select r.* into record_row from cali_workspace.account_records r
  join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
  where r.id=p_record and r.company_id=p_company and r.visibility='client' for update of r;
  if not found or record_row.workflow_status is null or record_row.workflow_status in ('completed','cancelled') then
    raise exception using errcode='42501',message='Conversa indisponível.';
  end if;
  previous_chat_context:=current_setting('cali_workspace.v2_record_chat',true);
  perform set_config('cali_workspace.v2_record_chat',p_company::text||':'||p_record::text,true);
  insert into cali_workspace.account_record_messages(record_id,company_id,author_id,author_role,body,visibility)
    values(p_record,p_company,actor,'admin',body,'client') returning id into result;
  perform set_config('cali_workspace.v2_record_chat',coalesce(previous_chat_context,''),true);

  update cali_workspace.account_records set workflow_status='waiting_client',last_activity_at=now(),
    requires_action=false,first_admin_opened_at=coalesce(first_admin_opened_at,now()),updated_at=now()
    where id=p_record;
  perform cali_workspace.notify_workspace_movement(p_company,actor,'client','record_message',
    'Nova mensagem na ocorrência',record_row.title,'account_record',p_record,
    '/cliente/registros?record='||p_record::text,'normal',false);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,actor,'partner_pilot_record_reply','account_record',p_record,jsonb_build_object('message_id',result));
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company,p_request,receipt,result);
  return result;
end;
$$;

revoke all on function cali_workspace.v2_reply_partner_pilot_record(uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_reply_partner_pilot_record(uuid,uuid,uuid,text) to authenticated;
