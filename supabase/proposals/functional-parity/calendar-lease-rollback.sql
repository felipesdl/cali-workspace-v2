begin;
set local lock_timeout = '5s';
do $$
begin
  if exists(select 1 from cali_session_guard.agenda_calendar_leases where lease_until>clock_timestamp()) then
    raise exception 'Não retirar lease enquanto houver operação Calendar ativa.';
  end if;
end;
$$;
drop function if exists cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid);
drop table if exists cali_session_guard.agenda_calendar_leases;
notify pgrst,'reload schema';
commit;
