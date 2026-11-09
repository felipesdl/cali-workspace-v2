begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_decide_partner_pilot_hours(uuid,uuid,boolean,text);
drop function if exists cali_workspace.v2_list_partner_pilot_hour_requests(uuid,boolean,integer);
drop function if exists cali_workspace.v2_submit_partner_pilot_hours(uuid,uuid,date,integer,text,text);
drop function if exists cali_workspace.v2_read_partner_pilot_detail(uuid,text,uuid,integer);
drop function cali_workspace.v2_list_partner_pilot_items(uuid,text,integer);
drop function cali_workspace.v2_accept_partner_pilot_terms(text,text);
drop function cali_workspace.v2_accept_partner_pilot_invite();
drop function cali_workspace.v2_read_partner_pilot();
drop function cali_session_guard.phase5_partner_mfa();
drop function cali_session_guard.phase5_partner_invite();
-- Preservar termos aceitos, convites e histórico. As tabelas continuam privadas.
revoke execute on function cali_workspace.v2_issue_pilot_staff_invite(uuid,uuid,uuid,timestamptz,uuid,timestamptz),
  cali_workspace.v2_revoke_pilot_staff_invite(uuid,uuid) from authenticated;
notify pgrst,'reload schema';
commit;
