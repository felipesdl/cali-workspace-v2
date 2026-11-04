create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema cali_workspace;
grant usage on schema cali_workspace to authenticated, anon, service_role;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('test.jwt', true), '')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid
$$;
create table auth.users (id uuid primary key);
create table auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz);
create table auth.mfa_factors (user_id uuid, factor_type text, status text);
create table cali_workspace.companies (id uuid primary key, status text not null);
create table cali_workspace.profiles (id uuid primary key, active boolean, role text, company_id uuid);
create function cali_workspace.is_admin() returns boolean language sql stable as $$ select true $$;
create table cali_workspace.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  user_agent text,
  primary key (user_id, version)
);
alter table cali_workspace.terms_acceptances enable row level security;

insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into auth.sessions values
  ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',null),
  ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002',null);
insert into cali_workspace.companies values ('00000000-0000-4000-8000-000000000020','active');
insert into cali_workspace.profiles values
  ('00000000-0000-4000-8000-000000000001',true,'client','00000000-0000-4000-8000-000000000020'),
  ('00000000-0000-4000-8000-000000000002',true,'client','00000000-0000-4000-8000-000000000020');
insert into cali_workspace.terms_acceptances
  values ('00000000-0000-4000-8000-000000000001','2026-10-15','2026-10-15 12:00:00+00','histórico QA');

\ir apply.sql

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  b constant uuid := '00000000-0000-4000-8000-000000000002';
  sa constant uuid := '00000000-0000-4000-8000-000000000011';
  sb constant uuid := '00000000-0000-4000-8000-000000000012';
  publication jsonb;
begin
  if has_function_privilege('anon','cali_workspace.v2_accept_terms(text,text)','execute')
    or has_function_privilege('service_role','cali_workspace.v2_accept_terms(text,text)','execute')
    or has_schema_privilege('authenticated','cali_v2_terms','usage') then
    raise exception 'Grants do aceite V2 incorretos';
  end if;

  perform set_config('test.jwt',jsonb_build_object('sub',a,'session_id',sa)::text,true);
  set local role authenticated;
  publication := cali_workspace.v2_read_terms_state();
  if publication->>'accepted' is distinct from 'false' then
    raise exception 'Recibo legado foi tratado como confirmação de hash';
  end if;
  begin
    perform cali_workspace.v2_accept_terms(publication->>'version',repeat('0',64));
    raise exception 'Hash incorreto aceito';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
  perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
  if cali_workspace.v2_read_terms_state()->>'accepted' is distinct from 'true' then
    raise exception 'Aceite de A não confirmado';
  end if;

  perform set_config('test.jwt',jsonb_build_object('sub',b,'session_id',sb)::text,true);
  if cali_workspace.v2_read_terms_state()->>'accepted' is distinct from 'false' then
    raise exception 'Aceite de A liberou B';
  end if;
  perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
  reset role;
  if (select count(*) from cali_v2_terms.confirmations) <> 2 or not exists (
    select 1 from cali_workspace.terms_acceptances where user_id=a and version='2026-10-15'
      and accepted_at='2026-10-15 12:00:00+00' and user_agent='histórico QA'
  ) then raise exception 'Histórico ou idempotência divergente'; end if;

  update cali_v2_terms.publications set is_current=false;
  insert into cali_v2_terms.publications values ('qa-next',repeat('a',64),true);
  delete from auth.sessions where id=sa;
  set local role authenticated;
  if cali_workspace.v2_read_terms_state()->>'accepted' is distinct from 'false' then
    raise exception 'Aceite antigo liberou a versão nova';
  end if;
  begin
    perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
    raise exception 'Versão antiga aceitou confirmação';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_accept_terms('qa-next',repeat('a',64));
  perform set_config('test.jwt',jsonb_build_object('sub',a,'session_id',sa)::text,true);
  begin
    perform cali_workspace.v2_accept_terms('qa-next',repeat('a',64));
    raise exception 'Sessão removida aceitou confirmação';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Isola a composição da policy. A prova de Auth e operação Storage reais
-- continua no driver de integração.
create schema cali_session_guard;
create function cali_session_guard.profile_requires_admission(subject uuid)
returns boolean language sql stable as $$ select subject is not null $$;
create function cali_session_guard.session_is_live()
returns boolean language sql stable as $$ select current_setting('test.live',true) = 'yes' $$;
create schema cali_v2_onboarding;
create function cali_v2_onboarding.uses_managed_access(uuid,uuid)
returns boolean language sql stable as $$ select true $$;
create schema storage;
create function storage.allow_any_operation(operations text[])
returns boolean language sql stable as $$ select current_setting('test.operation',true) = any(operations) $$;
create table storage.objects (bucket_id text, name text);
insert into storage.objects values ('cali-workspace-private','documents/qa/fixture.pdf');
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
create policy permissive_overlap on storage.objects for select to authenticated using (true);

set cali.hosted_terms.activate_storage = 'reviewed';
\ir activate-storage.sql

do $$ begin
  perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000002","session_id":"00000000-0000-4000-8000-000000000012"}',true);
  perform set_config('test.live','yes',true);
  set local role authenticated;
  perform set_config('test.operation','object.get_authenticated',true);
  if (select count(*) from storage.objects) <> 1 then raise exception 'Download com aceite negado'; end if;
  perform set_config('test.operation','object.sign',true);
  if exists (select 1 from storage.objects) then raise exception 'Policy permissiva liberou assinatura'; end if;
  perform set_config('test.live','no',true);
  perform set_config('test.operation','object.get_authenticated',true);
  if exists (select 1 from storage.objects) then raise exception 'Sessão cortada leu arquivo'; end if;
  reset role;
  update cali_v2_terms.publications set is_current=false;
  insert into cali_v2_terms.publications values ('qa-third',repeat('b',64),true);
  set local role authenticated;
  perform set_config('test.live','yes',true);
  if exists (select 1 from storage.objects) then raise exception 'Policy permissiva ignorou a nova publicação'; end if;
end $$;

\ir rollback-storage.sql
do $$ begin
  set local role authenticated;
  if (select count(*) from storage.objects) <> 1 then raise exception 'Rollback não restaurou leitura legada'; end if;
end $$;

\ir rollback.sql

do $$ begin
  if cali_workspace.v2_read_terms_state() is not null
    or (select count(*) from cali_v2_terms.confirmations) <> 3
    or (select count(*) from cali_workspace.terms_acceptances) <> 3 then
    raise exception 'Rollback perdeu histórico ou manteve a publicação ativa';
  end if;
end $$;
\echo 'Aceite hospedado: histórico, dois Clientes, rotação, corte e rollback passaram.'
