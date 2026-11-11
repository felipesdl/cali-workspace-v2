begin;
drop function if exists cali_workspace.v2_form_options(uuid,uuid),
 cali_workspace.v2_set_form_confirmation(uuid,uuid,timestamptz,boolean),
 cali_workspace.v2_list_form_trash(uuid,integer),
 cali_workspace.v2_trash_form(uuid,uuid,timestamptz,text),cali_workspace.v2_restore_form(uuid,uuid);
drop function if exists cali_session_guard.require_form_admin(uuid);
drop function if exists cali_workspace.v2_update_own_profile_media(jsonb,jsonb);
notify pgrst,'reload schema';
commit;
