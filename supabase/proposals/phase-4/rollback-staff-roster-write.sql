begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_save_pilot_staff_draft(uuid,uuid,uuid,timestamptz,text,text[],boolean);
notify pgrst,'reload schema';
commit;
