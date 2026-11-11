create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_session_guard;
create schema cali_workspace;
grant usage on schema cali_workspace,cali_session_guard,auth to service_role;
create table cali_session_guard.phase4_staff_invites(
  id uuid primary key,company_id uuid,member_id uuid,member_revision timestamptz,target_user_id uuid,
  issued_by uuid,revoked_at timestamptz,accepted_at timestamptz,expires_at timestamptz
);
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false);
create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz not null default clock_timestamp(),not_after timestamptz);
grant insert on auth.sessions to service_role;
create table cali_workspace.companies(id uuid primary key,status text);
create table cali_workspace.profiles(id uuid primary key,email text,role text,active boolean,company_id uuid);
create table cali_workspace.client_invites(id uuid primary key,company_id uuid,email text,active boolean,platform_access boolean);
create table cali_session_guard.pilot_accounts(
  company_id uuid,profile_id uuid,invite_id uuid,recipient_email text,revoked_at timestamptz
);
create table cali_session_guard.pilot_companies(company_id uuid primary key);
create table cali_workspace.staff_members(
  id uuid primary key,email text,active boolean,modules text[],updated_at timestamptz,user_id uuid,accepted_at timestamptz,invited_by uuid
);
create table cali_workspace.staff_company_assignments(staff_id uuid,company_id uuid);
create table cali_session_guard.profile_cutoffs(user_id uuid primary key,revoked_before timestamptz);
grant insert on cali_session_guard.profile_cutoffs to service_role;
create table cali_session_guard.login_authorizations(
  id uuid primary key default gen_random_uuid(),user_id uuid,code_created_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '1 minute',session_id uuid
);
create function cali_session_guard.profile_login_eligible(subject uuid) returns boolean
language sql stable as $$ select exists(select 1 from cali_workspace.profiles p where p.id=subject and p.active); $$;
create function cali_session_guard.phase4_staff_binding(p_company uuid,p_member uuid,p_revision timestamptz,p_target uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from cali_workspace.staff_members m
    join cali_workspace.staff_company_assignments a on a.staff_id=m.id and a.company_id=p_company
    join cali_workspace.companies c on c.id=p_company and c.status in ('active','paused')
    join auth.users u on u.id=p_target and u.email=m.email and u.email_confirmed_at is not null and not u.is_anonymous
    where m.id=p_member and m.updated_at=p_revision and m.active and cardinality(m.modules)>0
      and m.email='cali-qa-staff-'||m.id::text||'@example.invalid' and m.user_id is null
      and m.accepted_at is null and m.invited_by is null
      and exists(select 1 from cali_session_guard.pilot_companies x where x.company_id=p_company)
      and not exists(select 1 from cali_workspace.profiles p where p.id=u.id)
      and not exists(select 1 from cali_workspace.staff_company_assignments other
        where other.staff_id=p_member and other.company_id<>p_company));
$$;
create function cali_session_guard.authorize_code(subject uuid,code_created_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare authorization uuid;
begin
  if code_created_at is null or code_created_at>clock_timestamp()
    or code_created_at<=clock_timestamp()-interval '10 minutes'
    or not cali_session_guard.profile_login_eligible(subject)
    or exists(select 1 from cali_session_guard.profile_cutoffs r
      where r.user_id=subject and r.revoked_before>=code_created_at) then return null; end if;
  insert into cali_session_guard.login_authorizations(user_id,code_created_at)
    values(subject,code_created_at) returning id into authorization;
  return authorization;
end $$;
create function cali_workspace.admit_workspace_session_v2(p_authorization_id uuid,p_session_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare proof cali_session_guard.login_authorizations;
begin
  select * into proof from cali_session_guard.login_authorizations where id=p_authorization_id for update;
  if proof.id is null or proof.session_id is not null or proof.expires_at<=clock_timestamp()
    or not cali_session_guard.profile_login_eligible(proof.user_id)
    or exists(select 1 from cali_session_guard.profile_cutoffs r
      where r.user_id=proof.user_id and r.revoked_before>=proof.code_created_at)
    or not exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=proof.user_id
      and s.created_at>=proof.created_at and (s.not_after is null or s.not_after>statement_timestamp())) then
    return false;
  end if;
  update cali_session_guard.login_authorizations set session_id=p_session_id where id=proof.id;
  return true;
end $$;
grant execute on function cali_workspace.admit_workspace_session_v2(uuid,uuid) to service_role;
insert into auth.users values
  ('10000000-0000-4000-8000-000000000001','admin@example.test',now()),
  ('10000000-0000-4000-8000-000000000002','client@example.test',now()),
  ('10000000-0000-4000-8000-000000000003','not-confirmed@example.test',null),
  ('10000000-0000-4000-8000-000000000004','cali-qa-staff-20000000-0000-4000-8000-000000000004@example.invalid',now()),
  ('10000000-0000-4000-8000-000000000005','other-partner@example.test',now());
insert into cali_workspace.companies values('30000000-0000-4000-8000-000000000001','active');
insert into cali_session_guard.pilot_companies values('30000000-0000-4000-8000-000000000001');
insert into cali_workspace.profiles(id,email,role,active,company_id) values
  ('10000000-0000-4000-8000-000000000001','admin@example.test','admin',true,null),
  ('10000000-0000-4000-8000-000000000002','client@example.test','client',true,'30000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003','not-confirmed@example.test','client',true,'30000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000005','other-partner@example.test','partner',true,null);
insert into cali_workspace.client_invites values
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','client@example.test',true,true),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','not-confirmed@example.test',true,true);
insert into cali_session_guard.pilot_accounts values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002','client@example.test',null),
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',
   '40000000-0000-4000-8000-000000000003','not-confirmed@example.test',null);
