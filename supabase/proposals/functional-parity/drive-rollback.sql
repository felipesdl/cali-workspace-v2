begin;
drop function if exists cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text),
  cali_workspace.v2_list_drive_sources(integer,uuid),cali_workspace.v2_read_drive_source(uuid,text);
drop function if exists cali_session_guard.drive_sources(uuid);
-- Preserva recibos privados e cópias que já chegaram ao Drive do cliente.
notify pgrst,'reload schema';
commit;
