-- Aplicar junto do corte de sessão, após a homologação da admissão no destino.
begin;
set local lock_timeout = '5s';
do $$ begin
  if current_setting('cali.hosted_terms.activate_storage', true) is distinct from 'reviewed'
    or to_regprocedure('cali_session_guard.profile_requires_admission(uuid)') is null
    or to_regprocedure('cali_session_guard.session_is_live()') is null
    or (to_regprocedure('cali_v2_onboarding.uses_managed_access(uuid,uuid)') is null
      and to_regclass('cali_session_guard.pilot_accounts') is null)
    or to_regprocedure('storage.allow_any_operation(text[])') is null
    or not exists (select 1 from cali_v2_terms.publications where is_current) then
    raise exception 'Ativação exige publicação vigente, admissão, corte e revisão do Storage.';
  end if;
end $$;

create function cali_v2_terms.storage_access(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not cali_session_guard.profile_requires_admission(auth.uid())
    or (
      (cali_workspace.v2_read_terms_state()->>'accepted')::boolean is true
      and (
        (split_part(p_path, '/', 1) <> 'documents' and split_part(p_path, '/', 2) <> 'deliverables')
        or storage.allow_any_operation(array['object.get_authenticated', 'object.get_authenticated_info'])
      )
    );
$$;
revoke all on function cali_v2_terms.storage_access(text) from public, anon, authenticated, service_role;
grant execute on function cali_v2_terms.storage_access(text) to authenticated;

create policy v2_hosted_current_terms_for_files on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'cali-workspace-private' or cali_v2_terms.storage_access(name)
  );
commit;
