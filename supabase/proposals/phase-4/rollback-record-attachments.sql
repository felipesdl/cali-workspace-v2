-- Preserva mensagens, PDFs e auditoria. O leitor volta a omitir a capacidade.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text);
drop function if exists cali_workspace.v2_read_pilot_record_pdf(uuid,uuid,uuid);
drop function if exists cali_workspace.v2_withdraw_pilot_record_pdf(uuid,uuid,uuid,text);
notify pgrst,'reload schema';
commit;
