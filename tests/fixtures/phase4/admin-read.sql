alter table cali_workspace.activity_log add column id bigint generated always as identity,
  add column created_at timestamptz not null default clock_timestamp();
alter table cali_workspace.profiles add column full_name text;
update cali_workspace.profiles set full_name='Pessoa sintética' where role='admin';
create table public.cali_submissions (
  id uuid primary key,protocol text,status text,service_slug text,updated_at timestamptz,
  contact_email text,internal_notes text
);
create table public.cali_proposals (
  id uuid primary key,submission_id uuid references public.cali_submissions(id),status text,
  version integer,total_value numeric,package_code text,updated_at timestamptz,
  pdf_path text,calculator_data jsonb
);
