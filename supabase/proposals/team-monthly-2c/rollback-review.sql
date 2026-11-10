-- Mantém confirmações, snapshots, vagas e auditoria. Remove apenas endpoints novos.
begin;
set local lock_timeout='5s';
drop function cali_workspace.v2_confirm_pilot_team_month(uuid,date,text,jsonb,text,uuid);
drop function cali_workspace.v2_read_pilot_team_review(uuid,date);
drop function cali_session_guard.team_review_token(uuid,date);
notify pgrst,'reload schema';
commit;
