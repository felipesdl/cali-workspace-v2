-- Fixture exclusivamente para PostgreSQL descartável, sem Auth ou Edge reais.
\ir acceptance.sql

create table auth.users (id uuid primary key);
create table auth.sessions (
  id uuid primary key, user_id uuid not null references auth.users(id),
  created_at timestamptz not null, not_after timestamptz
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('aal', current_setting('test.aal', true),
    'session_id', current_setting('test.session', true),
    'role', current_setting('test.request_role', true))
$$;
alter table cali_workspace.profiles add column email text, add column company_id uuid;
alter table cali_workspace.client_invites
  alter column id set default gen_random_uuid(),
  add column email text not null,
  add column full_name text not null,
  add column company_id uuid not null,
  add column active boolean not null,
  add column platform_access boolean not null,
  add column is_primary boolean not null,
  add column accepted_at timestamptz,
  add column updated_at timestamptz;
create table cali_workspace.terms_acceptances (user_id uuid not null);
alter table cali_workspace.profiles enable row level security;
alter table cali_workspace.companies enable row level security;
alter table cali_workspace.client_invites enable row level security;
alter table cali_workspace.terms_acceptances enable row level security;
grant usage on schema auth to authenticated;
grant select on cali_workspace.profiles to authenticated;
grant select, update on cali_workspace.client_invites to service_role;
create policy fixture_profile_self on cali_workspace.profiles
  for select to authenticated using (id = auth.uid());

set cali.session_cut_review = 'reviewed-v1';
\ir ../session-cut/candidate.sql
\ir ../session-cut/reconciliation.sql
\ir ../session-cut/login-admission.sql
\ir manage-access.sql

insert into auth.users values ('00000000-0000-4000-8000-000000000001');
insert into auth.sessions values ('00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000001', clock_timestamp(), null);

do $$
declare
  draft cali_v2_onboarding.company_drafts;
  prior uuid;
begin
  select d.* into draft from cali_v2_onboarding.company_drafts d where d.display_name = 'Rascunho 26';
  select e.id into prior from cali_v2_onboarding.adhesion_events e
  where e.draft_id = draft.id order by e.sequence desc limit 1;
  perform set_config('test.actor', '00000000-0000-4000-8000-000000000001', true);
  perform set_config('test.aal', 'aal2', true);
  perform cali_workspace.v2_confirm_adhesion_document(
    draft.id, gen_random_uuid(), prior, 'Adesão para acessos QA', 'QA',
    '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022', 'v2'
  );
  insert into cali_workspace.client_invites (company_id, email, full_name, active, platform_access, is_primary)
  values (draft.company_id, 'qa-legacy@example.test', 'Pessoa legado QA', true, true, false);
  insert into cali_workspace.profiles (id, company_id, email, role, active)
  values ('00000000-0000-4000-8000-000000000063', draft.company_id, 'qa-legacy@example.test', 'client', true);
  if not cali_session_guard.profile_login_eligible('00000000-0000-4000-8000-000000000063') then
    raise exception 'Regra legada alterada para empresa fora da gestão.';
  end if;
  insert into auth.users values ('00000000-0000-4000-8000-000000000063');
  insert into auth.sessions values ('00000000-0000-4000-8000-000000000074',
    '00000000-0000-4000-8000-000000000063', clock_timestamp(), null);
  perform set_config('test.actor', '00000000-0000-4000-8000-000000000063', true);
  perform set_config('test.session', '00000000-0000-4000-8000-000000000074', true);
  set local role authenticated;
  if not exists (select 1 from cali_workspace.profiles where id = '00000000-0000-4000-8000-000000000063') then
    raise exception 'Sessão legada sem corte perdeu acesso fora da gestão.';
  end if;
  reset role;

  update cali_v2_onboarding.company_drafts set access_management_enabled = true where id = draft.id;
  if cali_session_guard.profile_login_eligible('00000000-0000-4000-8000-000000000063') then
    raise exception 'Convite legado sem vaga contornou a admissão.';
  end if;

  begin
    insert into cali_workspace.client_invites (company_id, email, full_name, active, platform_access, is_primary)
    values (draft.company_id, 'qa-bypass@example.test', 'Pessoa QA', true, true, false);
    raise exception 'Escritor legado ocupou vaga fora da RPC.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
