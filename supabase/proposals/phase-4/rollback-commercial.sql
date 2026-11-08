-- Retira as operações da V2 e preserva propostas, auditoria e escopo.
begin;
set local lock_timeout = '5s';

drop function if exists cali_workspace.v2_accept_pilot_commercial_offer(uuid,uuid,integer);
drop function if exists cali_workspace.v2_read_pilot_received_offers(uuid);
drop function if exists cali_workspace.v2_send_pilot_commercial_offer(uuid,uuid,timestamptz);
drop function if exists cali_workspace.v2_create_pilot_commercial_draft(uuid,uuid);
drop function if exists cali_workspace.v2_save_pilot_commercial_draft(uuid,uuid,timestamptz,text,text,text,integer);
drop function if exists cali_workspace.v2_read_pilot_commercial_draft(uuid,uuid);
drop function if exists cali_workspace.v2_require_pilot_commercial_scope(uuid,uuid);
drop function if exists cali_session_guard.require_phase4_commercial_proposal(uuid,uuid);
drop function if exists cali_workspace.v2_read_pilot_commercial(uuid,integer);

notify pgrst,'reload schema';
commit;
