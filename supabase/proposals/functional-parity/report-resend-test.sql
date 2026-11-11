create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to authenticated;
create table cali_workspace.reports(id uuid primary key,company_id uuid,version integer,status text,title text);
create table cali_session_guard.phase4_report_releases(report_id uuid,version integer,withdrawn_at timestamptz);
create table cali_workspace.activity_log(company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table cali_workspace.notifications(company_id uuid,recipient_role text,entity_id uuid,email_required boolean);
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language plpgsql as $$
begin
  if current_setting('cali.qa.role',true) is distinct from 'admin' then
    raise exception using errcode='42501';
  end if;
  return '10000000-0000-4000-8000-000000000001';
end $$;
create function cali_workspace.notify_workspace_movement(uuid,uuid,text,text,text,text,text,uuid,text,text,boolean)
returns uuid[] language sql as $$
  insert into cali_workspace.notifications values($1,$3,$8,$11);
  select '{}'::uuid[];
$$;
\ir ../phase-4/operation-receipts.sql
\ir ../phase-4/report-resend.sql
do $$
declare
  company uuid:=gen_random_uuid();
  other uuid:=gen_random_uuid();
  report uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
begin
  insert into cali_workspace.reports values(report,company,2,'approved','Relatório de teste');
  insert into cali_session_guard.phase4_report_releases values(report,2,null),(report,1,'2026-11-01Z');
  perform set_config('cali.qa.role','client',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_resend_pilot_report(company,report,2,request);
    raise exception 'Cliente reenviou o relatório';
  exception when insufficient_privilege then null; end;
  perform set_config('cali.qa.role','admin',true);
  begin
    perform cali_workspace.v2_resend_pilot_report(other,report,2,request);
    raise exception 'Outra empresa reenviou o relatório';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_resend_pilot_report(company,report,1,request);
    raise exception 'Revisão retirada foi reenviada';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_resend_pilot_report(company,report,2,request)=report;
  assert cali_workspace.v2_resend_pilot_report(company,report,2,request)=report;
  assert cali_workspace.v2_resend_pilot_report(company,report,2,gen_random_uuid())=report;
  reset role;
  assert (select count(*) from cali_workspace.notifications where entity_id=report and recipient_role='client' and not email_required)=2;
  assert (select count(*) from cali_workspace.activity_log where entity_id=report and event_type='report_resent')=2;
end $$;
