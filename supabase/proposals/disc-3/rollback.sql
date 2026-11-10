-- Suspender worker/agendamento e composição antes da retirada. Histórico privado preservado.
begin;
set local lock_timeout='5s';
drop function cali_workspace.v2_disc_admin(uuid);
drop function cali_workspace.v2_disc_client();
drop function cali_workspace.v2_disc_command(uuid,integer,uuid,text,jsonb);
drop function cali_workspace.v2_disc_document(uuid,uuid);
drop function cali_workspace.v2_disc_public(uuid,text,jsonb);
drop function cali_workspace.v2_disc_worker(text,uuid,jsonb);
notify pgrst,'reload schema';
commit;
