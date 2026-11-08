begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_claim_pilot_admin_digest();
drop function if exists cali_workspace.v2_ack_pilot_admin_digest(uuid,uuid);
notify pgrst,'reload schema';
commit;
