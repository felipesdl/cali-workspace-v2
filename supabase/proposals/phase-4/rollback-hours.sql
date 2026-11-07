-- Preserva lançamentos, timers, recibos e trilha. Encerrar pausas V2 antes de retirar a operação.
begin;
set local lock_timeout = '5s';
do $$ begin
 if exists(select 1 from cali_session_guard.phase4_hour_holds where resolved_at is null) then
   raise exception 'Encerre as pausas do piloto antes de retirar as operações de horas.';
 end if;
end $$;
drop function if exists cali_workspace.v2_pilot_hour_action(uuid,uuid,text,uuid,uuid,date,integer,text,text,boolean);
drop function if exists cali_workspace.v2_pilot_active_timers(uuid);
notify pgrst,'reload schema';
commit;
