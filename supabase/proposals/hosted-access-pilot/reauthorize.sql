-- Reautoriza somente uma identidade que já faz parte do piloto hospedado.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('cali_v2_onboarding.require_access_adhesion(uuid)') is null
    or (select count(*) from cali_session_guard.pilot_accounts) <> 2 then
    raise exception 'Instale somente após o gate de adesão e a matrícula A/B.';
  end if;
end;
$$;

create table cali_session_guard.pilot_reauthorizations (
  company_id uuid not null references cali_session_guard.pilot_accounts(company_id),
  request_id uuid not null,
  actor_id uuid not null,
  previous_revoked_at timestamptz not null,
  previous_revoked_by uuid not null,
  reauthorized_at timestamptz not null default clock_timestamp(),
  primary key (company_id, request_id)
);
alter table cali_session_guard.pilot_reauthorizations enable row level security;
revoke all on cali_session_guard.pilot_reauthorizations from public, anon, authenticated, service_role;

create function cali_session_guard.require_pilot_admin_session()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
begin
  if not exists (
    select 1 from auth.sessions s where s.user_id = actor
      and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'Sessão Admin indisponível.';
  end if;
  return actor;
end;
$$;
revoke all on function cali_session_guard.require_pilot_admin_session()
  from public, anon, authenticated, service_role;

create function cali_workspace.v2_read_pilot_access_state(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_admin_session();
  return (
    select jsonb_build_object('revoked_at', a.revoked_at)
    from cali_session_guard.pilot_accounts a where a.company_id = p_company_id
  );
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_access_state(uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_read_pilot_access_state(uuid) to authenticated;

create function cali_workspace.v2_reauthorize_pilot_access(
  p_company_id uuid, p_expected_revoked_at timestamptz, p_request_id uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  account cali_session_guard.pilot_accounts;
  prior cali_session_guard.pilot_reauthorizations;
  cutoff timestamptz;
begin
  if p_request_id is null or p_expected_revoked_at is null then
    raise exception using errcode = '22023', message = 'Operação e revogação de referência obrigatórias.';
  end if;
  -- O mesmo lock coordena a emissão de código e a revogação.
  select * into account from cali_session_guard.pilot_accounts
    where company_id = p_company_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa fora do piloto.';
  end if;
  select * into prior from cali_session_guard.pilot_reauthorizations r
    where r.company_id = p_company_id and r.request_id = p_request_id;
  if found then
    if prior.actor_id <> actor or prior.previous_revoked_at <> p_expected_revoked_at then
      raise exception using errcode = '23505', message = 'Chave de operação já utilizada.';
    end if;
    return;
  end if;
  if account.revoked_at is distinct from p_expected_revoked_at then
    raise exception using errcode = '55000', message = 'Situação do acesso alterada. Atualize a ficha.';
  end if;

  perform cali_v2_onboarding.require_access_adhesion(p_company_id);

  -- A conta, o e-mail aprovado e o convite precisam continuar vinculados.
  perform 1 from auth.users u where u.id = account.profile_id
    and lower(btrim(u.email)) = account.recipient_email for share;
  if not found then
    raise exception using errcode = '55000', message = 'Conta de teste incompatível com o convite.';
  end if;
  update cali_workspace.client_invites i set active = true, platform_access = true
    where i.id = account.invite_id and i.company_id = p_company_id
      and lower(btrim(i.email)) = account.recipient_email and not i.active and not i.platform_access;
  if not found then
    raise exception using errcode = '55000', message = 'Convite de teste alterado. Atualize a ficha.';
  end if;
  update cali_workspace.profiles p set active = true
    where p.id = account.profile_id and p.company_id = p_company_id
      and lower(btrim(p.email)) = account.recipient_email and p.role::text = 'client' and not p.active;
  if not found then
    raise exception using errcode = '55000', message = 'Perfil de teste alterado. Atualize a ficha.';
  end if;

  cutoff := clock_timestamp();
  insert into cali_session_guard.profile_cutoffs as previous (user_id, revoked_before)
    values (account.profile_id, cutoff)
    on conflict (user_id) do update
      set revoked_before = greatest(previous.revoked_before, excluded.revoked_before);
  insert into cali_session_guard.pilot_reauthorizations (
    company_id, request_id, actor_id, previous_revoked_at, previous_revoked_by
  ) values (p_company_id, p_request_id, actor, account.revoked_at, account.revoked_by);
  update cali_session_guard.pilot_accounts set revoked_at = null, revoked_by = null
    where company_id = p_company_id;
  if not cali_session_guard.profile_login_eligible(account.profile_id) then
    raise exception using errcode = '55000', message = 'Piloto indisponível para este acesso.';
  end if;
end;
$$;
revoke all on function cali_workspace.v2_reauthorize_pilot_access(uuid, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_reauthorize_pilot_access(uuid, timestamptz, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
