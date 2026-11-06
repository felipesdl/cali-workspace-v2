-- Dependências legadas simuladas, incluindo a fila de comunicações sem transporte.
\ir read-context.sql
alter table cali_workspace.projects add column start_date date;
alter table cali_workspace.projects alter column status set default 'active';

alter table cali_workspace.projects alter column execution_status set default 'normal';
alter table cali_workspace.project_workstreams add primary key (id);
alter table cali_workspace.project_workstreams alter column execution_status set default 'normal';
alter table cali_workspace.deliverables add primary key (id);
alter table cali_workspace.deliverables add column workstream_id uuid, add column workstream text;
alter table cali_workspace.deliverables alter column execution_status set default 'normal';
alter table cali_workspace.account_records add primary key(id);
alter table cali_workspace.account_records add column record_type text, add column source_actor text,
 add column requires_action boolean, add column created_by uuid, add column last_activity_at timestamptz, add column assigned_to uuid;
create table cali_workspace.account_record_messages(
 id uuid primary key default gen_random_uuid(),record_id uuid,company_id uuid,author_id uuid,author_role text,
 body text,visibility text,created_at timestamptz not null default clock_timestamp(),deleted_at timestamptz
);
create table cali_workspace.activity_log(
 company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb
);
create table cali_workspace.notifications(
 company_id uuid, entity_id uuid, notification_type text, entity_type text,email_required boolean
);
create function cali_workspace.fixture_record_mention() returns trigger language plpgsql as $$
begin
 if new.body like '%@CALI%' then
  insert into cali_workspace.notifications values(new.company_id,new.record_id,'chat_mention','account_record',true);
 end if;
 return new;
end $$;
create trigger fixture_record_mention after insert on cali_workspace.account_record_messages
for each row execute function cali_workspace.fixture_record_mention();
create table cali_workspace.work_timers(
 id uuid primary key default gen_random_uuid(),company_id uuid,project_id uuid,user_id uuid,description text,
 client_visible boolean,status text,started_at timestamptz default clock_timestamp()
);
create table cali_workspace.data_subject_requests(
 id uuid primary key default gen_random_uuid(),company_id uuid,user_id uuid,kind text,details text,
 status text default 'open',answer text,created_at timestamptz default clock_timestamp()
);
create function cali_workspace.notify_workspace_movement(uuid,uuid,text,text,text,text,text,uuid,text,text,boolean)
returns uuid[] language sql as $$
 insert into cali_workspace.notifications values($1,$8,$4,$7,$11);
 select '{}'::uuid[];
$$;
create function cali_workspace.fixture_open_project_review() returns trigger language plpgsql as $$
begin
 if old.planning_status='draft' and new.planning_status='client_review' then
  if not exists(select 1 from cali_workspace.deliverables where project_id=new.id and due_at is not null)
   or exists(select 1 from cali_workspace.project_workstreams w where w.project_id=new.id and not exists(
      select 1 from cali_workspace.deliverables d where d.project_id=new.id and d.workstream_id=w.id)) then
   raise exception using errcode='22023',message='Cronograma incompleto';
  end if;
  insert into cali_workspace.project_review_requests values(gen_random_uuid(),new.company_id,new.id,'pending',1,
    now()+interval '72 hours',now(),null);
 end if;
 return new;
end $$;
create trigger fixture_open_project_review after update of planning_status on cali_workspace.projects
for each row execute function cali_workspace.fixture_open_project_review();

create function cali_workspace.client_approve_project_schedule(p_project uuid) returns void language sql as $$
 update cali_workspace.project_review_requests set status='approved' where project_id=p_project and status='pending';
 update cali_workspace.projects set planning_status='active' where id=p_project;
$$;
create function cali_workspace.client_request_project_schedule_adjustment_v39(uuid,text,uuid,text,text,text,date,uuid)
returns void language sql as $$
 update cali_workspace.project_review_requests set status='adjustment_requested', response_note=$4
  where project_id=$1 and status='pending';
 update cali_workspace.projects set planning_status='adjustment_requested' where id=$1;
$$;
create function cali_workspace.admin_resolve_project_schedule_adjustment(p_review uuid,p_accept boolean,p_note text)
returns void language sql as $$
 update cali_workspace.project_review_requests set status=case when p_accept then 'accepted' else 'rejected' end
 where id=p_review;
 insert into cali_workspace.project_review_requests
 select gen_random_uuid(),company_id,project_id,'pending',request_number+1,now()+interval '72 hours',now(),null
 from cali_workspace.project_review_requests where id=p_review;
 update cali_workspace.projects set planning_status='client_review'
 where id=(select project_id from cali_workspace.project_review_requests where id=p_review);
