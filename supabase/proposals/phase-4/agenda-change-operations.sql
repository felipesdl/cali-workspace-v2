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

revoke all on function cali_workspace.v2_request_pilot_agenda_change(uuid,uuid,uuid,text,text,jsonb),
  cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_request_pilot_agenda_change(uuid,uuid,uuid,text,text,jsonb),
  cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
