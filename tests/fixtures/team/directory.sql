create table cali_workspace.team_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references cali_workspace.companies(id),
  employee_code text not null,
  full_name text not null,
  job_title text not null,
  department text not null,
  manager_code text,
  admission_date date not null,
  status text not null default 'active',
  work_email text,
  work_phone text,
  seniority text,
  team_area text,
  is_leader boolean not null default false,
  employment_type text not null default 'clt',
  weekly_hours numeric(5,2),
  work_model text,
  location text,
  leave_reason text,
  leave_start_date date,
  expected_return_date date,
  termination_date date,
  termination_initiative text,
  termination_reason text,
  notice_type text,
  archived_at timestamptz,
  archived_by uuid,
  avatar_style text not null default 'neutral',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(company_id,employee_code)
);
create function cali_workspace.fixture_team_touch() returns trigger
language plpgsql as $$ begin new.updated_at:=clock_timestamp(); return new; end $$;
create trigger team_members_touch before update on cali_workspace.team_members
for each row execute function cali_workspace.fixture_team_touch();
insert into cali_workspace.team_members (id,company_id,employee_code,full_name,job_title,department,admission_date)
values
 ('10000000-0000-4000-8000-000000000001','9c5ab148-78b8-4410-9338-58c44222a5db','QA-A','Pessoa sintética A','Analista','Operações','2026-10-01'),
 ('10000000-0000-4000-8000-000000000002','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','QA-B','Pessoa sintética B','Analista','Operações','2026-10-01');
create table cali_workspace.team_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  member_id uuid not null references cali_workspace.team_members(id),
  reference_month date not null,
  change_type text not null,
  before_state jsonb,
  after_state jsonb,
  actor_user_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
create table cali_workspace.team_member_private (
  member_id uuid primary key references cali_workspace.team_members(id),
  company_id uuid not null,
  salary numeric(12,2),
  salary_review_date date,
  gender text,
  gender_detail text,
  has_children text,
  updated_at timestamptz not null
);
create table cali_workspace.team_private_audit (
  member_id uuid,
  company_id uuid,
  actor_user_id uuid,
  changed_fields text[]
);
-- Exercita o efeito colateral do trigger legado de gênero na ficha profissional.
create function cali_workspace.fixture_private_trigger() returns trigger
language plpgsql as $$
begin
  if tg_op='INSERT' or new.gender is distinct from old.gender then
    update cali_workspace.team_members set avatar_style=coalesce(new.gender,'neutral') where id=new.member_id;
  end if;
  return new;
end $$;
create trigger fixture_private_trigger after insert or update on cali_workspace.team_member_private
for each row execute function cali_workspace.fixture_private_trigger();
create table cali_workspace.team_months (
  company_id uuid not null,
  reference_month date not null,
  primary key(company_id,reference_month)
);
create table cali_workspace.team_month_snapshots (
  company_id uuid not null,
  reference_month date not null,
  member_id uuid not null,
  department text not null,
  manager_code text,
  job_title text not null,
  status text not null,
  admission_date date not null,
  termination_date date,
  primary key(company_id,reference_month,member_id)
);
