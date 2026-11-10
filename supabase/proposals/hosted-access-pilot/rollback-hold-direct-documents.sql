-- Só liberar com entrega de documentos validada e cache/links antigos tratados.
begin;
set local lock_timeout = '5s';
drop policy v2_hold_pilot_direct_documents on storage.objects;
drop function cali_v2_terms.pilot_direct_document_allowed(text);
commit;
