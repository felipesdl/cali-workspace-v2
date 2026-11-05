-- A Edge recusa pedidos se a RPC estiver indisponível. Os PDFs ficam arquivados.
begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_can_download_pilot_pdf(text);
notify pgrst, 'reload schema';
commit;
