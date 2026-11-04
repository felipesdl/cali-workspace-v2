-- Migra somente o piloto A/B já inscrito. Não cria ou ativa convites.
begin;
set local lock_timeout = '5s';

lock table cali_workspace.client_invites in share row exclusive mode;
lock table cali_session_guard.pilot_accounts, cali_session_guard.pilot_reauthorizations
  in access exclusive mode;

do $$
begin
  if (select count(*) from cali_session_guard.pilot_accounts) <> 2
    or exists (
      select 1 from cali_workspace.client_invites i
      where i.active and i.company_id in (select company_id from cali_session_guard.pilot_accounts)
      group by i.company_id having count(*) > 4
    ) then
    raise exception 'Matrícula A/B ou ocupação das vagas divergiu do preflight.';
  end if;
end;
$$;

-- Guarda privada escrita pelo trigger. O UPDATE serializa inclusive escritores
-- legados e força falha de serialização em transações com snapshot antigo.
create table cali_session_guard.pilot_companies (
  company_id uuid primary key references cali_workspace.companies(id),
  write_version bigint not null default 0
);
insert into cali_session_guard.pilot_companies (company_id)
  select company_id from cali_session_guard.pilot_accounts;
alter table cali_session_guard.pilot_companies enable row level security;
revoke all on cali_session_guard.pilot_companies from public, anon, authenticated, service_role;

alter table cali_session_guard.pilot_reauthorizations add column invite_id uuid;
update cali_session_guard.pilot_reauthorizations h set invite_id = a.invite_id
  from cali_session_guard.pilot_accounts a where a.company_id = h.company_id;
alter table cali_session_guard.pilot_reauthorizations
  alter column invite_id set not null,
  drop constraint pilot_reauthorizations_company_id_fkey,
  drop constraint pilot_reauthorizations_pkey,
  add primary key (invite_id, request_id);
alter table cali_session_guard.pilot_accounts
  drop constraint pilot_accounts_pkey,
  drop constraint pilot_accounts_invite_id_key,
  add primary key (invite_id),
  add foreign key (company_id) references cali_session_guard.pilot_companies(company_id),
  add unique (company_id, invite_id);
alter table cali_session_guard.pilot_reauthorizations
  add foreign key (company_id, invite_id)
    references cali_session_guard.pilot_accounts(company_id, invite_id);

create function cali_session_guard.guard_pilot_invite_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  occupied boolean;
  pilot boolean;
begin
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from cali_session_guard.pilot_accounts a where a.invite_id = old.id
        and (new.id is distinct from a.invite_id or new.company_id is distinct from a.company_id
          or lower(btrim(new.email)) is distinct from a.recipient_email
          or new.active is distinct from (a.revoked_at is null)
          or new.platform_access is distinct from (a.revoked_at is null))
    ) then
      raise exception using errcode = '55000', message = 'Use a gestão do vínculo do piloto.';
    end if;
    if new.active is not true or (old.active and old.company_id = new.company_id) then return new; end if;
  elsif new.active is not true then
    return new;
  end if;

  update cali_session_guard.pilot_companies set write_version = write_version + 1
    where company_id = new.company_id returning true into pilot;
  if pilot then
    select count(*) >= 4 into occupied from cali_workspace.client_invites i
      where i.company_id = new.company_id and i.active and i.id is distinct from new.id;
    if occupied then
      raise exception using errcode = '23514', message = 'Cada empresa pode ter até 4 acessos.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.guard_pilot_invite_capacity()
  from public, anon, authenticated, service_role;
create trigger v2_pilot_invite_capacity before insert or update on cali_workspace.client_invites
  for each row execute function cali_session_guard.guard_pilot_invite_capacity();

-- Revoga a entrada por empresa antes de aceitar múltiplos vínculos.
revoke execute on function cali_workspace.v2_read_pilot_access_state(uuid),
  cali_workspace.v2_revoke_pilot_access(uuid),
  cali_workspace.v2_reauthorize_pilot_access(uuid,timestamptz,uuid) from authenticated;

create function cali_workspace.v2_list_pilot_invite_states(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_admin_session();
  return coalesce((
    select jsonb_agg(jsonb_build_object('invite_id', a.invite_id, 'revoked_at', a.revoked_at)
      order by a.invite_id)
    from cali_session_guard.pilot_accounts a where a.company_id = p_company_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function cali_workspace.v2_list_pilot_invite_states(uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_list_pilot_invite_states(uuid) to authenticated;

create function cali_workspace.v2_revoke_pilot_invite(p_company_id uuid, p_invite_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  account cali_session_guard.pilot_accounts;
  cutoff timestamptz;
begin
  select * into account from cali_session_guard.pilot_accounts
    where company_id = p_company_id and invite_id = p_invite_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Convite fora do piloto.';
  end if;
  if account.revoked_at is not null then return; end if;
  cutoff := clock_timestamp();

  insert into cali_session_guard.profile_cutoffs as previous (user_id, revoked_before)
    values (account.profile_id, cutoff)
    on conflict (user_id) do update
      set revoked_before = greatest(previous.revoked_before, excluded.revoked_before);
  update cali_session_guard.pilot_accounts set revoked_at = cutoff, revoked_by = actor
    where invite_id = account.invite_id;
  update cali_workspace.client_invites set active = false, platform_access = false
    where id = account.invite_id and company_id = account.company_id;
  update cali_workspace.profiles set active = false
    where id = account.profile_id and company_id = account.company_id and role::text = 'client';
end;
$$;
revoke all on function cali_workspace.v2_revoke_pilot_invite(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_revoke_pilot_invite(uuid, uuid) to authenticated;

create function cali_workspace.v2_reauthorize_pilot_invite(
  p_company_id uuid, p_invite_id uuid, p_expected_revoked_at timestamptz, p_request_id uuid
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
    where company_id = p_company_id and invite_id = p_invite_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Convite fora do piloto.';
  end if;
  select * into prior from cali_session_guard.pilot_reauthorizations r
    where r.invite_id = p_invite_id and r.request_id = p_request_id;
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
  update cali_session_guard.pilot_accounts set revoked_at = null, revoked_by = null
    where invite_id = p_invite_id;
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
    company_id, invite_id, request_id, actor_id, previous_revoked_at, previous_revoked_by
  ) values (p_company_id, p_invite_id, p_request_id, actor, account.revoked_at, account.revoked_by);
  if not cali_session_guard.profile_login_eligible(account.profile_id) then
    raise exception using errcode = '55000', message = 'Piloto indisponível para este acesso.';
  end if;
end;
$$;
revoke all on function cali_workspace.v2_reauthorize_pilot_invite(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_reauthorize_pilot_invite(uuid, uuid, timestamptz, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
