-- Rollback only when active preimage exactly matched these V1 definitions/grants.
-- Prefer catalog-produced rollback if policies or grants differ in homolog.
begin;
set local lock_timeout='5s';
drop policy if exists profile_results_client_visible on cali_workspace.profile_results;
create policy profile_results_client_visible on cali_workspace.profile_results for select to authenticated
  using (client_visible and company_id is not null and company_id=cali_workspace.current_company_id());
grant execute on function public.cali_profile_report(uuid) to anon,authenticated;
grant execute on function public.cali_profile_report_ready(uuid,text) to anon,authenticated;
create policy cali_profiles_report_upload on storage.objects for insert to anon,authenticated
  with check (bucket_id='cali-profiles' and public.cali_profile_accepts_report((storage.foldername(name))[1]));
commit;
