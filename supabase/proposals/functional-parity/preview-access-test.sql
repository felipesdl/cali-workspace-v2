create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_session_guard;
create schema cali_workspace;
grant usage on schema cali_workspace to service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table cali_workspace.profiles(id uuid primary key,email text,role text,active boolean);
create function cali_session_guard.profile_login_eligible(p_actor uuid) returns boolean
language sql stable as $$ select exists(select 1 from cali_workspace.profiles p where p.id=p_actor and p.active); $$;
create function cali_session_guard.authorize_code(uuid,timestamptz) returns uuid
language sql as $$ select gen_random_uuid(); $$;
insert into auth.users values
  ('10000000-0000-4000-8000-000000000001','admin@example.test',now()),
  ('10000000-0000-4000-8000-000000000002','client@example.test',now()),
  ('10000000-0000-4000-8000-000000000003','not-confirmed@example.test',null);
insert into cali_workspace.profiles select id,email,split_part(email,'@',1),true from auth.users;

\ir preview-access.sql

set role service_role;
do $$
declare
  proof jsonb;
  code_id uuid;
  email_address text;
  hash text:=repeat('a',64);
begin
  assert cali_workspace.v2_preview_access_code('issue','missing@example.test',hash)->>'status'='unavailable';
  assert cali_workspace.v2_preview_access_code('issue','not-confirmed@example.test',hash)->>'status'='unavailable';
  foreach email_address in array array['admin@example.test','client@example.test'] loop
    code_id:=(cali_workspace.v2_preview_access_code('issue',email_address,hash)->>'id')::uuid;
    assert code_id is not null;
    assert cali_workspace.v2_preview_access_code('issue',email_address,hash)->>'status'='limited';
    assert cali_workspace.v2_preview_access_code('consume',email_address,hash) is null;
    perform cali_workspace.v2_preview_access_code('delivery',p_id:=code_id,p_delivered:=true);
    assert cali_workspace.v2_preview_access_code('consume',email_address,repeat('b',64)) is null;
    proof:=cali_workspace.v2_preview_access_code('consume',email_address,hash);
    assert proof->>'role'=split_part(email_address,'@',1);
    assert (proof->>'authorizationId')::uuid is not null;
    assert cali_workspace.v2_preview_access_code('consume',email_address,hash) is null;
  end loop;
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('anon','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','EXECUTE');
  assert not has_function_privilege('authenticated','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','EXECUTE');
end $$;
