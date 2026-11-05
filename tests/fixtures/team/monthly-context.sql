-- Fixture descartável. Dependências de sessão/termos simuladas; as RPCs/guardas de Equipe são reais.
create role authenticated;
create role anon;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace,cali_session_guard to authenticated;
create function auth.jwt() returns jsonb language sql stable as $$
 select nullif(current_setting('test.jwt',true),'')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
create table cali_workspace.companies(id uuid primary key,display_name text,status text default 'active');
create table cali_workspace.profiles(id uuid primary key,company_id uuid,role text,active boolean default true);
create table cali_session_guard.pilot_companies(company_id uuid primary key);
create table cali_session_guard.pilot_accounts(profile_id uuid,company_id uuid,revoked_at timestamptz);
create function cali_session_guard.session_is_live() returns boolean language sql stable as $$
 select coalesce(current_setting('test.live',true),'true')<>'false';
$$;
create function cali_session_guard.require_pilot_admin_session() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or not cali_session_guard.session_is_live() then
  raise exception using errcode='42501',message='Admin sem sessão MFA';
 end if;
 return auth.uid();
end $$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable as $$
 select jsonb_build_object('accepted',coalesce(current_setting('test.terms',true),'true')<>'false');
$$;
create function cali_workspace.can_access_company(company uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from cali_workspace.profiles where id=auth.uid() and active and (role='admin' or company_id=company));
$$;
insert into cali_workspace.companies values
 ('9c5ab148-78b8-4410-9338-58c44222a5db','QA A','active'),
 ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','QA B','active'),
 ('00000000-0000-4000-8000-000000000003','Legada sintética','active');
insert into cali_session_guard.pilot_companies select id from cali_workspace.companies where display_name like 'QA%';
insert into cali_workspace.profiles values
 ('00000000-0000-4000-8000-000000000011','9c5ab148-78b8-4410-9338-58c44222a5db','client',true),
 ('00000000-0000-4000-8000-000000000012','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','client',true),
 ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000003','client',true),
 ('00000000-0000-4000-8000-000000000014',null,'admin',true),
 ('00000000-0000-4000-8000-000000000015','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','client',true);
insert into cali_session_guard.pilot_accounts(profile_id,company_id)
 select id,company_id from cali_workspace.profiles where role='client' and company_id in(select company_id from cali_session_guard.pilot_companies);
\ir directory.sql
alter table cali_workspace.team_months add column confirmed_by uuid,
 add column confirmed_at timestamptz not null default clock_timestamp(),add column revision integer not null default 1;
alter table cali_workspace.team_month_snapshots add column seniority text,add column employment_type text;
create table cali_workspace.team_month_reviews(company_id uuid not null,reference_month date not null,
 answers jsonb not null default '{}',confirmed_by uuid,confirmed_at timestamptz not null default clock_timestamp(),
 revision integer not null default 1,primary key(company_id,reference_month));
\ir ../../../supabase/proposals/team-2b/directory.sql
\ir ../../../supabase/proposals/team-2b/maintenance.sql
create table if not exists cali_workspace.team_month_metrics (
  company_id uuid not null references cali_workspace.companies(id) on delete cascade,
  reference_month date not null check (extract(day from reference_month) = 1),
  planned_hours numeric check (planned_hours is null or planned_hours >= 0),
  absence_medical_hours numeric check (absence_medical_hours is null or absence_medical_hours >= 0),
  absence_leave_hours numeric check (absence_leave_hours is null or absence_leave_hours >= 0),
  absence_unjustified_hours numeric check (absence_unjustified_hours is null or absence_unjustified_hours >= 0),
  absence_accident_hours numeric check (absence_accident_hours is null or absence_accident_hours >= 0),
  overtime_hours numeric check (overtime_hours is null or overtime_hours >= 0),
  hour_bank_balance numeric,
  approved_headcount jsonb not null default '{}'::jsonb check (jsonb_typeof(approved_headcount) = 'object'),
  enps_score smallint check (enps_score is null or enps_score between -100 and 100),
  climate_score numeric(3,1) check (climate_score is null or climate_score between 0 and 10),
  climate_participation numeric check (climate_participation is null or climate_participation between 0 and 100),
  notes text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, reference_month)
);
alter table cali_workspace.team_month_metrics enable row level security;
create policy metrics_legacy_read on cali_workspace.team_month_metrics for select to authenticated
 using(cali_workspace.can_access_company(company_id));
create policy metrics_legacy_write on cali_workspace.team_month_metrics for all to authenticated
 using(cali_workspace.can_access_company(company_id)) with check(cali_workspace.can_access_company(company_id));
grant select,insert,update on cali_workspace.team_month_metrics to authenticated;
create trigger team_metrics_touch before update on cali_workspace.team_month_metrics
 for each row execute function cali_workspace.fixture_team_touch();
