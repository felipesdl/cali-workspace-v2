begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_correct_pilot_hour(uuid,uuid,uuid,text,text,text,date,integer,text,boolean);
notify pgrst,'reload schema';
commit;
