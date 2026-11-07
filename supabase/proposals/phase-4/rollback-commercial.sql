-- Retira as operações da V2 e preserva propostas, auditoria e escopo.
begin;
set local lock_timeout = '5s';

drop function if exists cali_workspace.v2_save_pilot_commercial_draft(uuid,uuid,timestamptz,text,text,text,integer);
drop function if exists cali_workspace.v2_read_pilot_commercial_draft(uuid,uuid);
drop function if exists cali_workspace.v2_require_pilot_commercial_scope(uuid,uuid);
drop function if exists cali_workspace.v2_read_pilot_commercial(uuid,integer);

notify pgrst,'reload schema';
commit;
