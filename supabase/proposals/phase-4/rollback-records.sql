-- Retira as operações deste lote. Preserva dados, recibos e a inscrição de QA.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_review_pilot_record(uuid,uuid,uuid,text,integer,text,uuid);
drop function if exists cali_workspace.v2_pilot_record_action(uuid,uuid,uuid,text,text,text,boolean,text,text);
drop function if exists cali_workspace.v2_read_pilot_record(uuid,uuid,integer);
drop trigger if exists zz_phase4_record_mention_in_app on cali_workspace.notifications;
drop function if exists cali_session_guard.phase4_record_mention_in_app();
drop function if exists cali_workspace.v2_publish_pilot_notice(uuid,uuid,text,text,text,date);
drop function if exists cali_workspace.v2_set_pilot_notice_state(uuid,uuid,text,text);
drop function if exists cali_workspace.v2_ack_pilot_notice(uuid,uuid,boolean);
drop function if exists cali_workspace.v2_read_pilot_satisfaction(uuid,integer);
drop function if exists cali_workspace.v2_save_pilot_satisfaction_followup(uuid,text,text,timestamptz,timestamptz,text,text);
drop function if exists cali_session_guard.phase4_low_feedback(uuid);
notify pgrst,'reload schema';
commit;
