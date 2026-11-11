create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema auth,cali_workspace,cali_session_guard to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('cali.test_actor',true),'')::uuid
$$;
create table cali_workspace.companies(id uuid primary key);
create table cali_workspace.profiles(
  id uuid primary key,role text,active boolean,full_name text,job_title text,company_id uuid
);
create table cali_workspace.staff_members(
  id uuid primary key,full_name text,active boolean,role text,modules text[]
);
create table cali_workspace.staff_company_assignments(
  staff_id uuid,company_id uuid,primary key(staff_id,company_id)
);
create table cali_workspace.activity_log(
  company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb
);
create function cali_session_guard.require_phase4_role(p_company uuid,p_role text) returns uuid language plpgsql as $$
declare profile_role text; profile_company uuid;
begin
  select role,company_id into profile_role,profile_company from cali_workspace.profiles where id=auth.uid();
  if current_setting('cali.test_role',true) is distinct from p_role or profile_role is distinct from p_role
    or (p_role='client' and profile_company is distinct from p_company) then
    raise exception using errcode='42501';
  end if;
  return auth.uid();
end $$;
insert into cali_workspace.companies values
 ('9c5ab148-78b8-4410-9338-58c44222a5db'),('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76');
insert into cali_workspace.profiles values
 ('00000000-0000-4000-8000-000000000001','admin',true,'Responsável CALI','Consultora',null),
 ('00000000-0000-4000-8000-000000000002','client',true,'Cliente A',null,'9c5ab148-78b8-4410-9338-58c44222a5db'),
 ('00000000-0000-4000-8000-000000000003','admin',true,'Outro Admin',null,null);
insert into cali_workspace.staff_members values
 ('00000000-0000-4000-8000-000000000011','Parceiro A',true,'partner',array['projects','records']);
insert into cali_workspace.staff_company_assignments values
 ('00000000-0000-4000-8000-000000000011','9c5ab148-78b8-4410-9338-58c44222a5db');
\ir company-responsibles.sql
do $$
declare result jsonb; revision timestamptz; company uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
begin
  set local role authenticated;
  perform set_config('cali.test_actor','00000000-0000-4000-8000-000000000001',true);
  perform set_config('cali.test_role','admin',true);
  result:=cali_workspace.v2_read_company_responsible_options(company);
  assert result->>'companyId'=company::text and result->>'updatedAt' is null;
  assert jsonb_array_length(result->'admins')=2 and jsonb_array_length(result->'partners')=1;
  revision:=cali_workspace.v2_save_company_responsibles(company,null,
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000011');
  result:=cali_workspace.v2_read_company_responsibles(company);
  assert jsonb_array_length(result->'responsibles')=2;
  assert result#>>'{responsibles,0,name}'='Outro Admin' and result#>>'{responsibles,0,role}'='cali';
  assert result#>>'{responsibles,1,name}'='Parceiro A' and result#>>'{responsibles,1,role}'='partner';
  begin
    perform cali_workspace.v2_save_company_responsibles(company,null,
      '00000000-0000-4000-8000-000000000001',null);
    raise exception 'Esperado conflito de gravação concorrente';
  exception when serialization_failure then null; end;
  revision:=cali_workspace.v2_save_company_responsibles(company,revision,
    '00000000-0000-4000-8000-000000000001',null);
  result:=cali_workspace.v2_read_company_responsibles(company);
  assert jsonb_array_length(result->'responsibles')=1;
  assert result#>>'{responsibles,0,name}'='Responsável CALI';
  perform set_config('cali.test_actor','00000000-0000-4000-8000-000000000002',true);
  perform set_config('cali.test_role','client',true);
  result:=cali_workspace.v2_read_company_responsibles(company);
  assert jsonb_array_length(result->'responsibles')=1;
  begin
    perform cali_workspace.v2_read_company_responsibles('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76');
    raise exception 'Cliente não pode consultar outra empresa';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_read_company_responsibles('00000000-0000-4000-8000-000000000999');
    raise exception 'Empresa fora do piloto deveria ser recusada';
  exception when insufficient_privilege then null; end;
end $$;
