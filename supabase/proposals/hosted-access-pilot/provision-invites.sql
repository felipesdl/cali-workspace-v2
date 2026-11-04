-- Candidata de provisionamento hospedado. A lista de destinatários começa vazia.
begin;
set local lock_timeout = '5s';

create table cali_session_guard.pilot_invite_recipients (
  email text primary key check (email = lower(btrim(email)) and length(email) between 3 and 254),
  company_id uuid not null references cali_session_guard.pilot_companies(company_id),
  unique (company_id, email)
);
create table cali_session_guard.pilot_invite_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  email text not null unique,
  full_name text not null,
  actor_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  provisioned_at timestamptz,
  cancelled_at timestamptz,
  check (provisioned_at is null or cancelled_at is null),
  unique (company_id, request_id),
  foreign key (company_id, email) references cali_session_guard.pilot_invite_recipients(company_id, email)
);
alter table cali_session_guard.pilot_invite_recipients enable row level security;
alter table cali_session_guard.pilot_invite_reservations enable row level security;
revoke all on cali_session_guard.pilot_invite_recipients, cali_session_guard.pilot_invite_reservations
  from public, anon, authenticated, service_role;

create function cali_session_guard.pilot_invite_slots_used(target uuid, current_invite uuid)
returns bigint language sql volatile security definer set search_path = ''
as $$
  select (select count(*) from cali_workspace.client_invites
    where company_id = target and active and id is distinct from current_invite)
    + (select count(*) from cali_session_guard.pilot_invite_reservations
      where company_id = target and provisioned_at is null and cancelled_at is null);
$$;

-- Roda depois do gatilho de capacidade já instalado, que escreve o lock da empresa.
create function cali_session_guard.guard_pilot_reserved_slots()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.active is not true then return new; end if;
  if tg_op = 'UPDATE' and old.active and old.company_id = new.company_id then return new; end if;
  if exists (select 1 from cali_session_guard.pilot_companies where company_id = new.company_id)
    and cali_session_guard.pilot_invite_slots_used(new.company_id, new.id) >= 4 then
    raise exception using errcode = '23514', message = 'As quatro vagas estão ocupadas.';
  end if;
  return new;
end;
$$;
create trigger v2_pilot_invite_pending_capacity before insert or update on cali_workspace.client_invites
  for each row execute function cali_session_guard.guard_pilot_reserved_slots();

