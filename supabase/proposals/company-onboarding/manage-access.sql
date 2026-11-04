-- Candidata isolada. Exige o corte de sessão e a admissão V2 da mesma revisão.
begin;

do $$
begin
  if current_setting('cali.session_cut_review', true) is distinct from 'reviewed-v1'
    or current_user <> 'postgres'
    or to_regprocedure('cali_workspace.admit_workspace_session_v2(uuid,uuid)') is null
    or not exists (
      select 1 from pg_trigger
      where tgrelid = 'cali_workspace.client_invites'::regclass
        and tgname = 'v2_invite_session_cut' and tgenabled in ('O', 'A')
    ) then
    raise exception 'Revisão do corte de sessão e admissão obrigatória.';
  end if;
end;
$$;

alter table cali_v2_onboarding.company_drafts
  add column access_management_enabled boolean not null default false;

alter table cali_workspace.client_invites add column v2_access_slot smallint
  check (v2_access_slot is null or (v2_access_slot between 1 and 4 and active and platform_access));

create unique index v2_company_invite_slots
  on cali_workspace.client_invites (company_id, v2_access_slot)
  where v2_access_slot is not null;

create unique index v2_active_invite_email
  on cali_workspace.client_invites (lower(btrim(email)))
  where v2_access_slot is not null;

create table cali_v2_onboarding.access_commands (
  draft_id uuid not null references cali_v2_onboarding.company_drafts(id),
  request_id uuid not null,
  actor_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  adhesion_id uuid references cali_v2_onboarding.adhesion_events(id),
  payload jsonb not null,
  invite_id uuid not null,
  primary key (draft_id, request_id)
);
alter table cali_v2_onboarding.access_commands enable row level security;
revoke all on cali_v2_onboarding.access_commands from public, anon, authenticated, service_role;

-- A função de trigger preserva o papel efetivo do escritor. O Admin chama a RPC definer.
create function cali_v2_onboarding.guard_invite_writer()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  previous_company uuid;
  next_company uuid;
begin
  if tg_op <> 'INSERT' then previous_company := old.company_id; end if;
  if tg_op <> 'DELETE' then next_company := new.company_id; end if;
  if cali_v2_onboarding.uses_managed_access(previous_company, next_company) then
    if tg_op = 'UPDATE' then
      if old.company_id is distinct from new.company_id
        or lower(btrim(old.email)) is distinct from lower(btrim(new.email)) then
        raise exception using errcode = '42501', message = 'Convite gerenciado tem vínculo fixo.';
      end if;
    end if;
    if current_user = 'postgres' then
      if tg_op = 'DELETE' then return old; end if;
      if (new.active and new.platform_access) is true and new.v2_access_slot is null then
        raise exception using errcode = '42501', message = 'Convite ativo exige uma vaga.';
      end if;
      return new;
    end if;
    -- Aceite do convite, gravado pela Edge após verificação do código, não ocupa vaga.
    if tg_op = 'UPDATE' and current_user = 'service_role' then
      if (to_jsonb(old) - array['accepted_at', 'updated_at']) =
         (to_jsonb(new) - array['accepted_at', 'updated_at']) then
        return new;
      end if;
    end if;
    raise exception using errcode = '42501', message = 'Use a gestão de acessos da empresa.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.v2_access_slot is not null then
    raise exception using errcode = '42501', message = 'Vaga reservada à gestão de acessos.';
  end if;
  return new;
end;
$$;

-- Visibilidade mínima para o trigger invoker, incluindo escritores legados.
create function cali_v2_onboarding.uses_managed_access(p_before uuid, p_after uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from cali_v2_onboarding.company_drafts d
    where d.access_management_enabled and d.company_id in (p_before, p_after)
  );
$$;
revoke all on function cali_v2_onboarding.uses_managed_access(uuid, uuid)
  from public, anon, authenticated, service_role;
grant usage on schema cali_v2_onboarding to service_role;
grant execute on function cali_v2_onboarding.uses_managed_access(uuid, uuid)
  to authenticated, service_role;
revoke all on function cali_v2_onboarding.guard_invite_writer()
  from public, anon, authenticated, service_role;

create trigger v2_guard_invite_writer before insert or update or delete on cali_workspace.client_invites
  for each row execute function cali_v2_onboarding.guard_invite_writer();

-- Empresas legadas mantêm o predicado anterior. Uma empresa gerenciada
-- só admite Cliente com convite vinculado a uma das vagas.
create or replace function cali_session_guard.profile_login_eligible(subject uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from cali_workspace.profiles p
    left join cali_workspace.companies c on c.id = p.company_id
    where p.id = subject and p.active
      and (p.role::text in ('admin', 'partner') or (
        p.role::text = 'client' and c.status::text in ('active', 'paused')
        and exists (
          select 1 from cali_workspace.client_invites i
          where i.company_id = p.company_id and lower(btrim(i.email)) = lower(btrim(p.email))
            and i.active and i.platform_access
            and (i.v2_access_slot is not null
              or not cali_v2_onboarding.uses_managed_access(null, i.company_id))
        )
      ))
  );
