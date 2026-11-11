create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to authenticated;
create table cali_workspace.profiles(id uuid,role text);
create table cali_workspace.account_records(id uuid,company_id uuid,visibility text);
create table cali_workspace.deliverables(id uuid,company_id uuid,approved_at timestamptz);
create table cali_workspace.hour_entries(id uuid,company_id uuid,account_record_id uuid,deliverable_id uuid,project_id uuid,
  work_date date,description text,minutes integer,client_visible boolean);
create table cali_workspace.account_record_reopen_requests(id uuid,company_id uuid,record_id uuid,status text,decided_at timestamptz);
create table cali_session_guard.phase4_delivery_corrections(id bigint,company_id uuid,delivery_id uuid,
  previous_approved_at timestamptz,approved_at timestamptz);
create function cali_session_guard.require_pilot_team_actor(uuid) returns uuid language plpgsql as $$
begin
  if $1::text is distinct from '30000000-0000-4000-8000-000000000001' then
    raise exception using errcode='42501';
  end if;
  return current_setting('cali.qa.actor')::uuid;
end $$;
create function cali_workspace.client_can_view_deliverable(uuid) returns boolean language sql as $$select true$$;
create function cali_workspace.hour_project_operational(uuid) returns boolean language sql as $$select $1 is null$$;
\ir ../phase-4/subject-history.sql

do $$
declare
  company constant uuid:='30000000-0000-4000-8000-000000000001';
  outsider uuid:=gen_random_uuid();
  administrator uuid:=gen_random_uuid();
  client uuid:=gen_random_uuid();
  subject uuid:=gen_random_uuid();
  other uuid:=gen_random_uuid();
  delivery uuid:=gen_random_uuid();
  result jsonb;
begin
  insert into cali_workspace.profiles values (administrator,'admin'),(client,'client');
  insert into cali_workspace.account_records values(subject,company,'client'),(other,company,'internal');
  insert into cali_workspace.deliverables values(delivery,company,'2026-11-05Z');
  insert into cali_workspace.hour_entries values
    (gen_random_uuid(),company,subject,null,null,'2026-11-03','Hora pública',20,true),
    (gen_random_uuid(),company,subject,null,null,'2026-11-03','Nota privada',10,false),
    (gen_random_uuid(),outsider,subject,null,null,'2026-11-03','Outra empresa',30,true),
    (gen_random_uuid(),company,other,null,null,'2026-11-03','Outra ocorrência',60,true),
    (gen_random_uuid(),company,subject,null,gen_random_uuid(),'2026-11-03','Projeto indisponível',20,true);
  insert into cali_workspace.account_record_reopen_requests
    values(gen_random_uuid(),company,subject,'approved','2026-11-04Z');
  insert into cali_session_guard.phase4_delivery_corrections
    values(1,company,delivery,'2026-11-01Z','2026-11-05Z');
  perform set_config('cali.qa.actor',client::text,true);
  set local role authenticated;
  result:=cali_workspace.v2_read_subject_history(company,'record',subject,1);
  assert result->>'total'='2' and result#>>'{entries,0,title}'='Reabertura aprovada';
  assert result#>>'{entries,1,title}'='Hora pública';
  begin
    perform cali_workspace.v2_read_subject_history(company,'record',other,1);
    raise exception 'Ocorrência interna exposta';
  exception when insufficient_privilege then null; end;
  result:=cali_workspace.v2_read_subject_history(company,'delivery',delivery,1);
  assert result->>'total'='2' and result#>>'{entries,0,title}'='Revisão aprovada';
  perform set_config('cali.qa.actor',administrator::text,true);
  assert cali_workspace.v2_read_subject_history(company,'record',subject,1)->>'total'='4';
end $$;
