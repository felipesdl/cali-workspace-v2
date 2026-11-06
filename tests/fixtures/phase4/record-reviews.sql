-- Dependências do legado simuladas, sem transporte externo.
create table cali_workspace.account_record_feedback (
  id uuid primary key default gen_random_uuid(),record_id uuid not null,company_id uuid not null,user_id uuid not null,
  score integer not null,comment text,created_at timestamptz not null default clock_timestamp(),
  unique(record_id,user_id)
);
create table cali_workspace.account_record_reopen_requests (
  id uuid primary key default gen_random_uuid(),record_id uuid not null,company_id uuid not null,requested_by uuid not null,
  reason text not null,requested_at timestamptz not null default clock_timestamp(),status text not null default 'pending',
  decided_by uuid,decision_note text
);
create unique index fixture_one_pending_record_reopen on cali_workspace.account_record_reopen_requests(record_id)
  where status='pending';
create function cali_workspace.submit_account_record_feedback(uuid,integer,text) returns jsonb language plpgsql as $$
declare
  feedback uuid;
  company uuid;
begin
  select company_id into company from cali_workspace.account_records where id=$1;
  insert into cali_workspace.account_record_feedback(record_id,company_id,user_id,score,comment)
  values($1,company,auth.uid(),$2,$3) on conflict(record_id,user_id) do update
    set score=excluded.score,comment=excluded.comment
  returning id into feedback;
  insert into cali_workspace.notifications values(company,$1,'record_feedback','account_record',true);
  return jsonb_build_object('feedback_id',feedback);
end $$;
create function cali_workspace.request_account_record_reopen(uuid,text) returns jsonb language plpgsql as $$
declare
  request uuid;
  company uuid;
begin
  select q.id into request from cali_workspace.account_record_reopen_requests q where q.record_id=$1 and q.status='pending';
  if found then return jsonb_build_object('request_id',request,'already_pending',true); end if;
  select company_id into company from cali_workspace.account_records where id=$1;
  insert into cali_workspace.account_record_reopen_requests(record_id,company_id,requested_by,reason)
  values($1,company,auth.uid(),$2) returning id into request;
  insert into cali_workspace.account_record_messages(record_id,company_id,author_role,body,visibility)
  values($1,company,'system',$2,'client');
  insert into cali_workspace.notifications values(company,$1,'record_reopen_request','account_record',true);
  return jsonb_build_object('request_id',request);
end $$;
create function cali_workspace.decide_account_record_reopen(uuid,text,text) returns jsonb language plpgsql as $$
declare
  q cali_workspace.account_record_reopen_requests%rowtype;
begin
  update cali_workspace.account_record_reopen_requests set status=$2,decided_by=auth.uid(),decision_note=$3
  where id=$1 returning * into q;
  if $2='approved' then
    update cali_workspace.account_records set workflow_status='in_progress' where id=q.record_id;
  end if;
  insert into cali_workspace.account_record_messages(record_id,company_id,author_role,body,visibility)
  values(q.record_id,q.company_id,'system',coalesce($3,$2),'client');
  insert into cali_workspace.notifications values(q.company_id,q.record_id,'record_reopen_decision','account_record',true);
  return jsonb_build_object('request_id',$1);
end $$;
create or replace function cali_workspace.set_account_record_status(uuid,text) returns void language sql as $$
 update cali_workspace.account_record_reopen_requests set status='approved',decided_by=auth.uid()
 where record_id=$1 and status='pending' and $2='in_progress' and exists(
   select 1 from cali_workspace.account_records where id=$1 and workflow_status in ('standby','completed','cancelled'));
 update cali_workspace.account_records set workflow_status=$2 where id=$1;
$$;
