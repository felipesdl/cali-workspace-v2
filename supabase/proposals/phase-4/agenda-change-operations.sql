-- FLOW-09. Alteração ordinária com decisão explícita; reutiliza o contrato instalado.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_request_pilot_agenda_change(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_action text,p_reason text,p_slots jsonb
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  signature bytea;
  result_id uuid;
  event_row cali_workspace.events%rowtype;
  slot jsonb;
  slots jsonb := '[]'::jsonb;
  begins timestamptz;
  ends timestamptz;
begin
  if p_request_id is null or p_action is null or p_action not in ('cancel','reschedule')
    or coalesce(length(btrim(p_reason)),0) not between 5 and 2000
    or jsonb_typeof(p_slots) is distinct from 'array' then
    raise exception using errcode='22023',message='Confira o tipo e o motivo da alteração.';
  end if;
  if jsonb_array_length(p_slots)<>(case when p_action='reschedule' then 2 else 0 end) then
    raise exception using errcode='22023',message='Informe duas opções para a remarcação.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('agenda-change',p_appointment_id,p_action,btrim(p_reason),p_slots)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;
  select e.* into event_row
  from cali_workspace.scheduling_requests r join cali_workspace.events e on e.id=r.confirmed_event_id
  where r.id=p_appointment_id and r.company_id=p_company_id and e.company_id=p_company_id and r.status='confirmed'
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
    and e.visibility='client' and e.event_type='meeting' and e.starts_at>now() and e.cancelled_at is null
  for update of e;
  if not found then raise exception using errcode='42501',message='Reunião indisponível para alteração.'; end if;
  if exists(select 1 from cali_workspace.agenda_change_requests c where c.event_id=event_row.id and c.status='pending') then
    raise exception using errcode='40001',message='Já existe uma alteração em análise.';
  end if;
  for slot in select value from jsonb_array_elements(p_slots) loop
    if coalesce(slot->>'start','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$'
      or coalesce(slot->>'end','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' then
      raise exception using errcode='22023',message='Revise os horários de Brasília.';
    end if;
    begins := (slot->>'start')::timestamp at time zone 'America/Sao_Paulo';
    ends := (slot->>'end')::timestamp at time zone 'America/Sao_Paulo';
    if begins=event_row.starts_at or ends<=begins or event_row.ends_at is null
      or (ends-begins) is distinct from (event_row.ends_at-event_row.starts_at)
      or begins<cali_workspace.add_weekday_hours_v1(now(),48)
      or extract(isodow from begins at time zone 'America/Sao_Paulo')>5
      or (begins at time zone 'America/Sao_Paulo')::time<time '09:00'
      or (ends at time zone 'America/Sao_Paulo')::time>time '16:00'
      or (begins at time zone 'America/Sao_Paulo')::date<>(ends at time zone 'America/Sao_Paulo')::date
      or exists(select 1 from jsonb_array_elements(slots) x
        where (x->>'startsAt')::timestamptz<ends and (x->>'endsAt')::timestamptz>begins) then
      raise exception using errcode='22023',message='Escolha duas opções úteis, sem sobreposição e com a duração original.';
    end if;
    slots := slots||jsonb_build_array(jsonb_build_object('startsAt',begins,'endsAt',ends));
  end loop;
  result_id := (cali_workspace.client_request_agenda_change_v1(event_row.id,p_action,btrim(p_reason),slots)->>'id')::uuid;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

create or replace function cali_workspace.v2_decide_pilot_agenda_change(
  p_company_id uuid,p_change_id uuid,p_approve boolean,p_note text,p_index integer
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  change_row cali_workspace.agenda_change_requests%rowtype;
  event_row cali_workspace.events%rowtype;
  slot jsonb;
  begins timestamptz;
  ends timestamptz;
begin
  if p_approve is null or coalesce(length(btrim(p_note)),0) not between 5 and 2000 then
    raise exception using errcode='22023',message='Explique a decisão.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  select c.* into change_row from cali_workspace.agenda_change_requests c
  join cali_workspace.scheduling_requests r on r.confirmed_event_id=c.event_id and r.company_id=c.company_id
  where c.id=p_change_id and c.company_id=p_company_id and r.status='confirmed'
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
  for update of c;
  if not found then raise exception using errcode='42501',message='Alteração indisponível.'; end if;
  if p_approve and change_row.action='reschedule' then
    if p_index is null or p_index not between 0 and 1 then
      raise exception using errcode='22023',message='Escolha um dos horários sugeridos.';
    end if;
    slot := change_row.slots->p_index;
  end if;
  if change_row.status<>'pending' then
    if change_row.status=(case when p_approve then 'approved' else 'declined' end)
      and change_row.decision_note=btrim(p_note) and change_row.chosen_slot is not distinct from slot then
      return p_change_id;
    end if;
    raise exception using errcode='40001',message='O pedido já foi respondido.';
  end if;
  select e.* into event_row from cali_workspace.events e where e.id=change_row.event_id
    and e.company_id=p_company_id and e.event_type='meeting' and e.visibility='client'
    and e.cancelled_at is null for update;
  if not found or (p_approve and (event_row.starts_at<=now()
    or event_row.starts_at is distinct from change_row.original_starts_at)) then
    raise exception using errcode='40001',message='A reunião mudou desde o pedido.';
  end if;
  if p_approve and change_row.action='reschedule' then
    begins := (slot->>'startsAt')::timestamptz;
    ends := (slot->>'endsAt')::timestamptz;
    if begins is null or ends is null or begins<=now() or ends<=begins or event_row.ends_at is null
      or (ends-begins) is distinct from (event_row.ends_at-event_row.starts_at)
      or exists(select 1 from cali_workspace.events e where e.company_id=p_company_id
        and e.id<>event_row.id and e.cancelled_at is null and e.starts_at<ends
        and coalesce(e.ends_at,e.starts_at)>begins) then
      raise exception using errcode='40001',message='O horário escolhido não está mais disponível.';
    end if;
  end if;
  perform cali_workspace.admin_decide_agenda_change_v1(p_change_id,p_approve,btrim(p_note),coalesce(p_index,0));
  return p_change_id;
end;
$$;

create or replace function cali_session_guard.phase4_record_appointment_outcome(
  p_company_id uuid,p_appointment_id uuid,p_event_id uuid,p_category text,p_justified boolean,p_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  meeting_id uuid;
  appointment_status text;
  next_outcome text := case when p_event_id is null then 'occurred' else 'not_occurred' end;
begin
  if p_event_id is not null and (
    p_category is null or p_category not in ('client','cali','external','health','travel_vacation','other')
    or p_justified is null or coalesce(length(btrim(p_note)),0) not between 3 and 1000
  ) then
    raise exception using errcode='22023',message='Confira o motivo e a justificativa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  select e.id into meeting_id from cali_workspace.scheduling_requests r
  join cali_workspace.events e on e.id=r.confirmed_event_id and e.company_id=r.company_id
  where r.id=p_appointment_id and r.company_id=p_company_id
    and e.visibility='client' and e.event_type='meeting' and e.schedule_class='contractual'
    and e.cancelled_at is null and e.ends_at<=now()
    and e.source_type='scheduling_request' and e.source_entity_id=r.id
    and (p_event_id is null or e.id=p_event_id)
  for update of e;
  if not found then raise exception using errcode='42501',message='Reunião indisponível para registro.'; end if;
  select r.status into appointment_status from cali_workspace.scheduling_requests r
  where r.id=p_appointment_id and r.company_id=p_company_id and r.confirmed_event_id=meeting_id
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
  for update;
  if not found then raise exception using errcode='42501',message='Reunião indisponível para registro.'; end if;
  if exists(select 1 from cali_workspace.event_outcomes o
    where o.event_id=meeting_id and o.company_id=p_company_id and o.outcome=next_outcome
      and ((p_event_id is null and appointment_status='completed') or
        (p_event_id is not null and appointment_status in ('reschedule_review','not_occurred')
          and o.reason_category=p_category and o.justified=p_justified and o.note=btrim(p_note)))) then
    return p_appointment_id;
  end if;
  if appointment_status is distinct from 'confirmed' or exists(select 1 from cali_workspace.agenda_change_requests c
    where c.event_id=meeting_id and c.status='pending') or exists(select 1 from cali_workspace.event_outcomes o
    where o.event_id=meeting_id) then
    raise exception using errcode='40001',message='O estado da reunião mudou.';
  end if;
  perform cali_workspace.admin_mark_scheduling_event_outcome_v1(meeting_id,next_outcome,p_category,p_justified,btrim(p_note),false);
  return p_appointment_id;
end;
$$;

revoke all on function cali_session_guard.phase4_record_appointment_outcome(uuid,uuid,uuid,text,boolean,text)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_complete_pilot_appointment(p_company_id uuid,p_appointment_id uuid)
returns uuid language sql security definer set search_path=''
as $$
  select cali_session_guard.phase4_record_appointment_outcome(p_company_id,p_appointment_id,null,null,false,null);
$$;

create or replace function cali_workspace.v2_mark_pilot_appointment_absent(
  p_company_id uuid,p_appointment_id uuid,p_event_id uuid,p_category text,p_justified boolean,p_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
begin
  if p_event_id is null then raise exception using errcode='22023',message='Informe a reunião.'; end if;
  return cali_session_guard.phase4_record_appointment_outcome(p_company_id,p_appointment_id,p_event_id,p_category,p_justified,p_note);
end;
$$;

revoke all on function cali_workspace.v2_mark_pilot_appointment_absent(uuid,uuid,uuid,text,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_mark_pilot_appointment_absent(uuid,uuid,uuid,text,boolean,text)
  to authenticated;

create or replace function cali_workspace.v2_offer_pilot_appointment_replacement(
  p_company_id uuid,p_appointment_id uuid,p_event_id uuid,p_request_id uuid,
  p_start timestamp without time zone,p_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  saved uuid;
  original cali_workspace.events%rowtype;
  begins timestamptz := p_start at time zone 'America/Sao_Paulo';
  ends timestamptz;
  mode text;
begin
  if p_request_id is null or p_event_id is null or p_start is null or not isfinite(p_start)
    or length(btrim(p_note))>2000 then
    raise exception using errcode='22023',message='Confira o horário da reposição.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('agenda-replacement',p_appointment_id,
    p_event_id,p_start,btrim(p_note))::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;

  select e.* into original from cali_workspace.events e
  join cali_workspace.event_outcomes o on o.event_id=e.id and o.company_id=e.company_id
  where e.id=p_event_id and e.company_id=p_company_id and e.event_type='meeting'
    and e.visibility='client' and e.schedule_class='contractual' and e.cancelled_at is null
    and e.source_type='scheduling_request' and e.source_entity_id=p_appointment_id
    and o.outcome='not_occurred' and o.replacement_allowed for update of e;
  if not found then raise exception using errcode='42501',message='Reposição indisponível.'; end if;
  select r.request_mode into mode from cali_workspace.scheduling_requests r
  where r.id=p_appointment_id and r.company_id=p_company_id and r.confirmed_event_id=original.id
    and r.status='reschedule_review' and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies
      or r.online_extra_requested) for update;
  if not found then raise exception using errcode='40001',message='A solicitação mudou de estado.'; end if;

  ends := begins+(original.ends_at-original.starts_at);
  if begins<=now() or ends is null or not isfinite(ends) or ends<=begins then
    raise exception using errcode='22023',message='Horário indisponível.';
  end if;
  if (cali_workspace.resolve_meeting_entitlement_v66(p_company_id,mode,begins,p_appointment_id)->>'billable')::boolean
    is distinct from false then
    raise exception using errcode='22023',message='Horário fora da cobertura contratual.';
  end if;
  if exists(select 1 from cali_workspace.events e where e.company_id=p_company_id and e.cancelled_at is null
    and e.starts_at<ends and coalesce(e.ends_at,e.starts_at)>begins) then
    raise exception using errcode='40001',message='Horário ocupado.';
  end if;
  perform cali_workspace.admin_respond_scheduling_request_v1(p_appointment_id,
    jsonb_build_array(jsonb_build_object('startsAt',begins,'endsAt',ends)),btrim(p_note),false);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_appointment_id);
  return p_appointment_id;
end;
$$;

revoke all on function cali_workspace.v2_offer_pilot_appointment_replacement(uuid,uuid,uuid,uuid,timestamp without time zone,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_offer_pilot_appointment_replacement(uuid,uuid,uuid,uuid,timestamp without time zone,text)
  to authenticated;

revoke all on function cali_workspace.v2_request_pilot_agenda_change(uuid,uuid,uuid,text,text,jsonb),
  cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer),
  cali_workspace.v2_complete_pilot_appointment(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_request_pilot_agenda_change(uuid,uuid,uuid,text,text,jsonb),
  cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer),
  cali_workspace.v2_complete_pilot_appointment(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