create function cali_workspace.v2_reserve_pilot_invite(
  p_company_id uuid, p_request_id uuid, p_name text, p_email text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  recipient text := lower(btrim(p_email));
  contact text := btrim(p_name);
  reservation cali_session_guard.pilot_invite_reservations;
begin
  if p_request_id is null or recipient is null or length(recipient) > 254
    or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or contact is null or length(contact) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Informe nome e e-mail válidos.';
  end if;
  if not exists (select 1 from cali_session_guard.pilot_invite_recipients
      where company_id = p_company_id and email = recipient) then
    raise exception using errcode = '42501', message = 'Destinatário fora do piloto.';
  end if;
  perform cali_v2_onboarding.require_access_adhesion(p_company_id);
  update cali_session_guard.pilot_companies set write_version = write_version + 1
    where company_id = p_company_id;
  select * into reservation from cali_session_guard.pilot_invite_reservations
    where company_id = p_company_id and request_id = p_request_id;
  if found then
    if reservation.actor_id <> actor or reservation.email <> recipient or reservation.full_name <> contact then
      raise exception using errcode = '23505', message = 'Identificador de operação já utilizado.';
    end if;
    if reservation.cancelled_at is not null then
      raise exception using errcode = '55000', message = 'Reserva já cancelada.';
    end if;
    return reservation.id;
  end if;
  if exists (select 1 from auth.users where lower(btrim(email)) = recipient)
    or exists (select 1 from cali_workspace.client_invites where lower(btrim(email)) = recipient) then
    raise exception using errcode = '23505', message = 'E-mail já vinculado.';
  end if;
  if cali_session_guard.pilot_invite_slots_used(p_company_id, null) >= 4 then
    raise exception using errcode = '23514', message = 'As quatro vagas estão ocupadas.';
  end if;
  insert into cali_session_guard.pilot_invite_reservations
    (company_id,email,full_name,actor_id,request_id)
    values (p_company_id,recipient,contact,actor,p_request_id) returning * into reservation;
  return reservation.id;
end;
$$;

create function cali_workspace.v2_prepare_pilot_invite_login(p_email text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  recipient text := lower(btrim(p_email));
  target uuid;
  reservation cali_session_guard.pilot_invite_reservations;
  identity_id uuid;
  identity_invite text;
begin
  select profile_id into identity_id from cali_session_guard.pilot_accounts where recipient_email = recipient;
  if found then
    if cali_session_guard.profile_login_eligible(identity_id) then return '{"status":"ready"}'::jsonb; end if;
    return '{"status":"unavailable"}'::jsonb;
  end if;
  select company_id into target from cali_session_guard.pilot_invite_reservations
    where email = recipient and provisioned_at is null and cancelled_at is null;
  if not found then return '{"status":"unavailable"}'::jsonb; end if;
  perform cali_v2_onboarding.require_access_adhesion(target);
  update cali_session_guard.pilot_companies set write_version = write_version + 1 where company_id = target;
  select * into strict reservation from cali_session_guard.pilot_invite_reservations where email = recipient;
  if reservation.cancelled_at is not null then return '{"status":"unavailable"}'::jsonb; end if;
  if reservation.provisioned_at is not null then
    select profile_id into strict identity_id from cali_session_guard.pilot_accounts where invite_id = reservation.id;
    if cali_session_guard.profile_login_eligible(identity_id) then return '{"status":"ready"}'::jsonb; end if;
    return '{"status":"unavailable"}'::jsonb;
  end if;
  if exists (select 1 from cali_workspace.client_invites where lower(btrim(email)) = recipient)
    or exists (select 1 from cali_workspace.profiles where lower(btrim(email)) = recipient) then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  begin
    select id, raw_app_meta_data->>'cali_v2_invite' into strict identity_id, identity_invite
      from auth.users where lower(btrim(email)) = recipient for share;
  exception
    when no_data_found then
      return jsonb_build_object('status','create','inviteId',reservation.id);
    when too_many_rows then return '{"status":"unavailable"}'::jsonb;
  end;
  if identity_invite is distinct from reservation.id::text then return '{"status":"unavailable"}'::jsonb; end if;

  update cali_session_guard.pilot_invite_reservations set provisioned_at = clock_timestamp() where id = reservation.id;
  insert into cali_workspace.client_invites (id,company_id,email,full_name,is_primary,active,platform_access)
    values (reservation.id,target,recipient,reservation.full_name,false,true,true);
  insert into cali_workspace.profiles (id,company_id,email,full_name,role,is_primary,active)
    values (identity_id,target,recipient,reservation.full_name,'client',false,true);
  insert into cali_session_guard.pilot_accounts (company_id,profile_id,invite_id,recipient_email)
    values (target,identity_id,reservation.id,recipient);
  if not cali_session_guard.profile_login_eligible(identity_id) then
    raise exception using errcode = '55000', message = 'Piloto indisponível para este acesso.';
  end if;
  return '{"status":"ready"}'::jsonb;
end;
$$;

create function cali_workspace.v2_list_pending_pilot_invites(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_admin_session();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'email', email) order by created_at, id)
    from cali_session_guard.pilot_invite_reservations
    where company_id = p_company_id and provisioned_at is null and cancelled_at is null
  ), '[]'::jsonb);
end;
$$;

create function cali_workspace.v2_cancel_pilot_invite(p_company_id uuid, p_invite_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_admin_session();
  update cali_session_guard.pilot_companies set write_version = write_version + 1
    where company_id = p_company_id;
  update cali_session_guard.pilot_invite_reservations set cancelled_at = coalesce(cancelled_at, clock_timestamp())
    where company_id = p_company_id and id = p_invite_id and provisioned_at is null;
  if not found then
    raise exception using errcode = '55000', message = 'Reserva indisponível. Atualize a ficha.';
  end if;
end;
$$;

revoke all on function cali_session_guard.pilot_invite_slots_used(uuid,uuid),
  cali_session_guard.guard_pilot_reserved_slots(),
  cali_workspace.v2_reserve_pilot_invite(uuid,uuid,text,text),
  cali_workspace.v2_list_pending_pilot_invites(uuid),
  cali_workspace.v2_cancel_pilot_invite(uuid,uuid),
  cali_workspace.v2_prepare_pilot_invite_login(text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_reserve_pilot_invite(uuid,uuid,text,text) to authenticated;
grant execute on function cali_workspace.v2_list_pending_pilot_invites(uuid) to authenticated;
grant execute on function cali_workspace.v2_cancel_pilot_invite(uuid,uuid) to authenticated;
grant execute on function cali_workspace.v2_prepare_pilot_invite_login(text) to service_role;
notify pgrst, 'reload schema';
commit;
