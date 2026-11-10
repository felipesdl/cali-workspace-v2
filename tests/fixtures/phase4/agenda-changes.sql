-- Dependências sintéticas do contrato legado. Nenhuma comunicação externa.
alter table cali_workspace.events add primary key(id);
alter table cali_workspace.events add column source_type text,add column source_entity_id uuid,add column google_event_id text,
  add column schedule_class text not null default 'contractual',add column contract_session_number integer;
create function cali_workspace.admin_mark_scheduling_event_outcome_v1(uuid,text,text,boolean,text,boolean)
returns jsonb language sql as $$
 insert into cali_workspace.event_outcomes(event_id,company_id,outcome,reason_category,justified,note,replacement_allowed)
 select e.id,e.company_id,$2,$3,$4,$5,($2='not_occurred' and $4) from cali_workspace.events e where e.id=$1;
 update cali_workspace.scheduling_requests r set status=case
   when $2='occurred' then 'completed' when $4 then 'reschedule_review' else 'not_occurred' end
 from cali_workspace.events e where e.id=$1 and r.id=e.source_entity_id
 returning jsonb_build_object('status',r.status);
$$;

alter table cali_workspace.scheduling_requests add column online_extra_requested boolean not null default false,
  add column requested_by uuid,add column billing_notice text,
  add column updated_at timestamptz not null default clock_timestamp(),add column extra_visit_change_kind text,
  add column extra_visit_fee_cents integer,add column online_extra_quote_cents integer,
  add column billing_acknowledged_at timestamptz,add column online_extra_quote_accepted_at timestamptz,
  add column extra_visit_cancellation_fee_cents integer,
  add column meeting_entitlement text,add column contract_session_number integer,add column selected_slot jsonb;
create or replace function cali_workspace.resolve_meeting_entitlement_v66(uuid,text,timestamptz,uuid)
returns jsonb language sql as $$ select '{"billable":false,"sessionNumber":1}'::jsonb $$;
create function cali_workspace.client_accept_online_extra_quote_v1(uuid)
returns void language sql as $$
  update cali_workspace.scheduling_requests set online_extra_quote_accepted_at=clock_timestamp() where id=$1;
$$;
create table cali_workspace.event_attendees(
  id uuid primary key default gen_random_uuid(),event_id uuid,company_id uuid,user_id uuid,name text,email text,
  attendee_type text,status text,created_at timestamptz not null default clock_timestamp()
);
create table cali_workspace.agenda_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,event_id uuid not null,requested_by uuid not null,
  action text not null,reason text not null,slots jsonb not null,status text not null default 'pending',
  decision_note text,chosen_slot jsonb,original_starts_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create unique index fixture_pending_agenda_change on cali_workspace.agenda_change_requests(event_id)
  where status='pending';

create function cali_workspace.add_weekday_hours_v1(timestamptz,integer)
returns timestamptz language sql stable as $$
 select ts from generate_series($1+interval '1 hour',$1+interval '10 days',interval '1 hour') ts
 where extract(isodow from ts at time zone 'America/Sao_Paulo')<=5
 order by ts offset ($2-1) limit 1;
$$;
create function cali_workspace.client_request_agenda_change_v1(uuid,text,text,jsonb)
returns jsonb language sql as $$
 insert into cali_workspace.agenda_change_requests(company_id,event_id,requested_by,action,reason,slots,original_starts_at)
 select company_id,id,auth.uid(),$2,$3,$4,starts_at from cali_workspace.events where id=$1
 returning jsonb_build_object('id',id);
$$;
create function cali_workspace.admin_decide_agenda_change_v1(uuid,boolean,text,integer)
returns void language plpgsql as $$
declare
 target cali_workspace.agenda_change_requests%rowtype;
 chosen jsonb;
begin
 select * into target from cali_workspace.agenda_change_requests where id=$1;
 if $2 and target.action='reschedule' then
   chosen := target.slots->$4;
   update cali_workspace.events set starts_at=(chosen->>'startsAt')::timestamptz,
     ends_at=(chosen->>'endsAt')::timestamptz,sync_status='pending' where id=target.event_id;
 elsif $2 then
   update cali_workspace.events set cancelled_at=clock_timestamp() where id=target.event_id;
 end if;
 update cali_workspace.agenda_change_requests set status=case when $2 then 'approved' else 'declined' end,
   decision_note=$3,chosen_slot=chosen where id=$1;
end;
$$;

create table cali_workspace.extra_visit_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,request_id uuid not null,expense_kind text not null,
  amount_cents integer not null,protocol text,created_at timestamptz not null default clock_timestamp()
);
