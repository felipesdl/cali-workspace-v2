-- Desativa o contrato V2 e mantém os recibos e publicações para auditoria.
-- Se a SPA V2 já estiver publicada, restaurar antes a revisão que lê o contrato legado.
begin;
set local lock_timeout = '5s';
update cali_v2_terms.publications set is_current = false where is_current;
commit;
