-- Retira as operações de rascunho. Preserva relatórios e aprovações.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text);
drop function if exists cali_workspace.v2_update_pilot_report_draft(uuid,uuid,timestamptz,text,text);
drop function if exists cali_workspace.v2_curate_pilot_report(uuid,uuid,timestamptz,jsonb);
drop function if exists cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer);
notify pgrst,'reload schema';
commit;
