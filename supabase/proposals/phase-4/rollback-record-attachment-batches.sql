-- Interrompe novos lotes. Mantém anexos existentes, leitura e retirada individual.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_post_pilot_record_batch(uuid,uuid,uuid,text,boolean,jsonb);
drop function if exists cali_session_guard.phase4_decode_record_batch_file(text,text);
drop function if exists cali_session_guard.phase4_office_package_matches(bytea,text);
drop function if exists cali_session_guard.phase4_zip_uint(bytea,integer,integer);
notify pgrst,'reload schema';
commit;
