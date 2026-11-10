begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_review_pilot_mapa(uuid,uuid,integer,text,text);
drop function if exists cali_workspace.v2_list_pilot_mapa(uuid,integer);
notify pgrst,'reload schema';
commit;
