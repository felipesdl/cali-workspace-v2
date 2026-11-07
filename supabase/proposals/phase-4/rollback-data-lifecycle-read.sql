begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_read_pilot_data_lifecycle(uuid);
notify pgrst,'reload schema';
commit;