$$;
create function cali_workspace.add_manual_hour_entry(uuid,uuid,uuid,uuid,date,integer,text,text,text,boolean,timestamptz,timestamptz)
returns uuid language sql as $$
 insert into cali_workspace.hour_entries values(gen_random_uuid(),$1,$2,$5,$6,$7,$8,$9,$10) returning id;
$$;
create function cali_workspace.start_work_timer_v2(uuid,uuid,uuid,uuid,text,text,boolean)
returns uuid language sql as $$
 insert into cali_workspace.work_timers(company_id,project_id,user_id,description,client_visible,status)
 values($1,$2,auth.uid(),$6,$7,'active') returning id;
$$;
create function cali_workspace.pause_work_timer(uuid) returns void language sql as $$
 update cali_workspace.work_timers set status='paused' where id=$1;
$$;
create function cali_workspace.resume_work_timer(uuid) returns void language sql as $$
 update cali_workspace.work_timers set status='active' where id=$1;
$$;
create function cali_workspace.stop_work_timer(uuid,text) returns integer language sql as $$
 update cali_workspace.work_timers set status='stopped' where id=$1;
 insert into cali_workspace.hour_entries
 select gen_random_uuid(),company_id,project_id,'2026-11-09',15,description,'Execução',null,client_visible
 from cali_workspace.work_timers where id=$1 returning minutes;
$$;
create function cali_workspace.set_account_record_status(uuid,text) returns void language sql as $$
 update cali_workspace.account_records set workflow_status=$2 where id=$1;
$$;
create function cali_workspace.acknowledge_report_v55(uuid) returns jsonb language sql as $$
 update cali_workspace.reports set acknowledged_at=coalesce(acknowledged_at,now()) where id=$1
 returning jsonb_build_object('acknowledged_at',acknowledged_at,'acknowledgement_protocol','CIE-QA');
$$;
create function cali_workspace.report_generation_readiness_v61(uuid,text,date,date) returns jsonb language sql as $$
 select jsonb_build_object('mode','preview','collected_days',4,'required_days',20,'available_on',$3+19);
$$;
create function cali_workspace.request_data_subject_right(text,text) returns uuid language sql as $$
 insert into cali_workspace.data_subject_requests(company_id,user_id,kind,details)
 values(cali_workspace.current_company_id(),auth.uid(),$1,$2) returning id;
$$;
create function cali_workspace.admin_answer_data_subject_request(uuid,text) returns void language sql as $$
 update cali_workspace.data_subject_requests set status='answered',answer=$2 where id=$1;
$$;

create function cali_workspace.fixture_as(role text) returns void language sql as $$
 select set_config('test.jwt',case role
  when 'admin' then '{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal2"}'
  when 'admin1' then '{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal1"}'
  when 'clientA' then '{"sub":"00000000-0000-4000-8000-000000000011","aal":"aal1"}'
  when 'clientB' then '{"sub":"00000000-0000-4000-8000-000000000012","aal":"aal1"}'
  else '{"sub":"00000000-0000-4000-8000-000000000015","aal":"aal1"}' end,true);
$$;

alter table cali_workspace.deliverables add column is_document boolean default false, add column final_drive_url text,
 add column approved_at timestamptz, add column approval_requested_at timestamptz, add column client_response_at timestamptz,
 add column locked_at timestamptz, add column work_closed_at timestamptz, add column work_close_reason text,
 add column work_closed_by uuid;
alter table cali_workspace.work_timers add column deliverable_id uuid;
create unique index fixture_one_open_timer on cali_workspace.work_timers(user_id,company_id)
where status in ('active','paused');
create table cali_workspace.deliverable_tasks(
 deliverable_id uuid,status text,completed_at timestamptz,work_closed_at timestamptz,work_close_reason text
);
create function cali_workspace.close_timer_session_at(uuid,timestamptz,text,uuid) returns void language sql as $$
 update cali_workspace.work_timers set status='stopped' where id=$1;
$$;
create table cali_workspace.fixture_feedback(delivery_id uuid,user_id uuid,score integer,primary key(delivery_id,user_id));
create function cali_workspace.client_approve_deliverable_with_feedback(uuid,integer,text) returns void language sql as $$
 insert into cali_workspace.fixture_feedback values($1,auth.uid(),$2);
 update cali_workspace.deliverables set status='approved',approved_at=clock_timestamp(),updated_at=clock_timestamp() where id=$1;
