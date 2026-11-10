-- Reverte apenas a guarda nova. Avaliar exposição dos arquivos antes de executar.
begin;
set local lock_timeout = '5s';
drop policy if exists v2_hosted_current_terms_for_files on storage.objects;
drop function if exists cali_v2_terms.storage_access(text);
commit;
