create table if not exists cali_workspace.team_vacancies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references cali_workspace.companies(id) on delete cascade,
  vacancy_code text not null,
  title text not null,
  department text,
  opened_on date not null,
  status text not null default 'open' check (status in ('open','filled','cancelled')),
  closed_on date,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,vacancy_code),
  check ((status='open' and closed_on is null) or (status<>'open' and closed_on is not null)),
  check (closed_on is null or closed_on>=opened_on)
);
create index if not exists team_vacancies_company_status_idx on cali_workspace.team_vacancies(company_id,status);
create table if not exists cali_workspace.team_vacancy_events (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references cali_workspace.team_vacancies(id) on delete cascade,
  company_id uuid not null references cali_workspace.companies(id) on delete cascade,
  before_state jsonb,
  after_state jsonb not null,
  actor_user_id uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create trigger team_vacancies_touch before update on cali_workspace.team_vacancies
for each row execute function cali_workspace.fixture_team_touch();
