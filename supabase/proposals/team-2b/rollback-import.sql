-- Preserva fichas, trilha e registros privados gravados.
begin;
set local lock_timeout = '5s';
drop function cali_workspace.v2_preview_pilot_team_import(uuid,jsonb);
drop function cali_workspace.v2_confirm_pilot_team_import(uuid,date,jsonb,jsonb);
notify pgrst, 'reload schema';
commit;
