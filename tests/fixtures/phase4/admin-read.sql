alter table cali_workspace.activity_log add column id bigint generated always as identity,
  add column created_at timestamptz not null default clock_timestamp();
alter table cali_workspace.profiles add column full_name text;
update cali_workspace.profiles set full_name='Pessoa sintética' where role='admin';
create table public.cali_submissions (
  id uuid primary key,protocol text,status text,service_slug text,updated_at timestamptz,
  contact_email text,internal_notes text,answers jsonb default '{}'::jsonb
);
create table public.cali_proposals (
  id uuid primary key default gen_random_uuid(),submission_id uuid references public.cali_submissions(id),status text,
  version integer,total_value numeric,package_code text,updated_at timestamptz default clock_timestamp(),
  service_slug text,base_price numeric,subtotal numeric,final_unit numeric,
  extras numeric default 0,discount_pct numeric default 0,contract_months integer default 1,
  pdf_path text,calculator_data jsonb,sent_at timestamptz,resend_email_id text
);

alter table public.cali_proposals add column payment_terms text, add column public_notes text,
  add column validity_days integer not null default 15 check(validity_days between 1 and 120);
grant usage on schema auth to authenticated;
alter table public.cali_proposals enable row level security;
grant select,update on public.cali_proposals to authenticated;
create policy fixture_portal_owner on public.cali_proposals for all to authenticated
  using (auth.uid()='00000000-0000-4000-8000-000000000014' and current_setting('cali.qa_portal_access',true)='yes')
  with check (auth.uid()='00000000-0000-4000-8000-000000000014' and current_setting('cali.qa_portal_access',true)='yes');
alter table cali_workspace.activity_log enable row level security;
grant insert on cali_workspace.activity_log to authenticated;
create policy fixture_audit_admin on cali_workspace.activity_log for insert to authenticated
  with check (auth.uid()='00000000-0000-4000-8000-000000000014');
