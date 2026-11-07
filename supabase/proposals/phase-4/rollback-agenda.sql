-- Retira o piloto da agenda e conserva eventos, decisões, recibos e supressão do QA.
begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_decide_pilot_agenda_change(uuid,uuid,boolean,text,integer);
drop function if exists cali_workspace.v2_complete_pilot_appointment(uuid,uuid);
drop function if exists cali_workspace.v2_request_pilot_agenda_change(uuid,uuid,uuid,text,text,jsonb);
drop function if exists cali_workspace.v2_list_pilot_appointments(uuid,integer);
drop function if exists cali_workspace.v2_list_pilot_agenda_extras(uuid,integer);
drop function if exists cali_workspace.v2_request_pilot_appointment(uuid,uuid,text,text,text,text,jsonb);
drop function if exists cali_workspace.v2_respond_pilot_appointment(uuid,uuid,text,text,integer);
notify pgrst,'reload schema';
commit;
