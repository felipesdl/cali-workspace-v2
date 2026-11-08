-- Desabilita o envio e preserva os recibos e a trilha de auditoria.
begin;
drop function if exists cali_workspace.v2_prepare_pilot_mapa_email(uuid,uuid,jsonb);
drop function if exists cali_workspace.v2_record_pilot_mapa_email(uuid,uuid);
notify pgrst,'reload schema';
commit;
