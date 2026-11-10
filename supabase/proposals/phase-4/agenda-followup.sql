-- FLOW-09: ata em texto de reunião realizada e aceite de orçamento online existente.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_save_pilot_meeting_minutes(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_expected text,p_minutes text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  saved uuid;
  previous cali_workspace.event_outcomes%rowtype;
  minutes text := btrim(p_minutes);
begin
  if p_request_id is null or coalesce(p_expected,'') !~ '^[0-9a-f]{64}$'
    or coalesce(length(minutes),0) not between 1 and 6000 then
    raise exception using errcode='22023',message='Confira o texto da ata.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('meeting-minutes',p_appointment_id,p_expected,minutes)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select o.* into previous
  from cali_workspace.scheduling_requests r
  join cali_workspace.events e on e.id=r.confirmed_event_id and e.company_id=r.company_id
  join cali_workspace.event_outcomes o on o.event_id=e.id and o.company_id=e.company_id
  where r.id=p_appointment_id and r.company_id=p_company_id and r.status='completed'
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
    and e.event_type='meeting' and e.visibility='client' and e.cancelled_at is null
    and e.schedule_class='contractual' and e.source_type='scheduling_request' and e.source_entity_id=r.id
    and e.ends_at<=now() and o.outcome='occurred'
  for update of r,e,o;
  if not found then raise exception using errcode='42501',message='Reunião indisponível para ata.'; end if;
  if p_expected is distinct from encode(sha256(convert_to(jsonb_build_array(previous.transcription_note)::text,'UTF8')),'hex') then
    raise exception using errcode='40001',message='A ata mudou desde a consulta.';
  end if;
  if previous.transcription_note is distinct from minutes then
    update cali_workspace.event_outcomes set transcription_note=minutes
    where event_id=previous.event_id and company_id=p_company_id;
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'calendar_minutes_saved','event',previous.event_id,'{}');
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_appointment_id);
  return p_appointment_id;
end;
$$;

create or replace function cali_workspace.v2_accept_pilot_online_extra_quote(
  p_company_id uuid,p_appointment_id uuid,p_expected text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  previous cali_workspace.scheduling_requests%rowtype;
begin
  select * into previous from cali_workspace.scheduling_requests
  where id=p_appointment_id and company_id=p_company_id and requested_by=actor
    and online_extra_requested and not extra_visit and request_mode='remote' for update;
  if not found then raise exception using errcode='42501',message='Orçamento indisponível.'; end if;
  if coalesce(previous.online_extra_quote_cents,0)<=0 or p_expected is null
    or p_expected is distinct from encode(sha256(convert_to(
      jsonb_build_array(previous.online_extra_quote_cents,previous.billing_notice)::text,'UTF8')),'hex') then
    raise exception using errcode='22023',message='Confira o valor atualizado do orçamento.';
  end if;
  if previous.online_extra_quote_accepted_at is not null then return p_appointment_id; end if;
  if previous.status not in ('submitted','client_review') then
    raise exception using errcode='22023',message='O orçamento não está aguardando aceite.';
  end if;
  perform cali_workspace.client_accept_online_extra_quote_v1(p_appointment_id);
  return p_appointment_id;
end;
$$;

revoke all on function cali_workspace.v2_save_pilot_meeting_minutes(uuid,uuid,uuid,text,text),
  cali_workspace.v2_accept_pilot_online_extra_quote(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_pilot_meeting_minutes(uuid,uuid,uuid,text,text),
  cali_workspace.v2_accept_pilot_online_extra_quote(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
