begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_read_pilot_mapa_report(uuid,uuid);
drop function if exists cali_session_guard.phase4_mapa_average(jsonb);
notify pgrst,'reload schema';
commit;
