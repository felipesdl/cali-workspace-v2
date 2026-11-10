-- Preserva fichas e histórico. Retira somente endpoints V2 de escrita.
begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_archive_pilot_team_member(uuid,uuid,date,timestamptz);
drop function cali_workspace.v2_save_pilot_team(uuid,date,jsonb);
drop function cali_session_guard.require_pilot_team_write(uuid,date);
notify pgrst, 'reload schema';
commit;
