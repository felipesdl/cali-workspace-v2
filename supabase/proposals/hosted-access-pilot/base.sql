-- Base da candidata hospedada. Instalar com o cadastro do piloto vazio.
-- Admissão e guardas entram juntas para preservar o contrato de termos existente.
begin;
set local lock_timeout = '5s';

do $$ begin
  if not exists (
    select 1 from pg_proc p where p.oid = 'cali_workspace.current_company_id()'::regprocedure
      and p.prosecdef and p.provolatile = 's'
      and regexp_replace(lower(p.prosrc), '\s+', '', 'g') =
        'selectp.company_idfromcali_workspace.profilespwherep.id=auth.uid()andp.activelimit1;'
  ) then
    raise exception 'Definição de current_company_id divergiu do catálogo revisado.';
  end if;
end $$;

create schema cali_session_guard authorization postgres;
revoke all on schema cali_session_guard from public, anon, authenticated, service_role;

create table cali_session_guard.pilot_accounts (
  company_id uuid primary key references cali_workspace.companies(id),
  profile_id uuid not null unique references auth.users(id),
  invite_id uuid not null unique references cali_workspace.client_invites(id),
  recipient_email text not null unique check (recipient_email = lower(btrim(recipient_email)) and recipient_email <> ''),
  revoked_at timestamptz,
  revoked_by uuid,
  check ((revoked_at is null) = (revoked_by is null)),
  check (company_id in ('9c5ab148-78b8-4410-9338-58c44222a5db', '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'))
);
create table cali_session_guard.profile_cutoffs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revoked_before timestamptz not null
);

alter table cali_session_guard.pilot_accounts enable row level security;
alter table cali_session_guard.profile_cutoffs enable row level security;
revoke all on cali_session_guard.pilot_accounts, cali_session_guard.profile_cutoffs
  from public, anon, authenticated, service_role;

-- O escopo segue a identidade Auth original mesmo se o perfil for inativado.
create function cali_session_guard.is_pilot_account(subject uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from cali_session_guard.pilot_accounts a where a.profile_id = subject);
$$;

-- Convite, perfil e Auth precisam concordar. Não adota outra identidade por e-mail.
create function cali_session_guard.profile_login_eligible(subject uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from cali_session_guard.pilot_accounts a
    join cali_workspace.profiles p on p.id = a.profile_id and p.company_id = a.company_id
    join cali_workspace.companies c on c.id = a.company_id
    join cali_workspace.client_invites i on i.id = a.invite_id and i.company_id = a.company_id
    join auth.users u on u.id = a.profile_id
    where a.profile_id = subject and a.revoked_at is null and p.active and p.role::text = 'client'
      and c.status::text in ('active', 'paused') and i.active and i.platform_access
      and lower(btrim(i.email)) = a.recipient_email
      and lower(btrim(p.email)) = a.recipient_email
      and lower(btrim(u.email)) = a.recipient_email
  );
$$;
revoke all on function cali_session_guard.is_pilot_account(uuid),
  cali_session_guard.profile_login_eligible(uuid) from public, anon, authenticated, service_role;

create table cali_session_guard.login_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_created_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '1 minute',
  session_id uuid unique references auth.sessions(id) on delete cascade
);
create index login_authorizations_user on cali_session_guard.login_authorizations(user_id);
alter table cali_session_guard.login_authorizations enable row level security;
revoke all on cali_session_guard.login_authorizations from public,anon,authenticated,service_role;

