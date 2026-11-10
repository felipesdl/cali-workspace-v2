-- Retira as operações deste lote e preserva pedidos, recibos e auditoria.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_acknowledge_pilot_report(uuid,uuid);
drop function if exists cali_workspace.v2_pilot_report_readiness(uuid,date);
drop function if exists cali_workspace.v2_list_pilot_privacy_requests(uuid,integer);
drop function if exists cali_workspace.v2_submit_pilot_privacy_request(uuid,uuid,text,text);
drop function if exists cali_workspace.v2_answer_pilot_privacy_request(uuid,uuid,text);
-- Mantém a inscrição e a proteção da fixture em chamadas legadas.
notify pgrst,'reload schema';
commit;