insert into cali_workspace.staff_members values(
  '20000000-0000-4000-8000-000000000004',
  'cali-qa-staff-20000000-0000-4000-8000-000000000004@example.invalid',true,array['hours'],now(),null,null,null
);
insert into cali_workspace.staff_company_assignments values
  ('20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001');

\ir preview-access.sql

insert into cali_session_guard.phase4_staff_invites values(
  '20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004',
  (select updated_at from cali_workspace.staff_members where id='20000000-0000-4000-8000-000000000004'),
  '10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',null,null,now()+interval '1 day'
);
insert into cali_session_guard.preview_partner_recipients values(
  '10000000-0000-4000-8000-000000000004',
  'cali-qa-staff-20000000-0000-4000-8000-000000000004@example.invalid',
  '20000000-0000-4000-8000-000000000004'
);

\ir preview-partner-eligibility.sql

set role service_role;
do $$
declare
  proof jsonb;
  code_id uuid;
  session_id uuid:=gen_random_uuid();
  email_address text;
  hash text:=repeat('a',64);
begin
  assert cali_workspace.v2_preview_access_code('issue','missing@example.test',hash)->>'status'='unavailable';
  assert cali_workspace.v2_preview_access_code('issue','not-confirmed@example.test',hash)->>'status'='unavailable';
  assert cali_workspace.v2_preview_access_code('issue','other-partner@example.test',hash)->>'status'='unavailable';
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
  code_id:=(cali_workspace.v2_preview_access_code('issue',
    'cali-qa-staff-20000000-0000-4000-8000-000000000004@example.invalid',hash)->>'id')::uuid;
  perform cali_workspace.v2_preview_access_code('delivery',p_id:=code_id,p_delivered:=true);
  proof:=cali_workspace.v2_preview_access_code('consume',
    'cali-qa-staff-20000000-0000-4000-8000-000000000004@example.invalid',hash);
  assert proof->>'role'='partner';
  assert (proof->>'authorizationId')::uuid is not null;
  assert cali_session_guard.profile_login_eligible((proof->>'userId')::uuid);
  insert into auth.sessions(id,user_id) values(session_id,(proof->>'userId')::uuid);
  assert cali_workspace.admit_workspace_session_v2((proof->>'authorizationId')::uuid,session_id);
  assert not cali_workspace.admit_workspace_session_v2((proof->>'authorizationId')::uuid,session_id);
  assert cali_session_guard.profile_login_eligible('10000000-0000-4000-8000-000000000002');
  insert into cali_session_guard.profile_cutoffs values('10000000-0000-4000-8000-000000000002',clock_timestamp()+interval '1 second');
  assert cali_session_guard.authorize_code('10000000-0000-4000-8000-000000000002',clock_timestamp()) is null;
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('anon','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','EXECUTE');
  assert not has_function_privilege('authenticated','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','EXECUTE');
  assert not has_function_privilege('anon','cali_session_guard.profile_login_eligible(uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','cali_session_guard.profile_login_eligible(uuid)','EXECUTE');
  assert not has_table_privilege('service_role','cali_session_guard.preview_partner_recipients','SELECT');
end $$;
