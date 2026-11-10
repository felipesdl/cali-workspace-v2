-- Base descartável do contrato de revisão. As transições externas têm projeções mínimas.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
create schema cali_v2_terms;
grant usage on schema cali_workspace,auth to authenticated;
create function auth.jwt() returns jsonb language sql stable as $$
  select current_setting('request.jwt.claims',true)::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid
$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table auth.mfa_factors(id uuid primary key,user_id uuid,factor_type text,status text,created_at timestamptz,updated_at timestamptz);
create table cali_workspace.companies(id uuid primary key,display_name text,status text);
insert into cali_workspace.companies values
  ('9c5ab148-78b8-4410-9338-58c44222a5db','Empresa A','active'),
  ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','Empresa B','active');
create table cali_session_guard.pilot_companies(company_id uuid primary key);
insert into cali_session_guard.pilot_companies select id from cali_workspace.companies;
create table cali_workspace.profiles(id uuid primary key,email text,role text,active boolean,full_name text);
create table cali_workspace.terms_acceptances(user_id uuid,version text);
create table cali_v2_terms.publications(version text,content_hash text,is_current boolean);
create table cali_v2_terms.confirmations(user_id uuid,version text,content_hash text);
insert into cali_v2_terms.publications values('QA',repeat('a',64),true);
create table cali_workspace.staff_members(id uuid primary key,email text,full_name text,modules text[],active boolean,
  updated_at timestamptz,user_id uuid,accepted_at timestamptz,invited_by uuid);
create table cali_workspace.staff_company_assignments(staff_id uuid,company_id uuid);
create table cali_workspace.account_records(id uuid primary key,company_id uuid,title text,record_type text,
  visibility text,source_actor text,workflow_status text,requires_action boolean,last_activity_at timestamptz);
create table cali_workspace.deliverables(id uuid primary key,company_id uuid,project_id uuid,title text,
  client_visible boolean,status text,work_closed_at timestamptz,updated_at timestamptz);
create table cali_workspace.activity_log(company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table cali_workspace.notifications(entity_id uuid,email_required boolean);
create table cali_session_guard.phase4_project_qa(project_id uuid,company_id uuid);
create table cali_session_guard.phase4_record_qa(company_id uuid,title text);
create function cali_session_guard.require_phase4_role(company uuid,expected text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from cali_workspace.profiles p
    join auth.sessions s on s.user_id=p.id and s.id::text=auth.jwt()->>'session_id'
    join auth.mfa_factors f on f.user_id=p.id and f.status='verified' and f.factor_type='totp'
    join cali_v2_terms.confirmations c on c.user_id=p.id
    join cali_v2_terms.publications v on v.is_current and v.version=c.version and v.content_hash=c.content_hash
    join cali_session_guard.pilot_companies x on x.company_id=company
    where p.id=auth.uid() and p.role=expected and p.active and auth.jwt()->>'aal'='aal2') then
    raise exception using errcode='42501',message='Admin da fixture indisponível.';
  end if;
  return auth.uid();
end;
$$;
create function cali_workspace.change_deliverable_status(item uuid,new_status text,note text)
returns void language sql as $$ update cali_workspace.deliverables set status=new_status where id=item $$;
create function cali_workspace.set_account_record_status(item uuid,new_status text)
returns void language sql as $$ update cali_workspace.account_records set workflow_status=new_status where id=item $$;
create table cali_workspace.work_timers(id uuid primary key);
-- Asserções desta prova exercitam apenas o contrato de revisão.
set check_function_bodies=off;
