\set ON_ERROR_STOP 1
\ir ../../../tests/fixtures/disc/context.sql
\ir candidate.sql
\ir ../../../tests/fixtures/disc/scheduler.sql
-- Guarda preimagem para comparar o rollback, sem dados privados.
create table public.scheduler_preimage as
 select oid::regprocedure::text identity,pg_get_functiondef(oid) definition
 from pg_proc where oid in('cali_v2_disc.kick()'::regprocedure,'cali_workspace.v2_disc_worker(text,uuid,jsonb)'::regprocedure);
\ir scheduler.sql

insert into cali_v2_disc.allowed_recipients values('respondent@synthetic.invalid'),('focal@synthetic.invalid');
insert into cali_v2_disc.campaigns(id,title,organization,purpose,focal_name,focal_email,created_by)
values('10000000-0000-4000-8000-000000000001','Campanha sintética','CALI QA','Prova isolada','Focal sintético','focal@synthetic.invalid','00000000-0000-4000-8000-000000000014');
insert into cali_v2_disc.invites(id,campaign_id,person_name,email,sent_at,deadline_at)
values('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Respondente sintético','respondent@synthetic.invalid','2026-11-06 12:00Z','2026-11-10 02:59Z');

select public.check_scheduler(not cali_v2_disc.notification_window('2026-11-06 10:59Z') and cali_v2_disc.notification_window('2026-11-06 11:00Z')
 and cali_v2_disc.notification_window('2026-11-06 20:59Z') and not cali_v2_disc.notification_window('2026-11-06 21:00Z')
 and not cali_v2_disc.notification_window('2026-11-07 14:00Z') and cali_v2_disc.notification_window('2026-11-09 11:00Z'),'janela Brasília: 8h inclusivo, 18h exclusivo, fim de semana');
select cali_v2_disc.kick();
select public.check_scheduler((select count(*)=0 from net.requests),'desligado não reserva HTTP');
update cali_v2_disc.config set enabled=true;
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001',null,'focal_close','focal@synthetic.invalid','missing-secret');
select public.check_scheduler((select last_kick_error='scheduler_bearer_unavailable' from cali_v2_disc.config)
 and (select count(*)=1 from cali_v2_disc.jobs),'Vault ausente bloqueia HTTP sem desfazer fila');
insert into vault.decrypted_secrets values('cali_disc_worker_bearer','sb_secret_synthetic');
update cali_v2_disc.config set last_kick_at=null;
select cali_v2_disc.kick();
select public.check_scheduler((select count(*)=0 from net.requests),'chave sem formato JWT não aciona gateway');
update vault.decrypted_secrets set decrypted_secret='synthetic.service.jwt';
update cali_v2_disc.config set last_kick_at=null;
select cali_v2_disc.kick();
select cali_v2_disc.kick();
select public.check_scheduler((select count(*)=1 from net.requests) and (select last_request_id is not null and last_kick_error is null from cali_v2_disc.config),'despertar coalescido com identificador de enfileiramento HTTP');
select public.check_scheduler((select headers->>'Authorization'='Bearer synthetic.service.jwt' and headers?'x-cali-disc-hook'
 and body='{"action":"scheduled"}'::jsonb and timeout_milliseconds=90000 and url='https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/workspace-disc-pilot' from net.requests),'destino e comando fixos, duas credenciais somente no transporte');
set test.transport_error='true';
update cali_v2_disc.config set last_kick_at=null;
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001',null,'focal_close','focal@synthetic.invalid','transport-error');
select public.check_scheduler((select last_kick_error='scheduler_transport_unavailable' from cali_v2_disc.config)
 and (select count(*)=2 from cali_v2_disc.jobs),'falha de transporte preserva fila e registra código sem segredo');
reset test.transport_error;
update cali_v2_disc.config set enabled=false;
delete from cali_v2_disc.jobs;

-- A mesma tarefa não pode sair em retentativa após 18h.
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','reminder1','respondent@synthetic.invalid','reminder1:10000000-0000-4000-8000-000000000002');
select public.check_scheduler(cali_v2_disc.worker_at('claim',null,'{}','2026-11-06 20:54Z') is not null,'reserva lembrete dentro do horário');
select public.check_scheduler(cali_v2_disc.worker_at('validate',(select id from cali_v2_disc.jobs),'{}','2026-11-06 20:59Z')='true'::jsonb
 and cali_v2_disc.worker_at('validate',(select id from cali_v2_disc.jobs),'{}','2026-11-06 21:00Z')='false'::jsonb,'revalida horário imediatamente antes de enviar');
