-- Candidata para a projeção isolada. Aplicar após manage-access.sql.
begin;

do $$ begin
  if current_setting('cali.session_cut_test', true) is distinct from 'isolated-only'
    or current_user <> 'postgres' or current_database() not like 'cali_session_cut_%' then
    raise exception 'Provisionamento restrito à cópia isolada autorizada';
  end if;
end $$;

-- Reconsulta o convite depois de obter o mesmo lock usado pela gestão de vagas.
create function cali_workspace.v2_prepare_managed_login(p_email text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  email_key text := lower(btrim(p_email));
  target_company uuid;
  invitation cali_workspace.client_invites;
  auth_id uuid;
  auth_invite text;
  existing_profile cali_workspace.profiles;
begin
  select d.company_id into target_company
  from cali_v2_onboarding.company_drafts d
  join cali_workspace.client_invites i on i.company_id = d.company_id
  where d.access_management_enabled and lower(btrim(i.email)) = email_key
  order by (i.active and i.platform_access and i.v2_access_slot is not null) desc, i.id
  limit 1 for update of d;

  if target_company is null then
    if exists (
      select 1 from cali_workspace.profiles p
      where lower(btrim(p.email)) = email_key and cali_v2_onboarding.uses_managed_access(p.company_id, null)
    ) then return jsonb_build_object('status', 'unavailable'); end if;
    return jsonb_build_object('status', 'legacy');
  end if;

  select i.* into invitation
  from cali_workspace.client_invites i
  join cali_workspace.companies c on c.id = i.company_id
  where i.company_id = target_company and lower(btrim(i.email)) = email_key
    and i.active and i.platform_access and i.v2_access_slot is not null
    and c.status in ('active', 'paused')
  for share of i, c;

  if invitation.id is null or exists (
    select 1 from cali_workspace.client_invites i
    where lower(btrim(i.email)) = email_key and i.id <> invitation.id and i.active and i.platform_access
  ) then return jsonb_build_object('status', 'unavailable'); end if;

  begin
    select u.id, u.raw_app_meta_data ->> 'cali_v2_invite' into strict auth_id, auth_invite
    from auth.users u where lower(btrim(u.email)) = email_key;
  exception
    when no_data_found then null;
    when too_many_rows then return jsonb_build_object('status', 'unavailable');
  end;

  if exists (
    select 1 from cali_workspace.profiles p
    where lower(btrim(p.email)) = email_key and p.id is distinct from auth_id
  ) then return jsonb_build_object('status', 'unavailable'); end if;

  if auth_id is null then
    return jsonb_build_object('status', 'create', 'inviteId', invitation.id);
  end if;

  select * into existing_profile from cali_workspace.profiles p where p.id = auth_id for update;
  if found then
    if existing_profile.active and existing_profile.role = 'client'
      and existing_profile.company_id = target_company and lower(btrim(existing_profile.email)) = email_key
    then return jsonb_build_object('status', 'ready'); end if;
    return jsonb_build_object('status', 'unavailable');
  end if;

  if auth_invite is distinct from invitation.id::text then
    return jsonb_build_object('status', 'unavailable');
  end if;

  insert into cali_workspace.profiles (id, company_id, email, full_name, role, active, is_primary)
  values (auth_id, target_company, email_key, invitation.full_name, 'client', true, false);
  return jsonb_build_object('status', 'ready');
end;
$$;

revoke all on function cali_workspace.v2_prepare_managed_login(text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_prepare_managed_login(text) to service_role;

commit;
