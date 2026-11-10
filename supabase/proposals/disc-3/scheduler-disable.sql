-- Desativa só a agenda DISC conhecida. Não remove tarefas, respostas ou eventos.
begin;
set local lock_timeout='5s';
update cali_v2_disc.config set enabled=false where id;
do $$
declare existing_job record;
begin
 if to_regclass('cron.job') is null then return;end if;
 for existing_job in select jobid from cron.job where jobname='cali-v2-disc-pilot'
  and command='select cali_v2_disc.kick();' and username=current_user loop
  perform cron.unschedule(existing_job.jobid);
 end loop;
end $$;
commit;
