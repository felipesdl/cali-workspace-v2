-- FLOW-10. Avaliação e reabertura pelo contrato instalado, com escopo e reexecução V2.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_review_pilot_record(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_action text,
  p_score integer,p_note text,p_reopen_id uuid
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid;
  record_row cali_workspace.account_records%rowtype;
  reopen_row cali_workspace.account_record_reopen_requests%rowtype;
  fingerprint bytea;
  result_id uuid;
  note text := nullif(btrim(p_note),'');
  previous_chat_context text;
  decision text;
  outcome jsonb;
begin
  if p_action is null or p_action not in ('evaluate','request_reopen','approve_reopen','reject_reopen')
    or p_record_id is null or length(note)>2000
    or ((p_action in ('approve_reopen','reject_reopen')) is distinct from (p_reopen_id is not null))
    or (p_action<>'evaluate' and p_score is not null)
    or (p_action='evaluate' and (coalesce(p_score,0) not between 1 and 5
      or (p_score<=3 and coalesce(length(note),0)<3)))
    or (p_action in ('request_reopen','reject_reopen') and coalesce(length(note),0)<3) then
    raise exception using errcode='22023',message='Confira a avaliação ou o motivo informado.';
  end if;
  actor := cali_session_guard.require_phase4_role(p_company_id,
    case when p_reopen_id is null then 'client' else 'admin' end);
  fingerprint := sha256(convert_to(jsonb_build_array('record-review',p_record_id,p_action,p_score,note,p_reopen_id)::text,'UTF8'));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,fingerprint);
  if result_id is not null then return result_id; end if;

  -- Serializa mutações V2 do mesmo assunto e mantém a ordem usada na decisão legada.
  perform pg_advisory_xact_lock(hashtextextended('phase4-record-review:'||p_record_id::text,0));
  if p_reopen_id is not null then
    select * into reopen_row from cali_workspace.account_record_reopen_requests q
    where q.id=p_reopen_id and q.record_id=p_record_id and q.company_id=p_company_id for update;
    if not found then raise exception using errcode='42501',message='Pedido indisponível.'; end if;
  end if;
  select * into record_row from cali_workspace.account_records r
  where r.id=p_record_id and r.company_id=p_company_id and r.visibility='client' for update;
  if not found then raise exception using errcode='42501',message='Ocorrência indisponível.'; end if;

  previous_chat_context := current_setting('cali_workspace.v2_record_chat',true);
  perform set_config('cali_workspace.v2_record_chat',p_company_id::text||':'||p_record_id::text,true);

  case p_action
    when 'evaluate' then
      if record_row.workflow_status is distinct from 'completed' then
        raise exception using errcode='40001',message='A ocorrência não está finalizada.';
      end if;
      select f.id into result_id from cali_workspace.account_record_feedback f
      where f.record_id=p_record_id and f.company_id=p_company_id and f.user_id=actor
        and f.score=p_score and f.comment is not distinct from note;
      if result_id is null then
        result_id := (cali_workspace.submit_account_record_feedback(p_record_id,p_score,note)->>'feedback_id')::uuid;
      end if;
    when 'request_reopen' then
      if record_row.workflow_status is null or record_row.workflow_status not in ('standby','completed','cancelled') then
        raise exception using errcode='40001',message='A ocorrência está aberta para conversa.';
      end if;
      if record_row.workflow_status='completed' and not exists(
        select 1 from cali_workspace.account_record_feedback f where f.record_id=p_record_id
          and f.company_id=p_company_id and f.user_id=actor
      ) then raise exception using errcode='P4C01',message='Avalie a ocorrência antes de pedir a reabertura.'; end if;
      outcome := cali_workspace.request_account_record_reopen(p_record_id,note);
      result_id := (outcome->>'request_id')::uuid;
      if coalesce((outcome->>'already_pending')::boolean,false)=false then
        insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
        values(p_company_id,actor,'record_reopen_requested','account_record',p_record_id,
          jsonb_build_object('requestId',result_id));
      end if;
    else
      decision := case when p_action='approve_reopen' then 'approved' else 'rejected' end;
      if reopen_row.status=decision and reopen_row.decided_by=actor
        and reopen_row.decision_note is not distinct from note then
        result_id := reopen_row.id;
      else
        if reopen_row.status is distinct from 'pending' or record_row.workflow_status is null
          or record_row.workflow_status not in ('standby','completed','cancelled') then
          raise exception using errcode='40001',message='O pedido ou a ocorrência mudou.';
        end if;
        result_id := (cali_workspace.decide_account_record_reopen(p_reopen_id,decision,note)->>'request_id')::uuid;
        insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
        values(p_company_id,actor,'record_reopen_decided','account_record',p_record_id,
          jsonb_build_object('decision',decision,'requestId',result_id));
      end if;
  end case;
  perform set_config('cali_workspace.v2_record_chat',coalesce(previous_chat_context,''),true);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,fingerprint,result_id);
  return result_id;
end;
$$;

revoke all on function cali_workspace.v2_review_pilot_record(uuid,uuid,uuid,text,integer,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_review_pilot_record(uuid,uuid,uuid,text,integer,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
