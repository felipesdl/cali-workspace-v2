create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to authenticated,anon;

create function cali_session_guard.require_pilot_admin_session() returns uuid language plpgsql as $$
begin
  if current_setting('cali.test_role',true) is distinct from 'admin' then
    raise exception using errcode='42501';
  end if;
  return '00000000-0000-0000-0000-000000000001';
end $$;
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language sql as $$
  select cali_session_guard.require_pilot_admin_session()
$$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql as $$
  select jsonb_build_object('accepted',current_setting('cali.test_terms',true)='accepted')
$$;
create table cali_workspace.account_records(
  id uuid primary key,company_id uuid,title text,workflow_status text,visibility text,closed_at timestamptz
);
create table cali_workspace.account_record_feedback(record_id uuid,company_id uuid,created_at timestamptz);
create table cali_workspace.activity_log(
  company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb
);
-- Legado rastreável, limite do mês em Brasília, registro sem data e ocorrência interna.
insert into cali_workspace.account_records values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000101','Respondida','completed','client','2026-11-01 03:00Z'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000101','Outubro','completed','client','2026-11-01 02:59Z'),
  ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000101','Histórico incompleto','completed','client',null),
  ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000101','Interna','completed','internal','2026-11-02Z'),
  ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000101','Nova','open','client',null),
  ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000102','Empresa B','completed','client','2026-11-02Z');
\ir ../phase-4/satisfaction-requests.sql
update cali_workspace.account_records set workflow_status='completed',closed_at='2026-11-03Z' where title='Nova';
insert into cali_workspace.account_record_feedback values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000101','2026-12-01Z'),
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000101','2026-12-02Z');

do $$
declare
  a constant uuid:='00000000-0000-0000-0000-000000000101';
  b constant uuid:='00000000-0000-0000-0000-000000000102';
  request constant uuid:='00000000-0000-0000-0000-000000000015';
  result jsonb;
begin
  assert not has_function_privilege('anon','cali_workspace.v2_read_satisfaction_requests(uuid,date,integer)','execute');
  set local role authenticated;
  perform set_config('cali.test_role','client',true);
  begin
    perform cali_workspace.v2_read_satisfaction_requests(a,'2026-11-01',1);
    raise exception 'Leitura Cliente deveria falhar';
  exception when insufficient_privilege then null; end;
  perform set_config('cali.test_role','admin',true);
  begin
    perform cali_workspace.v2_read_satisfaction_requests(a,'2026-11-01',1);
    raise exception 'Leitura sem termos deveria falhar';
  exception when insufficient_privilege then null; end;
  perform set_config('cali.test_terms','accepted',true);
  result:=cali_workspace.v2_read_satisfaction_requests(a,'2026-11-01',1);
  assert result->>'answered'='1' and result->>'waiting'='1' and result->>'unanswered'='0';
  assert result#>>'{requests,0,id}'=request::text;
  assert cali_workspace.v2_read_satisfaction_requests(a,null,1)->>'waiting'='2';
  assert cali_workspace.v2_read_satisfaction_requests(null,'2026-11-01',1)->>'waiting'='2';
  begin
    perform cali_workspace.v2_close_satisfaction_request(b,request,'2026-11-03Z');
    raise exception 'Encerramento em outra empresa deveria falhar';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_close_satisfaction_request(a,request,'2026-11-04Z');
    raise exception 'Data divergente deveria falhar';
  exception when serialization_failure then null; end;
  perform cali_workspace.v2_close_satisfaction_request(a,request,'2026-11-03Z');
  perform cali_workspace.v2_close_satisfaction_request(a,request,'2026-11-03Z');
  result:=cali_workspace.v2_read_satisfaction_requests(a,'2026-11-01',1);
  assert result->>'waiting'='0' and result->>'unanswered'='1';
  reset role;
  assert (select count(*) from cali_workspace.activity_log where entity_id=request)=1;
  insert into cali_workspace.account_record_feedback values (request,a,'2026-12-03Z');
  set local role authenticated;
  result:=cali_workspace.v2_read_satisfaction_requests(a,'2026-11-01',1);
  assert result->>'answered'='2' and result->>'unanswered'='0';
end $$;

\ir ../phase-4/rollback-satisfaction-requests.sql
do $$ begin
  assert to_regprocedure('cali_workspace.v2_read_satisfaction_requests(uuid,date,integer)') is null;
  assert (select count(*) from cali_session_guard.phase4_satisfaction_requests where closed_at is not null)=1;
end $$;
