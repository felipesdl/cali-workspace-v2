-- Retira os endpoints e as policies do recorte. Auditoria preservada e privada.
begin;
set local lock_timeout='5s';
drop function cali_workspace.v2_write_pilot_team_metrics(uuid,date,timestamptz,jsonb,text,uuid);
drop function cali_workspace.v2_read_pilot_team_month(uuid,date);
drop policy v2_pilot_metrics_update on cali_workspace.team_month_metrics;
drop policy v2_pilot_metrics_insert on cali_workspace.team_month_metrics;
drop function cali_session_guard.team_month_legacy_allowed(uuid);
notify pgrst,'reload schema';
commit;
