-- Optional DEC-13 hardening. Apply only after active catalog/preimage review in
-- the isolated homolog project. Preserves all rows, PDF objects and admin access.
begin;
set local lock_timeout='5s';
drop policy if exists profile_results_client_visible on cali_workspace.profile_results;
revoke all on function public.cali_profile_report(uuid) from public,anon,authenticated;
revoke all on function public.cali_profile_report_ready(uuid,text) from public,anon,authenticated;
drop policy if exists cali_profiles_report_upload on storage.objects;
commit;
