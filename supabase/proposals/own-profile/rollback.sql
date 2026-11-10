-- Retira a operação da V2 e preserva dados já gravados.
begin;
set local lock_timeout = '5s';
drop function if exists cali_workspace.v2_update_own_profile(jsonb, jsonb);
notify pgrst, 'reload schema';
commit;
