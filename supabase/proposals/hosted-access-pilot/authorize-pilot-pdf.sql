-- Apenas as duas fixtures arquivadas. Nenhuma alteração de política do bucket.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_can_download_pilot_pdf(p_fixture text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from cali_session_guard.pilot_accounts a
    join cali_workspace.profiles p on p.id = a.profile_id and p.company_id = a.company_id
    where a.profile_id = auth.uid() and a.revoked_at is null and p.active
      and p.role::text = 'client'
      and a.company_id = case p_fixture
        when 'a' then '9c5ab148-78b8-4410-9338-58c44222a5db'::uuid
        when 'b' then '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid
      end
      and cali_session_guard.session_is_live()
      and (cali_workspace.v2_read_terms_state()->>'accepted')::boolean is true
  );
$$;
revoke all on function cali_workspace.v2_can_download_pilot_pdf(text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_can_download_pilot_pdf(text) to authenticated;
notify pgrst, 'reload schema';
commit;
