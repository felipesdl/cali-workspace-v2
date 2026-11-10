-- Baseline nova da V2, limitada ao laboratório local. Não é dump do oficial.
-- Aplicação explícita pelo runner local; migrations/seeds automáticos continuam desligados.
create schema cali_private;
create schema cali_workspace;
revoke all on schema cali_private, cali_workspace from public, anon, authenticated, service_role;
grant usage on schema cali_workspace, cali_private to authenticated;

create table cali_private.baseline_revisions (
  version text primary key,
  digest text not null,
  applied_at timestamptz not null default clock_timestamp()
);

create table cali_workspace.companies (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) > 0),
  legal_name text not null check (length(btrim(legal_name)) > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'blocked', 'closed', 'archived'))
);

create table cali_workspace.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  company_id uuid references cali_workspace.companies(id) on delete restrict,
  role text not null check (role in ('admin', 'client', 'partner')),
  active boolean not null default false
);

create table cali_workspace.workspace_adhesions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references cali_workspace.companies(id) on delete restrict,
  evidence_reference text not null
    check (length(btrim(evidence_reference, E' \t\n\r\v\f')) > 0 and evidence_reference = btrim(evidence_reference, E' \t\n\r\v\f')),
  recorded_by uuid not null references cali_workspace.profiles(id) on delete restrict,
  recorded_at timestamptz not null default clock_timestamp()
);
create index workspace_adhesions_company_history
  on cali_workspace.workspace_adhesions(company_id, recorded_at, id);

-- Um único predicado: identidade de servidor, perfil ativo/Admin e AAL2.
-- JWT role/email/user_metadata não substituem o papel persistido.
create function cali_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (
      select 1 from cali_workspace.profiles p
      where p.id = (select auth.uid()) and p.active and p.role = 'admin'
    ) and exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
        and f.factor_type = 'totp'
    );
$$;

alter table cali_workspace.companies enable row level security;
alter table cali_workspace.profiles enable row level security;
alter table cali_workspace.workspace_adhesions enable row level security;
create policy companies_admin_read on cali_workspace.companies
  for select to authenticated using ((select cali_private.is_admin()));
create policy profiles_self_read on cali_workspace.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_admin_read on cali_workspace.profiles
  for select to authenticated using ((select cali_private.is_admin()));
create policy adhesions_admin_read on cali_workspace.workspace_adhesions
  for select to authenticated using ((select cali_private.is_admin()));

-- Evidência append-only: nenhuma operação de correção apaga o registro anterior.
create function cali_private.prevent_adhesion_rewrite()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Registro de adesão é imutável.';
end;
$$;
create trigger workspace_adhesions_immutable
  before update or delete on cali_workspace.workspace_adhesions
  for each row execute function cali_private.prevent_adhesion_rewrite();

-- O definer fica em schema não exposto. Wrapper público é invoker.
create function cali_private.register_workspace_adhesion(
  "companyId" uuid, "evidenceReference" text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  registered cali_workspace.workspace_adhesions;
begin
  if not cali_private.is_admin() then
    raise exception using errcode = '42501', message = 'Admin com MFA obrigatório.';
  end if;
  if "companyId" is null or "evidenceReference" is null
    or length(btrim("evidenceReference", E' \t\n\r\v\f')) = 0 then
    raise exception using errcode = '22023', message = 'Empresa e referência são obrigatórias.';
  end if;
  -- Não consulta URL ou certifica documento externo. Referência é informação da CALI.
  insert into cali_workspace.workspace_adhesions(company_id, evidence_reference, recorded_by)
    values ("companyId", btrim("evidenceReference", E' \t\n\r\v\f'), auth.uid()) returning * into registered;
  return jsonb_build_object(
    'id', registered.id, 'companyId', registered.company_id,
    'evidenceReference', registered.evidence_reference,
    'recordedBy', registered.recorded_by, 'recordedAt', registered.recorded_at
  );
end;
$$;

create function cali_workspace.register_workspace_adhesion(
  "companyId" uuid, "evidenceReference" text
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select cali_private.register_workspace_adhesion("companyId", "evidenceReference");
$$;

revoke all on all tables in schema cali_workspace, cali_private
  from public, anon, authenticated, service_role;
revoke all on all functions in schema cali_workspace, cali_private
  from public, anon, authenticated, service_role;
grant select on cali_workspace.companies, cali_workspace.profiles,
  cali_workspace.workspace_adhesions to authenticated;
grant execute on function cali_private.is_admin(),
  cali_private.register_workspace_adhesion(uuid, text),
  cali_workspace.register_workspace_adhesion(uuid, text) to authenticated;

-- Próximas migrations também precisam de grants explícitos.
alter default privileges in schema cali_workspace, cali_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema cali_workspace, cali_private
  revoke execute on functions from public, anon, authenticated, service_role;
