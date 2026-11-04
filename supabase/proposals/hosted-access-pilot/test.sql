-- Usar apenas no PostgreSQL descartável com o nome aceito pela fixture.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text not null);
create table auth.sessions (id uuid primary key, user_id uuid not null,
  created_at timestamptz not null, not_after timestamptz);
create table auth.mfa_factors (user_id uuid, factor_type text, status text);
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('test.jwt', true), '')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid
$$;
grant usage on schema auth to authenticated;

\ir ../../../tests/fixtures/session-cut/reference.sql
create or replace function cali_workspace.current_company_id()
returns uuid language sql stable security definer
set search_path to 'pg_catalog', 'auth', 'cali_workspace'
as $$ select p.company_id from cali_workspace.profiles p where p.id = auth.uid() and p.active limit 1; $$;
\ir ../company-onboarding/candidate.sql
\ir ../company-onboarding/materialize-company.sql
\ir prepare-drafts.sql
\ir ../hosted-terms/apply.sql
\ir base.sql
\ir codes.sql

insert into cali_workspace.companies (id, display_name, legal_name, notes) values
 ('9c5ab148-78b8-4410-9338-58c44222a5db','QA A','QA A','CALI_V2_TEST_A_20261101'),
 ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','QA B','QA B','CALI_V2_TEST_B_20261101'),
 ('00000000-0000-4000-8000-000000000003','Legada','Legada',null);
insert into auth.users values
 ('00000000-0000-4000-8000-000000000011','a@example.test'),
 ('00000000-0000-4000-8000-000000000012','b@example.test'),
 ('00000000-0000-4000-8000-000000000013','legacy@example.test'),
 ('00000000-0000-4000-8000-000000000014','admin@example.test');
insert into cali_workspace.profiles (id, company_id, email, full_name, role)
select u.id, v.company_id::uuid, u.email, v.full_name, v.role
from auth.users u join (values
 ('a@example.test','9c5ab148-78b8-4410-9338-58c44222a5db','A','client'),
 ('b@example.test','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','B','client'),
 ('legacy@example.test','00000000-0000-4000-8000-000000000003','Legada','client'),
 ('admin@example.test',null,'Admin','admin')
) v(email, company_id, full_name, role) on u.email = v.email;
insert into cali_workspace.client_invites (company_id, email, full_name)
select company_id, email, full_name from cali_workspace.profiles where company_id is not null;
insert into auth.mfa_factors values ('00000000-0000-4000-8000-000000000014','totp','verified');

do $$
begin
  perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000011"}',true);
  set local role authenticated;
  if not exists (select 1 from cali_workspace.profiles
    where id = '00000000-0000-4000-8000-000000000011') then
    raise exception 'Piloto vazio alterou leitura existente';
  end if;
end;
$$;

-- Substitutos isolados para o resultado do gate de adesão e a API de Storage.
-- O teste de integração documental está no recorte company-onboarding.
create function cali_v2_onboarding.require_access_adhesion(p_company_id uuid)
returns uuid language sql stable as $$ select p_company_id $$;
create schema storage;
create table storage.objects (bucket_id text, name text);
create function storage.allow_any_operation(text[])
returns boolean language sql stable as $$ select true $$;
set cali.hosted_terms.activate_storage = 'reviewed';
\ir ../hosted-terms/activate-storage.sql
set cali.access_pilot.enroll = 'reviewed';
\ir enroll.sql

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000011';
  b constant uuid := '00000000-0000-4000-8000-000000000012';
  legacy constant uuid := '00000000-0000-4000-8000-000000000013';
  admin constant uuid := '00000000-0000-4000-8000-000000000014';
  sa constant uuid := '00000000-0000-4000-8000-000000000021';
  sb constant uuid := '00000000-0000-4000-8000-000000000022';
  sad constant uuid := '00000000-0000-4000-8000-000000000024';
  company_a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  company_b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  company_legacy constant uuid := '00000000-0000-4000-8000-000000000003';
  proof_a uuid;
  proof_b uuid;
  draft_a uuid;
  publication jsonb;
  issued jsonb;
  code_hash constant text := repeat('a',64);
