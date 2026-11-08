-- FLOW-09. Convidados externos em reuniões locais.
begin;
set local lock_timeout='5s';
create or replace function cali_workspace.v2_change_pilot_agenda_guest(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_guest_id uuid,p_name text,p_email text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  meeting uuid;
  guest uuid;
  signature bytea;
  guest_name text := nullif(btrim(p_name),'');
  email_address text := nullif(lower(btrim(p_email)),'');
begin
  if p_request_id is null or (p_guest_id is null and (
      coalesce(length(guest_name),0) not between 2 and 140 or guest_name ~ '[[:cntrl:]]'
      or coalesce(length(email_address),0) not between 5 and 254
      or email_address !~ '^[^[:space:]@]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'))
    or (p_guest_id is not null and (guest_name is not null or email_address is not null)) then
    raise exception using errcode='22023',message='Confira o nome e o e-mail do convidado.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('meeting-guest',p_appointment_id,p_guest_id,guest_name,email_address)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  guest:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if guest is not null then return guest; end if;
  select e.id into meeting
  from cali_workspace.scheduling_requests r
  join cali_workspace.events e on e.id=r.confirmed_event_id and e.company_id=r.company_id
  where r.id=p_appointment_id and r.company_id=p_company_id and r.status='confirmed'
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
    and e.event_type='meeting' and e.visibility='client' and e.cancelled_at is null and e.starts_at>now()
    and e.sync_status='local' and e.google_event_id is null and e.schedule_class='contractual'
    and e.source_type='scheduling_request' and e.source_entity_id=r.id
  for update of r,e;
  if not found then raise exception using errcode='42501',message='Reunião indisponível para edição de convidados.'; end if;
  if p_guest_id is null then
    if exists(select 1 from cali_workspace.event_attendees
      where company_id=p_company_id and event_id=meeting and lower(btrim(email))=email_address) then
      raise exception using errcode='22023',message='Este e-mail já está na reunião.';
    end if;
    insert into cali_workspace.event_attendees(event_id,company_id,name,email,attendee_type,status)
    values(meeting,p_company_id,guest_name,email_address,'external','pending') returning id into guest;
  else
    delete from cali_workspace.event_attendees where id=p_guest_id and event_id=meeting and company_id=p_company_id
      and attendee_type='external' and user_id is null and status='pending' returning id into guest;
    if not found then raise exception using errcode='42501',message='Convidado indisponível para retirada.'; end if;
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,guest);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,case when p_guest_id is null then 'calendar_guest_added' else 'calendar_guest_removed' end,
    'event',meeting,jsonb_build_object('guestId',guest));
  return guest;
end;
$$;
revoke all on function cali_workspace.v2_change_pilot_agenda_guest(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_change_pilot_agenda_guest(uuid,uuid,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
