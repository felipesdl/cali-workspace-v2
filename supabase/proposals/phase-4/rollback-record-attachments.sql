-- Preserva mensagens, PDFs e auditoria. O leitor volta a omitir a capacidade.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text);
drop function if exists cali_workspace.v2_post_pilot_record_image(uuid,uuid,uuid,text,boolean,text,text);
drop function if exists cali_session_guard.phase4_post_record_attachment(uuid,uuid,uuid,text,boolean,text,text,boolean);
drop function if exists cali_workspace.v2_read_pilot_record_pdf(uuid,uuid,uuid);
drop function if exists cali_workspace.v2_withdraw_pilot_record_pdf(uuid,uuid,uuid,text);
drop function if exists cali_workspace.v2_post_pilot_record_batch(uuid,uuid,uuid,text,boolean,jsonb);
drop function if exists cali_workspace.v2_read_pilot_record_attachment(uuid,uuid,uuid,integer);
drop function if exists cali_workspace.v2_withdraw_pilot_record_attachment(uuid,uuid,uuid,integer,text);
drop function if exists cali_session_guard.phase4_decode_record_batch_file(text,text);
drop function if exists cali_session_guard.phase4_office_package_matches(bytea,text);
drop function if exists cali_session_guard.phase4_zip_uint(bytea,integer,integer);
notify pgrst,'reload schema';
commit;
