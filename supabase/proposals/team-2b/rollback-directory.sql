begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_list_pilot_team(uuid,text,text,integer);
drop function cali_workspace.v2_read_pilot_team_member(uuid,uuid);
drop function cali_session_guard.require_pilot_team_actor(uuid);
notify pgrst, 'reload schema';
commit;
