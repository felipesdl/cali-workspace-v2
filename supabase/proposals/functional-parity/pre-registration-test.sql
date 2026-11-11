create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
create schema cali_v2_onboarding;
grant usage on schema cali_workspace to authenticated,anon;
create table cali_workspace.companies(id uuid primary key,display_name text,legal_name text,address_city text,address_state text,service_plan text);
create table cali_workspace.activity_log(company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table cali_v2_onboarding.adhesion_events(id uuid primary key,document_snapshot jsonb);
create table cali_session_guard.reservations(email text primary key,company uuid);
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language plpgsql as $$
begin
  if current_setting('cali.qa.role',true) is distinct from 'admin' or $1 is null then
    raise exception using errcode='42501';
  end if;
  return '10000000-0000-4000-8000-000000000001';
end $$;
create function cali_v2_onboarding.require_access_adhesion(uuid) returns uuid language sql as $$
  select '20000000-0000-4000-8000-000000000001'::uuid
$$;
create function cali_workspace.v2_reserve_pilot_invite(uuid,uuid,text,text) returns uuid language plpgsql as $$
begin
  if $4 not in ('a@example.invalid','b@example.invalid') then raise exception using errcode='42501'; end if;
  insert into cali_session_guard.reservations values($4,$1);
  return $2;
end $$;
\ir ../company-onboarding/pre-registration.sql

do $$
declare
  company constant uuid:='30000000-0000-4000-8000-000000000001';
  token uuid:=gen_random_uuid();
  operation uuid:=gen_random_uuid();
  good jsonb:='[{"name":"A","email":"a@example.invalid"},{"name":"B","email":"b@example.invalid"}]';
begin
  insert into cali_workspace.companies values(company,'Antes',null,null,null,'full');
  perform set_config('cali.qa.role','admin',true);
  set local role authenticated;
  perform cali_workspace.v2_issue_pre_registration(company,token);
  set local role anon;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pre_registration(uuid)','execute');
  perform cali_workspace.v2_submit_pre_registration(token,'Empresa','Razão','Curitiba','pr','Contato','a@example.invalid');
  perform cali_workspace.v2_submit_pre_registration(token,'Empresa','Razão','Curitiba','pr','Contato','a@example.invalid');
  set local role authenticated;
  assert cali_workspace.v2_read_pre_registration(company)#>>'{fields,state}'='PR';
  begin
    perform cali_workspace.v2_release_pre_registration(company,operation,true,good);
    raise exception 'Ficha liberada sem comprovação';
  exception when object_not_in_prerequisite_state then null; end;
  reset role;
  insert into cali_v2_onboarding.adhesion_events values('20000000-0000-4000-8000-000000000001','{"document_type":"contract"}');
  set local role authenticated;
  begin
    perform cali_workspace.v2_release_pre_registration(company,operation,true,
      '[{"name":"A","email":"a@example.invalid"},{"name":"Inválido","email":"fora@example.invalid"}]');
    raise exception 'Segundo acesso fora da lista foi autorizado';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not exists(select 1 from cali_session_guard.reservations);
  assert (select display_name from cali_workspace.companies where id=company)='Antes';
  set local role authenticated;
  assert cali_workspace.v2_release_pre_registration(company,operation,true,good)=company;
  assert cali_workspace.v2_release_pre_registration(company,operation,true,good)=company;
  reset role;
  assert (select count(*) from cali_session_guard.reservations r where r.company='30000000-0000-4000-8000-000000000001')=2;
  assert (select display_name from cali_workspace.companies where id=company)='Empresa';
  assert (select count(*) from cali_workspace.activity_log)=1;
end $$;
