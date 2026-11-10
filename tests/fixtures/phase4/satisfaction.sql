create table cali_workspace.nps_responses (
  id uuid primary key default gen_random_uuid(),company_id uuid not null,deliverable_id uuid not null,
  score integer not null,comment text,created_at timestamptz not null default clock_timestamp()
);
create table cali_workspace.satisfaction_followups (
  id uuid primary key default gen_random_uuid(),source_type text not null,response_id text not null,company_id uuid,
  theme text,note text,handled_at timestamptz not null default clock_timestamp(),handled_by uuid,
  unique(source_type,response_id)
);
