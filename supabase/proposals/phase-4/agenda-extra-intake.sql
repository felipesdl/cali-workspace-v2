-- FLOW-09. Abertura de extras e registros administrativos no piloto sintético.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_request_pilot_extra_appointment(
  p_company_id uuid,p_request_id uuid,p_mode text,p_title text,p_purpose text,
  p_location text,p_starts jsonb,p_minutes integer,p_ack_name text,p_acknowledged boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  title text := '[TESTE V2] '||btrim(coalesce(p_title,''));
  signature bytea;
  saved uuid;
  result jsonb;
  options jsonb;
begin
  if p_request_id is null or length(title) not between 13 and 160
    or length(coalesce(p_purpose,''))>2000 or length(coalesce(p_location,''))>400
    or length(btrim(coalesce(p_ack_name,''))) not between 5 and 160
    or p_acknowledged is distinct from true
    or not coalesce((p_mode='in_person' and p_minutes=240) or
      (p_mode='remote' and p_minutes in (60,90)),false)
    or jsonb_typeof(p_starts) is distinct from 'array' then
    raise exception using errcode='22023',message='Confira o pedido e confirme as condições.';
  end if;
  if jsonb_array_length(p_starts)<>2 or p_starts->0=p_starts->1 or exists(
    select 1 from jsonb_array_elements_text(p_starts) as slot(value)
    where value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
  ) then
    raise exception using errcode='22023',message='Informe dois horários distintos de Brasília.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array(
    'agenda-extra-intake',p_mode,title,p_purpose,p_location,p_starts,p_minutes,p_ack_name)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select jsonb_agg(jsonb_build_object('startsAt',start_at,'endsAt',start_at+make_interval(mins=>p_minutes))
    order by position) into options
  from (
    select value::timestamp at time zone 'America/Sao_Paulo' as start_at,position
    from jsonb_array_elements_text(p_starts) with ordinality as slots(value,position)
  ) local_slots;
  insert into cali_session_guard.phase4_agenda_qa(company_id,title) values(p_company_id,title)
  on conflict do nothing;
  if p_mode='in_person' then
    result:=cali_workspace.create_extra_visit_request_v1(title,p_purpose,p_location,options,p_ack_name,true);
  else
    result:=cali_workspace.client_request_online_extra_v2(title,p_purpose,options,p_ack_name,true);
  end if;
  saved:=(result->>'id')::uuid;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return saved;
end;
$$;

create or replace function cali_workspace.v2_quote_pilot_extra(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_expected timestamptz,
  p_amount_cents integer,p_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  note text := btrim(coalesce(p_note,''));
  signature bytea;
  saved uuid;
begin
  if p_request_id is null or p_expected is null or p_amount_cents is null
    or p_amount_cents not between 1 and 100000000 or length(note) not between 5 and 2000 then
    raise exception using errcode='22023',message='Informe valor e condições do orçamento.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array(
    'agenda-extra-quote',p_appointment_id,p_expected,p_amount_cents,note)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  perform 1 from cali_workspace.scheduling_requests r
  where r.id=p_appointment_id and r.company_id=p_company_id and r.updated_at=p_expected
    and not r.extra_visit and r.online_extra_requested and r.request_mode='remote'
    and r.online_extra_quote_accepted_at is null and r.status in ('submitted','client_review')
    and exists(select 1 from cali_session_guard.phase4_agenda_qa q where q.company_id=p_company_id and q.title=r.title)
  for update;
  if not found then raise exception using errcode='22023',message='O orçamento mudou ou já foi aceito.'; end if;
  perform cali_workspace.admin_quote_online_extra_v1(p_appointment_id,p_amount_cents,note);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_appointment_id);
  return p_appointment_id;
end;
$$;

create or replace function cali_workspace.v2_record_pilot_extra_expense(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_kind text,p_amount_cents integer,
  p_note text,p_hours numeric,p_approval text
)
returns text language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  note text := btrim(coalesce(p_note,''));
  approval text := btrim(coalesce(p_approval,''));
  signature bytea;
  saved uuid;
  protocol text;
  result jsonb;
begin
  if p_request_id is null or p_kind is null or p_kind not in ('transport','parking','food','extra_hours')
    or p_amount_cents is null or p_amount_cents not between 1 and 100000000
    or length(note)>2000 or length(approval)>2000
    or (p_kind='extra_hours' and (p_hours is null or p_hours not between 0.01 and 999.99 or length(approval)<5)) then
    raise exception using errcode='22023',message='Confira a despesa e a aprovação de horas adicionais.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array(
    'agenda-extra-expense',p_appointment_id,p_kind,p_amount_cents,note,p_hours,approval)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then
    select e.protocol into strict protocol from cali_workspace.extra_visit_expenses e where e.id=saved;
    return protocol;
  end if;
  perform 1 from cali_workspace.scheduling_requests r
  where r.id=p_appointment_id and r.company_id=p_company_id and r.extra_visit and r.status='completed'
    and exists(select 1 from cali_workspace.event_outcomes o where o.event_id=r.confirmed_event_id and o.outcome='occurred')
    and exists(select 1 from cali_session_guard.phase4_agenda_qa q where q.company_id=p_company_id and q.title=r.title)
  for update;
  if not found then raise exception using errcode='22023',message='Registre primeiro a realização da visita.'; end if;
  result:=cali_workspace.admin_record_extra_visit_expenses_v2(p_appointment_id,jsonb_build_array(jsonb_build_object(
    'kind',p_kind,'amountCents',p_amount_cents,'note',note,'hoursQuantity',p_hours,'approvedQuoteNote',approval)));
  saved:=(result->0->>'id')::uuid;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return result->0->>'protocol';
end;
$$;

revoke all on function
  cali_workspace.v2_request_pilot_extra_appointment(uuid,uuid,text,text,text,text,jsonb,integer,text,boolean),
  cali_workspace.v2_quote_pilot_extra(uuid,uuid,uuid,timestamptz,integer,text),
  cali_workspace.v2_record_pilot_extra_expense(uuid,uuid,uuid,text,integer,text,numeric,text)
from public,anon,authenticated,service_role;
grant execute on function
  cali_workspace.v2_request_pilot_extra_appointment(uuid,uuid,text,text,text,text,jsonb,integer,text,boolean),
  cali_workspace.v2_quote_pilot_extra(uuid,uuid,uuid,timestamptz,integer,text),
  cali_workspace.v2_record_pilot_extra_expense(uuid,uuid,uuid,text,integer,text,numeric,text)
to authenticated;
notify pgrst,'reload schema';
commit;
