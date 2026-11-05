begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_read_pilot_team_history(uuid,date,uuid,integer);
drop function cali_workspace.v2_read_pilot_team_structure(uuid);
notify pgrst, 'reload schema';
commit;
