-- Ativação separada. Não executar como consequência de aplicar scheduler.sql.
-- Antes: gate DEC-28, preimagem e worker com JWT + action=scheduled conferidos.
begin;
set local lock_timeout='5s';
do $$
declare bearer text; existing_job record;
begin
 if to_regprocedure('cali_v2_disc.worker_at(text,uuid,jsonb,timestamp with time zone)') is null
  or to_regclass('vault.decrypted_secrets') is null or to_regclass('cron.job') is null
  or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
  raise exception 'Preparação da agenda DISC incompleta.';
 end if;
 select decrypted_secret into bearer from vault.decrypted_secrets where name='cali_disc_worker_bearer';
 if bearer is null or bearer !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then
  raise exception 'JWT do worker não configurado no Vault.';
 end if;
 if (select count(*) from cali_v2_disc.allowed_recipients)<>2 then
  raise exception 'Reconciliar os dois destinatários autorizados do piloto antes de ativar.';
 end if;
 select * into existing_job from cron.job where jobname='cali-v2-disc-pilot';
 if found and (existing_job.command<>'select cali_v2_disc.kick();' or existing_job.username<>current_user) then
  raise exception 'Nome da agenda já ocupado por outro comando ou proprietário.';
 end if;
 perform cron.schedule('cali-v2-disc-pilot','* * * * *','select cali_v2_disc.kick();');
 update cali_v2_disc.config set enabled=true where id;
end $$;
commit;
