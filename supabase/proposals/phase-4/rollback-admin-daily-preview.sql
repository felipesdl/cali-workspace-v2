begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_read_pilot_admin_daily_preview();
drop function if exists cali_session_guard.phase4_build_admin_daily_preview(timestamptz);
notify pgrst,'reload schema';
commit;
