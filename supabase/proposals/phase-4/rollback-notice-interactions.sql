begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_moderate_pilot_notice_comment(uuid,uuid,uuid,uuid,uuid,boolean,text);
drop function if exists cali_workspace.v2_read_pilot_notice_interactions(uuid,uuid,integer);
drop function if exists cali_workspace.v2_comment_pilot_notice(uuid,uuid,uuid,text);
drop function if exists cali_workspace.v2_react_pilot_notice(uuid,uuid,text,text);
drop function if exists cali_session_guard.phase4_notice_interaction_actor(uuid,uuid);
notify pgrst,'reload schema';
commit;
