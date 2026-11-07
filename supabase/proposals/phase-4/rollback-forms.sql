-- Reverte somente as RPCs de Forms. Preserva rascunhos, respostas, recibos e auditoria.
begin;
set local lock_timeout = '5s';
drop function if exists cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer);
drop function if exists cali_workspace.v2_save_pilot_form_triage(uuid,uuid,uuid,text,text,text,text);
drop function if exists cali_workspace.v2_edit_pilot_form_draft(uuid,uuid,timestamptz,text,jsonb);
drop function if exists cali_workspace.v2_read_pilot_form_draft(uuid,uuid);
drop function if exists cali_workspace.v2_create_pilot_form_draft(uuid,uuid,text,text);
drop function if exists cali_workspace.v2_list_pilot_forms(uuid,integer);
drop function if exists cali_workspace.v2_set_pilot_form_state(uuid,uuid,text,text);
notify pgrst, 'reload schema';
commit;
