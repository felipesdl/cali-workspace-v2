-- FLOW-09. Decisões de pedidos adicionais existentes, com valores e regras legados.
begin;
set local lock_timeout='5s';
create or replace function cali_workspace.v2_act_pilot_extra_appointment(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_expected timestamptz,
  p_action text,p_index integer,p_note text,p_slots jsonb,p_charge boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  required_role text := case when p_action in ('book-visit','offer','decline','fee') then 'admin' else 'client' end;
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,required_role);
  request_row cali_workspace.scheduling_requests%rowtype;
  signature bytea;
  saved uuid;
  note text := btrim(coalesce(p_note,''));
  chosen jsonb;
  options jsonb := '[]';
  option_row jsonb;
  begins timestamptz;
  ends timestamptz;
begin
  if p_action is null or p_action not in ('book-visit','offer','decline','fee','confirm','counter','cancel','reschedule')
    or p_request_id is null or p_expected is null or length(note)>2000 then
    raise exception using errcode='22023',message='Confira a ação e os dados do pedido.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('agenda-extra',p_appointment_id,p_expected,p_action,p_index,note,p_slots,p_charge)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select * into request_row from cali_workspace.scheduling_requests
  where id=p_appointment_id and company_id=p_company_id
    and extra_visit<>online_extra_requested and (required_role='admin' or requested_by=actor)
    and exists(select 1 from cali_session_guard.phase4_agenda_qa q
      where q.company_id=p_company_id and q.title=scheduling_requests.title)
  for update;
  if not found then raise exception using errcode='42501',message='Pedido adicional indisponível.'; end if;
  if request_row.updated_at is distinct from p_expected then
    raise exception using errcode='22023',message='O pedido mudou. Atualize a agenda.';
  end if;
  if p_action in ('counter','reschedule') then
    if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots)<>2 then
      raise exception using errcode='22023',message='Informe duas opções.';
    end if;
    for option_row in select value from jsonb_array_elements(p_slots) loop
      begins:=(option_row->>'start')::timestamp at time zone 'America/Sao_Paulo';
      ends:=(option_row->>'end')::timestamp at time zone 'America/Sao_Paulo';
      options:=options||jsonb_build_array(jsonb_build_object('startsAt',begins,'endsAt',ends));
    end loop;
  end if;
  case p_action
    when 'book-visit','offer','decline' then
      if request_row.status not in ('submitted','reschedule_review') or
        (p_action='book-visit' and not request_row.extra_visit) then
        raise exception using errcode='22023',message='O pedido não está disponível para esta decisão.';
      end if;
      if p_action='decline' then
        perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,'[]',note,true);
      elsif p_action='offer' and request_row.extra_visit then
        perform cali_workspace.check_extra_visit_slots_v1(request_row.requested_slots,0);
        perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,request_row.requested_slots,note,false);
      else
        chosen:=request_row.requested_slots->p_index;
        if p_index is null or p_index not between 0 and 1 or chosen is null
          or coalesce((chosen->>'startsAt')::timestamptz<=now(),true)
          or coalesce((chosen->>'endsAt')::timestamptz<=(chosen->>'startsAt')::timestamptz,true) then
          raise exception using errcode='22023',message='Escolha um horário válido.';
        end if;
        if p_action='book-visit' then
          perform cali_workspace.admin_confirm_extra_visit_v1(p_appointment_id,p_index);
        else
          perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,jsonb_build_array(chosen),note,false);
        end if;
      end if;
    when 'confirm' then
      chosen:=request_row.admin_proposed_slots->p_index;
      if request_row.status<>'client_review' or p_index is null or p_index not between 0 and 1 or chosen is null
        or (request_row.online_extra_requested and request_row.online_extra_quote_accepted_at is null) then
        raise exception using errcode='22023',message='Confira o horário e o aceite do orçamento.';
      end if;
      if request_row.extra_visit then
        perform cali_workspace.client_accept_extra_visit_proposal_v1(p_appointment_id,p_index);
      else
        begins:=(chosen->>'startsAt')::timestamptz;
        ends:=(chosen->>'endsAt')::timestamptz;
        if begins is null or ends is null or begins<=now() or ends<=begins
          or (cali_workspace.resolve_meeting_entitlement_v66(p_company_id,'remote',begins,p_appointment_id)->>'billable')::boolean
            is distinct from true
          or exists(select 1 from cali_workspace.events where company_id=p_company_id and cancelled_at is null
            and starts_at<ends and coalesce(ends_at,starts_at)>begins) then
          raise exception using errcode='22023',message='Horário indisponível.';
        end if;
        perform cali_workspace.client_accept_scheduling_proposal_v2(p_appointment_id,p_index,false);
      end if;
    when 'counter' then
      if not request_row.extra_visit or request_row.status<>'client_review' then
        raise exception using errcode='22023',message='A contraproposta está indisponível.';
      end if;
      perform cali_workspace.client_counter_extra_visit_v1(p_appointment_id,options,note);
    when 'cancel','reschedule' then
      if not request_row.extra_visit or request_row.status not in ('submitted','client_review','reschedule_review','confirmed')
        or length(note)<5 then
        raise exception using errcode='22023',message='Confira a visita e o motivo da alteração.';
      end if;
      perform cali_workspace.client_change_extra_visit_v2(p_appointment_id,p_action,note,options);
    when 'fee' then
      if not request_row.extra_visit or request_row.extra_visit_cancellation_fee_cents is not null
        or request_row.extra_visit_change_kind is null or length(note)<5 or p_charge is null then
        raise exception using errcode='22023',message='Confira a alteração e o motivo da decisão.';
      end if;
      perform cali_workspace.admin_decide_extra_visit_change_v2(p_appointment_id,p_charge,note);
  end case;
  if p_action in ('book-visit','confirm') then
    update cali_workspace.events set sync_status='local'
    where company_id=p_company_id and source_type='scheduling_request' and source_entity_id=p_appointment_id
      and sync_status='pending' and cancelled_at is null;
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_appointment_id);
  return p_appointment_id;
end;
$$;
revoke all on function cali_workspace.v2_act_pilot_extra_appointment(uuid,uuid,uuid,timestamptz,text,integer,text,jsonb,boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_act_pilot_extra_appointment(uuid,uuid,uuid,timestamptz,text,integer,text,jsonb,boolean)
  to authenticated;
notify pgrst,'reload schema';
commit;
