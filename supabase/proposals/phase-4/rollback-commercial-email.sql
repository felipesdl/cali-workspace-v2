-- Retira as capacidades deste lote e preserva propostas, PDFs e auditoria.
begin;
set local lock_timeout='5s';
drop function if exists public.v2_external_pilot_commercial_offer(text,boolean);
drop function if exists cali_workspace.v2_record_pilot_commercial_email(uuid,uuid);
drop function if exists cali_workspace.v2_stage_pilot_commercial_email(uuid,text,text);
drop function if exists cali_workspace.v2_prepare_pilot_commercial_email(uuid,uuid,timestamptz);
drop function if exists cali_workspace.v2_price_pilot_commercial_draft(uuid,uuid,timestamptz,numeric,numeric,integer);
notify pgrst,'reload schema';
commit;