create function cali_session_guard.authorize_code(subject uuid,code_created_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare authorization uuid;
begin
  if code_created_at is null or code_created_at > clock_timestamp()
     or code_created_at <= clock_timestamp() - interval '10 minutes'
     or not cali_session_guard.profile_login_eligible(subject)
     or exists(select 1 from cali_session_guard.profile_cutoffs r
       where r.user_id=subject and r.revoked_before>=code_created_at) then
    return null;
  end if;
  insert into cali_session_guard.login_authorizations(user_id,code_created_at)
    values(subject,code_created_at) returning id into authorization;
  return authorization;
end; $$;

create function cali_workspace.admit_workspace_session_v2(p_authorization_id uuid,p_session_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare proof cali_session_guard.login_authorizations;
begin
  select * into proof from cali_session_guard.login_authorizations
    where id=p_authorization_id for update;
  if proof.id is null or proof.session_id is not null or proof.expires_at<=clock_timestamp()
     or not cali_session_guard.profile_login_eligible(proof.user_id)
     or exists(select 1 from cali_session_guard.profile_cutoffs r
       where r.user_id=proof.user_id and r.revoked_before>=proof.code_created_at)
     or not exists(select 1 from auth.sessions s where s.id=p_session_id
       and s.user_id=proof.user_id and s.created_at>=proof.created_at
       and (s.not_after is null or s.not_after>statement_timestamp())) then
    return false;
  end if;
  update cali_session_guard.login_authorizations set session_id=p_session_id where id=proof.id;
  return true;
end; $$;

create function cali_session_guard.profile_requires_admission(subject uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select cali_session_guard.is_pilot_account(subject); $$;

-- A função de termos já chama session_is_live quando presente. Preservar o contrato
-- anterior para atores fora do piloto, inclusive o Admin com MFA.
create function cali_session_guard.session_is_live()
returns boolean language sql stable security definer set search_path = ''
as $$
  select not cali_session_guard.is_pilot_account(auth.uid()) or exists (
    select 1 from auth.sessions s
    join cali_session_guard.login_authorizations a on a.user_id = s.user_id and a.session_id = s.id
    left join cali_session_guard.profile_cutoffs r on r.user_id = s.user_id
    where s.user_id = auth.uid() and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
      and cali_session_guard.profile_login_eligible(s.user_id)
      and (r.revoked_before is null or (
        s.created_at > r.revoked_before and a.code_created_at > r.revoked_before
      ))
  );
$$;
revoke all on function cali_session_guard.authorize_code(uuid,timestamptz),
  cali_session_guard.profile_requires_admission(uuid), cali_session_guard.session_is_live(),
  cali_workspace.admit_workspace_session_v2(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function cali_workspace.admit_workspace_session_v2(uuid,uuid) to service_role;
grant usage on schema cali_session_guard to authenticated;
grant execute on function cali_session_guard.session_is_live() to authenticated;

-- CREATE OR REPLACE preserva a identidade referenciada pelas policies do
-- Storage e de service_cycles. As permissões anteriores permanecem no helper.
create or replace function cali_workspace.current_company_id()
returns uuid language sql stable security definer
set search_path to 'pg_catalog', 'auth', 'cali_workspace'
as $$
  select p.company_id from cali_workspace.profiles p
  where p.id = auth.uid() and p.active and cali_session_guard.session_is_live()
  limit 1;
$$;

-- Piloto: encerra só a autorização da identidade pareada. O convite é
-- preservado para histórico e a troca de código não volta a admitir a conta.
create function cali_workspace.v2_revoke_pilot_access(p_company_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  account cali_session_guard.pilot_accounts;
  cutoff timestamptz;
begin
  if not exists (
    select 1 from auth.sessions s where s.user_id = actor
      and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'Sessão Admin indisponível.';
  end if;
  select * into account from cali_session_guard.pilot_accounts
    where company_id = p_company_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa fora do piloto.';
  end if;
  if account.revoked_at is not null then return; end if;
  cutoff := clock_timestamp();

  insert into cali_session_guard.profile_cutoffs as previous (user_id, revoked_before)
    values (account.profile_id, cutoff)
    on conflict (user_id) do update
      set revoked_before = greatest(previous.revoked_before, excluded.revoked_before);
  update cali_session_guard.pilot_accounts set revoked_at = cutoff, revoked_by = actor
    where company_id = account.company_id;
  update cali_workspace.client_invites set active = false, platform_access = false
    where id = account.invite_id and company_id = account.company_id;
  update cali_workspace.profiles set active = false
    where id = account.profile_id and company_id = account.company_id and role::text = 'client';
end;
$$;
revoke all on function cali_workspace.v2_revoke_pilot_access(uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_revoke_pilot_access(uuid) to authenticated;

-- RPCs antigas de edição podem escrever com o papel do dono e ignorar RLS.
-- O JWT identifica o chamador e session_is_live preserva atores fora do piloto.
create function cali_session_guard.guard_pilot_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.jwt()->>'role') = 'authenticated'
    and not cali_session_guard.session_is_live() then
    raise exception using errcode = '42501', message = 'Sessão indisponível.';
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.guard_pilot_profile_update()
  from public, anon, authenticated, service_role;
create trigger v2_guard_pilot_profile_update before update on cali_workspace.profiles
  for each row execute function cali_session_guard.guard_pilot_profile_update();

-- Mantém as policies existentes como fonte de vínculo/ator. Este predicado só
-- restringe os dois atores do piloto e não concede acesso adicional.
create policy v2_pilot_live_session on cali_workspace.profiles as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_pilot_live_session on cali_workspace.companies as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_pilot_live_session on cali_workspace.client_invites as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_pilot_live_session on cali_workspace.terms_acceptances as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));

commit;
