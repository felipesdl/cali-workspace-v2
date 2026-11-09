begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_export_pilot_company_data(uuid,text);
drop function if exists cali_workspace.v2_preview_pilot_company_elimination(uuid);
drop function if exists cali_session_guard.phase4_elimination_coverage(uuid,text[]);
notify pgrst,'reload schema';
commit;