$$;
create function cali_workspace.request_deliverable_adjustment(uuid,text,integer) returns void language sql as $$
 update cali_workspace.deliverables set status='adjustment_requested',updated_at=clock_timestamp() where id=$1;
$$;
create function cali_workspace.change_deliverable_status(uuid,text,text) returns void language sql as $$
 update cali_workspace.deliverables set status=$2,updated_at=clock_timestamp() where id=$1;
$$;
create function cali_workspace.admin_set_project_lifecycle_v44(uuid,text,text,uuid,text,date) returns void language sql as $$
 update cali_workspace.projects set execution_status=case $2 when 'resume' then 'normal' else 'paused' end where id=$1;
$$;

alter table cali_workspace.events add column sync_status text;
create table cali_workspace.scheduling_requests (
 id uuid primary key default gen_random_uuid(),company_id uuid,title text,request_mode text,status text default 'submitted',
 created_at timestamptz default clock_timestamp(),admin_note text,requested_slots jsonb,admin_proposed_slots jsonb default '[]',
 confirmed_event_id uuid,extra_visit boolean default false,billable_extra boolean default false,urgency_fee_applies boolean default false
);
create function cali_workspace.preview_my_scheduling_policy_v66(text,timestamptz,text)
returns jsonb language sql as $$ select jsonb_build_object('requiresAcknowledgement',($2 at time zone 'America/Sao_Paulo')::time='21:00') $$;
create function cali_workspace.resolve_meeting_entitlement_v66(uuid,text,timestamptz,uuid)
returns jsonb language sql as $$ select '{"billable":false}'::jsonb $$;
create function cali_workspace.create_scheduling_request_v2(text,text,text,text,jsonb,text,boolean) returns jsonb language sql as $$
 insert into cali_workspace.scheduling_requests(company_id,title,request_mode,requested_slots)
 values(cali_workspace.current_company_id(),$2,$1,$5) returning jsonb_build_object('id',id);
$$;
create function cali_workspace.admin_respond_scheduling_request_v1(uuid,jsonb,text,boolean)
returns void language sql as $$
 update cali_workspace.scheduling_requests set status=case when $4 then 'declined' else 'client_review' end,
 admin_proposed_slots=$2,admin_note=$3 where id=$1;
$$;
create function cali_workspace.client_accept_scheduling_proposal_v2(uuid,integer,boolean) returns void language sql as $$
 with confirmed as (
  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,visibility,sync_status)
  select gen_random_uuid(),r.company_id,r.title,'meeting',(r.admin_proposed_slots->$2->>'startsAt')::timestamptz,
    (r.admin_proposed_slots->$2->>'endsAt')::timestamptz,'client','pending'
  from cali_workspace.scheduling_requests r where r.id=$1 returning id
 )
 update cali_workspace.scheduling_requests set status='confirmed',confirmed_event_id=(select id from confirmed) where id=$1;
$$;

alter table cali_workspace.notices add primary key(id);
alter table cali_workspace.notices add column category text, add column created_by uuid;
alter table cali_workspace.reports add primary key(id);
alter table cali_workspace.reports add column reference_month date, add column report_type text,
 add column period_end date, add column source_snapshot jsonb, add column generated_at timestamptz,
 add column data_refreshed_at timestamptz, add column sent_at timestamptz, add column review_started_at timestamptz,
 add column approved_at timestamptz, add column approved_by uuid;
create function cali_workspace.fixture_report_touch() returns trigger language plpgsql as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
create trigger fixture_report_touch before update on cali_workspace.reports
for each row execute function cali_workspace.fixture_report_touch();
create or replace function cali_workspace.report_generation_readiness_v61(uuid,text,date,date) returns jsonb language sql as $$
 select jsonb_build_object('mode',case when $3='2026-10-01' then 'official' else 'preview' end,
   'collected_days',4,'required_days',20,'available_on',$3+19,'can_generate_official',$3='2026-10-01');
$$;
create function cali_workspace.build_report_source_snapshot(uuid,date,date) returns jsonb language sql as $$
 select jsonb_build_object('company',$1,'start',$2,'end',$3);
$$;
create table cali_workspace.forms(
 id uuid primary key,company_id uuid,slug text,title text,status text,questions jsonb,
 created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp()
);
create table cali_workspace.form_responses(id uuid primary key,form_id uuid);
insert into cali_workspace.forms(id,company_id,slug,title,status,questions) values(
 '40000000-0000-4000-8000-000000000001','9c5ab148-78b8-4410-9338-58c44222a5db','form-qa','Formulário A','draft','[{"label":"Pergunta"}]'
);
