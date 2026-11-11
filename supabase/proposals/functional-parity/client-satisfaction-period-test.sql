create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
create schema auth;
grant usage on schema cali_workspace, cali_session_guard, auth to authenticated, anon;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('cali.test_actor',true),'')::uuid
$$;
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language plpgsql as $$
begin
  if current_setting('cali.test_role',true) is distinct from 'admin' then
    raise exception using errcode='42501';
  end if;
  return auth.uid();
end $$;
create table cali_workspace.account_records(id uuid primary key,company_id uuid,title text);
create table cali_workspace.account_record_feedback(
  id uuid primary key,record_id uuid,company_id uuid,score integer,comment text,created_at timestamptz
);
create table cali_workspace.deliverables(id uuid primary key,company_id uuid,title text);
create table cali_workspace.nps_responses(
  id uuid primary key,deliverable_id uuid,company_id uuid,score integer,comment text,created_at timestamptz
);
create table cali_session_guard.phase4_delivery_corrections(
  id uuid primary key,delivery_id uuid,company_id uuid,score integer,comment text,approved_at timestamptz
);
create table cali_workspace.satisfaction_followups(
  id uuid primary key,source_type text,response_id text,company_id uuid,theme text,note text,handled_at timestamptz
);
insert into cali_workspace.account_records values
 ('00000000-0000-4000-8000-000000000011','9c5ab148-78b8-4410-9338-58c44222a5db','Ocorrência baixa'),
 ('00000000-0000-4000-8000-000000000012','9c5ab148-78b8-4410-9338-58c44222a5db','Ocorrência alta'),
 ('00000000-0000-4000-8000-000000000013','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','Empresa B');
insert into cali_workspace.account_record_feedback values
 ('00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000011','9c5ab148-78b8-4410-9338-58c44222a5db',2,'Revisar','2026-11-08Z'),
 ('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000012','9c5ab148-78b8-4410-9338-58c44222a5db',5,null,'2026-12-08Z'),
 ('00000000-0000-4000-8000-000000000113','00000000-0000-4000-8000-000000000013','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',4,null,'2026-11-09Z');
insert into cali_workspace.deliverables values
 ('00000000-0000-4000-8000-000000000021','9c5ab148-78b8-4410-9338-58c44222a5db','Entrega');
insert into cali_workspace.nps_responses values
 ('00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000021','9c5ab148-78b8-4410-9338-58c44222a5db',3,'Médio','2026-11-15Z');
insert into cali_session_guard.phase4_delivery_corrections values
 ('00000000-0000-4000-8000-000000000131','00000000-0000-4000-8000-000000000021','9c5ab148-78b8-4410-9338-58c44222a5db',1,'Comentário de teste','2026-10-10Z');
\ir client-satisfaction-period.sql
do $$
declare result jsonb; company uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
begin
  set local role authenticated;
  perform set_config('cali.test_actor','00000000-0000-4000-8000-000000000001',true);
  perform set_config('cali.test_role','admin',true);
  result:=cali_workspace.v2_read_pilot_satisfaction_period(company,null,1);
  assert result->>'total'='4' and result->>'attentionTotal'='3' and result->>'average'='2.75';
  assert jsonb_array_length(result->'trend')=3;
  assert result#>>'{distribution,1,total}'='1' and result#>>'{distribution,4,total}'='1';
  assert result#>>'{trend,1,total}'='2' and result#>>'{trend,1,attention}'='2';
  assert result#>>'{trend,2,positive}'='1';
  result:=cali_workspace.v2_read_pilot_satisfaction_period(company,'2026-11-01',1);
  assert result->>'month'='2026-11-01' and result->>'total'='2' and (result->>'average')::numeric=2.5;
  assert jsonb_array_length(result->'trend')=1 and result#>>'{trend,0,attention}'='2';
  result:=cali_workspace.v2_read_pilot_satisfaction_period('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',null,1);
  assert result->>'total'='1' and (result->>'average')::numeric=4;
  begin
    perform cali_workspace.v2_read_pilot_satisfaction_period(company,'2026-11-02',1);
    raise exception 'Data fora do primeiro dia deveria ser recusada';
  exception when invalid_parameter_value then null; end;
end $$;
