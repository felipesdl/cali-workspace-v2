-- Retira apenas o contrato novo. Preserva notificações e leituras registradas.
begin;
set local lock_timeout = '5s';
drop function if exists cali_workspace.v2_mark_my_notifications_read(uuid);
drop function if exists cali_workspace.v2_list_my_notifications();
drop function if exists cali_session_guard.require_notification_recipient();
notify pgrst, 'reload schema';
commit;
