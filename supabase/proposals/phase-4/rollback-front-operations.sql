-- Preserva vínculos, recibos e histórico.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_list_pilot_front_options(uuid);
drop function if exists cali_workspace.v2_activate_pilot_front(uuid,uuid,text,text,text,date,date);
drop function if exists cali_workspace.v2_end_pilot_front(uuid,uuid);
notify pgrst,'reload schema';
commit;
