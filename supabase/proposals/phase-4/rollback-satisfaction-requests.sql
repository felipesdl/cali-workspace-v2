begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_read_satisfaction_requests(uuid,date,integer);
drop function if exists cali_workspace.v2_close_satisfaction_request(uuid,uuid,timestamptz);
drop trigger if exists phase4_track_satisfaction_request on cali_workspace.account_records;
drop function if exists cali_session_guard.track_phase4_satisfaction_request();
-- Preservar o histórico das solicitações e o registro de encerramento.
notify pgrst,'reload schema';
commit;
