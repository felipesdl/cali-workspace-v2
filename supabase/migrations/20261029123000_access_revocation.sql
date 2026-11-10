-- Corte de acesso não ressuscita sessões/códigos antigos ao reativar conta/perfil.
create function cali_private.revoke_profile_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.active and not new.active then
    delete from auth.sessions where user_id = new.id;
    update cali_private.workspace_access_codes set used_at = clock_timestamp() where user_id = new.id and used_at is null;
  end if;
  return new;
end; $$;
create trigger profile_access_revoked after update of active on cali_workspace.profiles
  for each row execute function cali_private.revoke_profile_sessions();
create function cali_private.revoke_company_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('blocked','closed','archived') and old.status is distinct from new.status then
    delete from auth.sessions where user_id in (select id from cali_workspace.profiles where company_id = new.id and role = 'client');
    update cali_private.workspace_access_codes set used_at = clock_timestamp()
      where used_at is null and user_id in (select id from cali_workspace.profiles where company_id = new.id and role = 'client');
  end if;
  return new;
end; $$;
create trigger company_access_revoked after update of status on cali_workspace.companies
  for each row execute function cali_private.revoke_company_sessions();
revoke all on function cali_private.revoke_profile_sessions(),cali_private.revoke_company_sessions() from public,anon,authenticated,service_role;
