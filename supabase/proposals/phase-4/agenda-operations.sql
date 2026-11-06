-- FLOW-09. Pedidos ordinários do contrato. Extras e remarcação exigem contratos próprios.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_list_pilot_appointments(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id),'[]'::jsonb) from (
      select r.id,r.title,r.status,r.request_mode,r.created_at,r.admin_note,r.requested_slots,r.admin_proposed_slots,
        e.sync_status from cali_workspace.scheduling_requests r
      left join cali_workspace.events e on e.id=r.confirmed_event_id and e.company_id=r.company_id
      where r.company_id=p_company_id and not r.extra_visit and not r.billable_extra and not r.urgency_fee_applies
      order by r.created_at desc,r.id limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

create function cali_workspace.v2_request_pilot_appointment(
  p_company_id uuid,p_request_id uuid,p_mode text,p_title text,p_purpose text,p_location text,p_slots jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  result_id uuid;
  signature bytea;
  slot jsonb;
  slots jsonb := '[]'::jsonb;
  begins timestamptz;
  ends timestamptz;
  preview jsonb;
begin
  if p_mode is null or p_mode not in ('remote','in_person') or coalesce(length(btrim(p_title)),0) not between 2 and 160
    or length(p_purpose)>2000 or length(p_location)>400 or jsonb_typeof(p_slots) is distinct from 'array' then
    raise exception using errcode='22023', message='Revise os dados da reunião.';
  end if;
  if jsonb_array_length(p_slots) not between 1 and 2
    or (p_mode='in_person' and (jsonb_array_length(p_slots)<>2 or coalesce(length(btrim(p_location)),0)<5)) then
    raise exception using errcode='22023', message='Informe as opções e o endereço aplicável.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('agenda',p_mode,p_title,p_purpose,p_location,p_slots)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;
  for slot in select value from jsonb_array_elements(p_slots) loop
    begins := (slot->>'start')::timestamp at time zone 'America/Sao_Paulo';
    ends := (slot->>'end')::timestamp at time zone 'America/Sao_Paulo';
    if begins is null or ends is null or not isfinite(begins) or not isfinite(ends) or begins<=now() or ends<=begins then
      raise exception using errcode='22023', message='Horário inválido.';
    end if;
    if exists(select 1 from jsonb_array_elements(slots) existing
      where (existing->>'startsAt')::timestamptz < ends and (existing->>'endsAt')::timestamptz > begins) then
      raise exception using errcode='22023', message='Informe opções distintas e sem sobreposição.';
    end if;
    preview := cali_workspace.preview_my_scheduling_policy_v66(p_mode,begins,'regular');
    if (preview->>'requiresAcknowledgement')::boolean is distinct from false then
      raise exception using errcode='22023', message='O horário depende de condições adicionais.';
    end if;
    slots := slots||jsonb_build_array(jsonb_build_object('startsAt',begins,'endsAt',ends));
  end loop;
  result_id := (cali_workspace.create_scheduling_request_v2(
    p_mode,btrim(p_title),p_purpose,p_location,slots,'regular',false
  )->>'id')::uuid;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

create function cali_workspace.v2_respond_pilot_appointment(
  p_company_id uuid,p_appointment_id uuid,p_action text,p_note text default null,p_index integer default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid;
  appointment cali_workspace.scheduling_requests%rowtype;
  slot jsonb;
  begins timestamptz;
  ends timestamptz;
  resolution jsonb;
begin
  if p_action is null or p_action not in ('offer','decline','confirm') or length(p_note)>2000 then
    raise exception using errcode='22023', message='Revise a decisão.';
  end if;
  actor := cali_session_guard.require_phase4_role(p_company_id,case when p_action='confirm' then 'client' else 'admin' end);
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  select * into appointment from cali_workspace.scheduling_requests r
  where r.id=p_appointment_id and r.company_id=p_company_id
    and not r.extra_visit and not r.billable_extra and not r.urgency_fee_applies for update;
  if not found then raise exception using errcode='42501', message='Solicitação indisponível.'; end if;

  if (p_action='confirm' and appointment.status<>'client_review')
    or (p_action<>'confirm' and appointment.status<>'submitted') then
    raise exception using errcode='40001', message='A solicitação mudou de estado.';
  end if;
  if p_action='decline' then
    perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,'[]',p_note,true);
    return p_appointment_id;
  end if;
  if p_index is null or p_index<0 then raise exception using errcode='22023', message='Selecione o horário.'; end if;
  slot := (case when p_action='confirm' then appointment.admin_proposed_slots else appointment.requested_slots end)->p_index;
  begins := (slot->>'startsAt')::timestamptz;
  ends := (slot->>'endsAt')::timestamptz;
  if begins is null or ends is null or begins<=now() or ends<=begins then
    raise exception using errcode='22023', message='Horário indisponível.';
  end if;
  if exists(select 1 from cali_workspace.events e where e.company_id=p_company_id and e.cancelled_at is null
    and e.starts_at<ends and coalesce(e.ends_at,e.starts_at)>begins) then
    raise exception using errcode='40001', message='O horário conflita com outro evento da empresa.';
  end if;
  if p_action='offer' then
    perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,jsonb_build_array(slot),p_note,false);
  else
    resolution := cali_workspace.resolve_meeting_entitlement_v66(p_company_id,appointment.request_mode,begins,p_appointment_id);
    if (resolution->>'billable')::boolean is distinct from false then
      raise exception using errcode='40001', message='As condições do encontro mudaram.';
    end if;
    perform cali_workspace.client_accept_scheduling_proposal_v2(p_appointment_id,p_index,false);
  end if;
  return p_appointment_id;
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_appointments(uuid,integer),
  cali_workspace.v2_request_pilot_appointment(uuid,uuid,text,text,text,text,jsonb),
  cali_workspace.v2_respond_pilot_appointment(uuid,uuid,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_appointments(uuid,integer),
  cali_workspace.v2_request_pilot_appointment(uuid,uuid,text,text,text,text,jsonb),
  cali_workspace.v2_respond_pilot_appointment(uuid,uuid,text,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
