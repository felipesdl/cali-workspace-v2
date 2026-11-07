-- Retira a liberação V2. Preserve a prova: retire a publicação sintética antes.
begin;
set local lock_timeout='5s';
do $$
begin
  if exists(select 1 from cali_session_guard.phase4_report_releases where withdrawn_at is null) then
    raise exception 'Retire as liberações ativas antes de reverter as operações.';
  end if;
end $$;
drop function if exists cali_workspace.v2_prepare_pilot_report_pdf(uuid,uuid,integer);
drop function if exists cali_workspace.v2_store_generated_pilot_report_pdf(uuid,uuid,integer,uuid,text);
drop function if exists cali_workspace.v2_release_pilot_report(uuid,uuid,integer,boolean);
drop function if exists cali_workspace.v2_read_pilot_report_pdf(uuid,uuid,integer);
drop function if exists cali_workspace.v2_ack_pilot_report_release(uuid,uuid,integer);
drop function if exists cali_workspace.v2_read_pilot_report_catalog(uuid,integer);
notify pgrst,'reload schema';
commit;