$$;

create function cali_workspace.v2_manage_company_access(
  p_company_id uuid, p_request_id uuid, p_action text, p_invite_id uuid,
  p_email text, p_full_name text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  managed_draft_id uuid;
  email_key text := lower(btrim(p_email));
  contact_name text := btrim(p_full_name);
  command_payload jsonb;
  prior cali_v2_onboarding.access_commands;
  invitation cali_workspace.client_invites;
  free_slot smallint;
  proof_id uuid;
begin
  if not cali_session_guard.session_is_live() then
    raise exception using errcode = '42501', message = 'Sessão indisponível.';
  end if;
  if p_request_id is null or p_action is null or p_action not in ('invite', 'revoke', 'reactivate') then
    raise exception using errcode = '22023', message = 'Operação de acesso inválida.';
  end if;

  select d.id into managed_draft_id from cali_v2_onboarding.company_drafts d
  where d.company_id = p_company_id and d.access_management_enabled for update;
  if not found then
    raise exception using errcode = '55000', message = 'Gestão indisponível para esta empresa.';
  end if;

  command_payload := jsonb_build_array(p_action, p_invite_id, email_key, contact_name);
  select r.* into prior from cali_v2_onboarding.access_commands r
  where r.draft_id = managed_draft_id and r.request_id = p_request_id;
  if found then
    if prior.actor_id <> actor or prior.payload is distinct from command_payload then
      raise exception using errcode = '23505', message = 'Chave de operação já utilizada.';
    end if;
    return prior.invite_id;
  end if;

  if p_action = 'invite' then
    if p_invite_id is not null or email_key is null or length(email_key) > 254
      or email_key !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or contact_name is null or length(contact_name) not between 1 and 200 then
      raise exception using errcode = '22023', message = 'Informe nome e e-mail válidos.';
    end if;
  else
    if email_key is not null or contact_name is not null then
      raise exception using errcode = '22023', message = 'Operação de acesso inválida.';
    end if;
    select i.* into invitation from cali_workspace.client_invites i
    where i.id = p_invite_id and i.company_id = p_company_id and not i.is_primary
      and exists (select 1 from cali_v2_onboarding.access_commands r
        where r.draft_id = managed_draft_id and r.invite_id = i.id)
    for update;
    if not found then
      raise exception using errcode = '22023', message = 'Convite indisponível.';
    end if;
    email_key := lower(btrim(invitation.email));
  end if;

  if p_action = 'revoke' then
    update cali_workspace.client_invites set active = false, platform_access = false, v2_access_slot = null
    where id = invitation.id and v2_access_slot is not null returning * into invitation;
    if not found then
      raise exception using errcode = '55000', message = 'Acesso já revogado. Atualize a ficha.';
    end if;
  else
    if p_action = 'reactivate' and invitation.v2_access_slot is not null then
      raise exception using errcode = '55000', message = 'Acesso já ativo. Atualize a ficha.';
    end if;
    proof_id := cali_v2_onboarding.require_access_adhesion(p_company_id);
    if exists (
      select 1 from cali_workspace.client_invites i
      where lower(btrim(i.email)) = email_key and i.id is distinct from invitation.id
        and (i.company_id = p_company_id or (i.active and i.platform_access))
    ) or exists (
      select 1 from cali_workspace.profiles p where lower(btrim(p.email)) = email_key
        and (p.role::text <> 'client' or p.company_id is distinct from p_company_id)
    ) then
      raise exception using errcode = '23505', message = 'E-mail já vinculado a outro acesso.';
    end if;
    select slot into free_slot from generate_series(1, 4) slot
    where not exists (
      select 1 from cali_workspace.client_invites i
      where i.company_id = p_company_id and i.v2_access_slot = slot
    )
    order by slot limit 1;
    if free_slot is null then
      raise exception using errcode = '55000', message = 'As quatro vagas estão ocupadas.';
    end if;

    if p_action = 'invite' then
      insert into cali_workspace.client_invites (
        company_id, email, full_name, active, platform_access, is_primary, v2_access_slot
      ) values (p_company_id, email_key, contact_name, true, true, false, free_slot)
      returning * into invitation;
    else
      update cali_workspace.client_invites set active = true, platform_access = true, v2_access_slot = free_slot
      where id = invitation.id returning * into invitation;
      update cali_workspace.profiles p set active = true
      where p.role::text = 'client' and p.company_id = p_company_id
        and lower(btrim(p.email)) = email_key and not p.active;
    end if;
  end if;

  insert into cali_v2_onboarding.access_commands
    (draft_id, request_id, actor_id, adhesion_id, payload, invite_id)
  values (managed_draft_id, p_request_id, actor, proof_id, command_payload, invitation.id);
  return invitation.id;
end;
$$;

revoke all on function cali_workspace.v2_manage_company_access(uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_manage_company_access(uuid, uuid, text, uuid, text, text)
  to authenticated;

commit;
