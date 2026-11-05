-- Preserva dados e auditoria. Retira as duas RPCs V2.
begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_read_pilot_team_private(uuid,uuid);
drop function cali_workspace.v2_write_pilot_team_private(uuid,uuid,timestamptz,boolean,jsonb);
notify pgrst, 'reload schema';
commit;