select cali_v2_disc.worker_at('failed',(select id from cali_v2_disc.jobs),'{"error":"synthetic"}','2026-11-06 20:59Z');
select public.check_scheduler(cali_v2_disc.worker_at('claim',null,'{}','2026-11-06 21:05Z') is null and (select attempts=1 from cali_v2_disc.jobs),'retentativa fora do horário não consome tentativa');
select cali_v2_disc.worker_at('claim',null,'{}','2026-11-09 11:00Z');
select public.check_scheduler((select attempts=1 and state='failed' from cali_v2_disc.jobs where kind='reminder1'),'janela idempotente de 23 horas não é estendida pelo fim de semana');
delete from cali_v2_disc.jobs;
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','reminder1','respondent@synthetic.invalid','reminder1:10000000-0000-4000-8000-000000000002');
select public.check_scheduler(cali_v2_disc.worker_at('claim',null,'{}','2026-11-07 14:00Z') is null,'lembrete pendente aguarda dia útil');
select public.check_scheduler(cali_v2_disc.worker_at('claim',null,'{}','2026-11-09 11:00Z') is not null,'pendente sem tentativa pode iniciar na segunda');
select cali_v2_disc.schedule('2026-11-09 11:01Z');
select cali_v2_disc.schedule('2026-11-09 11:02Z');
select public.check_scheduler((select count(*)=1 from cali_v2_disc.jobs where kind='reminder1'),'cadência repetida mantém chave única do lembrete');
delete from cali_v2_disc.jobs;

-- Recipiente retirado/contexto alterado não bloqueiam a tarefa válida seguinte.
insert into cali_v2_disc.jobs(campaign_id,kind,recipient,job_key,created_at) values
 ('10000000-0000-4000-8000-000000000001','focal_close','removed@synthetic.invalid','removed','2026-11-06 10:00Z');
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','invite','respondent@synthetic.invalid','stale-invite');
select cali_v2_disc.queue('10000000-0000-4000-8000-000000000001',null,'focal_close','focal@synthetic.invalid','valid-focal');
update cali_v2_disc.jobs set created_at=case job_key when 'removed' then '2026-11-06 10:00Z'::timestamptz when 'stale-invite' then '2026-11-06 11:00Z'::timestamptz else '2026-11-06 12:00Z'::timestamptz end;
create temp table scheduler_claim as select cali_v2_disc.worker_at('claim',null,'{}','2026-11-06 14:00Z') result;
select public.check_scheduler((select result->>'kind'='focal_close' from scheduler_claim)
 and (select count(*)=2 from cali_v2_disc.jobs where attempts=3 and state='failed'),'ignora destinatário retirado e convite já enviado sem bloquear próximo');
select public.check_scheduler(not has_schema_privilege('service_role','cali_v2_disc','USAGE')
 and not has_function_privilege('service_role','cali_v2_disc.worker_at(text,uuid,jsonb,timestamptz)','EXECUTE')
 and not has_function_privilege('anon','cali_workspace.v2_disc_worker(text,uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','cali_workspace.v2_disc_worker(text,uuid,jsonb)','EXECUTE')
 and has_function_privilege('service_role','cali_workspace.v2_disc_worker(text,uuid,jsonb)','EXECUTE'),'relógio privado e fronteira RPC preservados');
set role service_role;
select cali_workspace.v2_disc_worker('authorize_hook',null,'{}');
reset role;

-- Ativação idempotente e desligamento não tocam outro cron.
insert into cron.job(jobname,schedule,command) values('other-domain','0 1 * * *','select 1;');
\ir scheduler-enable.sql
\ir scheduler-enable.sql
select public.check_scheduler((select count(*)=1 from cron.job where jobname='cali-v2-disc-pilot' and schedule='* * * * *'
 and command='select cali_v2_disc.kick();') and (select enabled from cali_v2_disc.config),'agenda única, sem segredo no comando');
\ir scheduler-disable.sql
select public.check_scheduler((select not enabled from cali_v2_disc.config)
 and not exists(select 1 from cron.job where jobname='cali-v2-disc-pilot') and exists(select 1 from cron.job where jobname='other-domain'),'desliga somente agenda DISC');

-- Prepara uma tarefa elegível para a prova de duas conexões do runner.
delete from cali_v2_disc.jobs;
insert into cali_v2_disc.events(campaign_id,kind,revision,request_id,fingerprint,result)
values('10000000-0000-4000-8000-000000000001','synthetic_history',1,gen_random_uuid(),'synthetic','{}');
insert into cali_v2_disc.revisions(campaign_id,revision,report,approved_at)
values('10000000-0000-4000-8000-000000000001',1,'{}',clock_timestamp());
insert into cali_v2_disc.jobs(campaign_id,kind,recipient,job_key) values
 ('10000000-0000-4000-8000-000000000001','respondent_pdf','respondent@synthetic.invalid','concurrent');
