begin;
set local lock_timeout = '5s';
drop function if exists cali_workspace.v2_read_pilot_hours(uuid,date,integer);
drop function if exists cali_workspace.v2_read_pilot_project(uuid,uuid,text,integer);
drop function if exists cali_workspace.v2_list_pilot_projects(uuid,integer);
drop function if exists cali_workspace.v2_read_pilot_catalog(uuid,text,date,integer);
notify pgrst, 'reload schema';
commit;