begin
  if has_function_privilege('anon', 'cali_workspace.v2_revoke_pilot_access(uuid)', 'execute')
    or has_function_privilege('authenticated', 'cali_workspace.admit_workspace_session_v2(uuid,uuid)', 'execute')
    or has_table_privilege('authenticated', 'cali_session_guard.pilot_accounts', 'insert') then
    raise exception 'Permissões do piloto incorretas';
  end if;

  perform set_config('test.jwt', jsonb_build_object('sub', a, 'session_id', sa)::text, true);
  begin
    insert into cali_session_guard.pilot_accounts (company_id, profile_id, invite_id, recipient_email)
    select p.company_id, p.id, i.id, p.email from cali_workspace.profiles p
    join cali_workspace.client_invites i using (company_id, email) where p.id = legacy;
    raise exception 'Empresa fora de A/B admitida no cadastro do piloto';
  exception when check_violation then null;
  end;

  set local role authenticated;
  if exists (select 1 from cali_workspace.profiles where id = a)
    or cali_workspace.current_company_id() is not null then
    raise exception 'A leu dados antes da admissão';
  end if;
  reset role;

  if has_function_privilege('authenticated', 'cali_workspace.v2_issue_pilot_code(text,text)', 'execute')
    or (cali_workspace.v2_issue_pilot_code('legacy@example.test', code_hash)->>'status') <> 'unavailable' then
    raise exception 'Emissão liberada fora da Edge ou fora do piloto';
  end if;
  issued := cali_workspace.v2_issue_pilot_code('a@example.test', code_hash);
  if issued->>'status' <> 'issued'
    or cali_workspace.v2_consume_pilot_code('a@example.test', code_hash) is not null then
    raise exception 'Código usado antes da confirmação de entrega';
  end if;
  perform cali_workspace.v2_deliver_pilot_code((issued->>'id')::uuid, true);
  proof_a := (cali_workspace.v2_consume_pilot_code('a@example.test', code_hash)->>'authorizationId')::uuid;
  if cali_workspace.v2_consume_pilot_code('a@example.test', code_hash) is not null
    or (cali_workspace.v2_issue_pilot_code('a@example.test', code_hash)->>'status') <> 'limited' then
    raise exception 'Código reaproveitado ou limite de emissão ignorado';
  end if;
  issued := cali_workspace.v2_issue_pilot_code('b@example.test', code_hash);
  perform cali_workspace.v2_deliver_pilot_code((issued->>'id')::uuid, true);
  proof_b := (cali_workspace.v2_consume_pilot_code('b@example.test', code_hash)->>'authorizationId')::uuid;
  insert into auth.sessions values
    (sa, a, clock_timestamp(), null), (sb, b, clock_timestamp(), null),
    (sad, admin, clock_timestamp(), null);
  if proof_a is null or proof_b is null
    or not cali_workspace.admit_workspace_session_v2(proof_a, sa)
    or not cali_workspace.admit_workspace_session_v2(proof_b, sb) then
    raise exception 'Admissão esperada para A/B falhou';
  end if;
  set local role authenticated;
  publication := cali_workspace.v2_read_terms_state();
  perform cali_workspace.v2_accept_terms(publication->>'version', publication->>'contentHash');
  if not exists (select 1 from cali_workspace.companies where id = company_a)
    or exists (select 1 from cali_workspace.companies where id = company_b) then
    raise exception 'A perdeu acesso próprio ou leu B';
  end if;
  begin
    perform cali_workspace.v2_revoke_pilot_access(company_a);
    raise exception 'Cliente conseguiu revogar';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt', jsonb_build_object('sub', admin, 'session_id', sad, 'aal', 'aal2')::text, true);
  draft_a := cali_workspace.v2_prepare_pilot_company_draft(company_a);
  if draft_a is null or cali_workspace.v2_prepare_pilot_company_draft(company_a) <> draft_a then
    raise exception 'Vínculo ao rascunho não é idempotente';
  end if;
  begin
    perform cali_workspace.v2_prepare_pilot_company_draft(company_legacy);
    raise exception 'Preparação aceitou empresa fora do piloto';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform cali_workspace.v2_revoke_pilot_access(company_legacy);
    raise exception 'Admin conseguiu revogar fora do piloto';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_revoke_pilot_access(company_a);
  perform cali_workspace.v2_revoke_pilot_access(company_a);

  perform set_config('test.jwt', jsonb_build_object('sub', a, 'session_id', sa)::text, true);
  if exists (select 1 from cali_workspace.profiles where id = a)
    or (cali_workspace.v2_read_terms_state()->>'accepted')::boolean then
    raise exception 'A preservou leitura ou confirmação ativa após corte';
  end if;
  perform set_config('test.jwt', jsonb_build_object('sub', b, 'session_id', sb)::text, true);
  if not exists (select 1 from cali_workspace.companies where id = company_b) then
    raise exception 'B perdeu acesso após corte de A';
  end if;
  perform set_config('test.jwt', jsonb_build_object('sub', legacy)::text, true);
  if not exists (select 1 from cali_workspace.companies where id = company_legacy) then
    raise exception 'Fora do piloto perdeu acesso';
  end if;
  reset role;
  if cali_session_guard.authorize_code(a, clock_timestamp()) is not null
    or (cali_workspace.v2_issue_pilot_code('a@example.test', code_hash)->>'status') <> 'unavailable' then
    raise exception 'A recuperou elegibilidade após revogação';
  end if;
end;
$$;

\ir pause.sql

do $$
begin
  if (select count(*) from cali_session_guard.login_authorizations) <> 2
    or (select count(*) from cali_session_guard.profile_cutoffs) <> 1 then
    raise exception 'Suspensão perdeu histórico';
  end if;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  set local role authenticated;
  if cali_session_guard.session_is_live() then
    raise exception 'Suspensão deixou sessão B ativa';
  end if;
end;
$$;
