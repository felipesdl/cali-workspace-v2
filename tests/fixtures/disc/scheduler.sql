-- Substitutos exclusivamente descartáveis: não há rede, cron nem Vault reais.
create schema vault;
create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
create schema net;
create table net.requests(id bigint generated always as identity primary key,url text,headers jsonb,body jsonb,timeout_milliseconds integer);
create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000)
returns bigint language plpgsql as $$
declare request_id bigint;
begin
 if current_setting('test.transport_error',true)='true' then raise exception 'synthetic transport failure';end if;
 insert into net.requests(url,headers,body,timeout_milliseconds) values(url,headers,body,timeout_milliseconds) returning id into request_id;
 return request_id;
end $$;
create schema cron;
create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,username text default current_user);
create function cron.schedule(job_name text,cron_schedule text,cron_command text) returns bigint language plpgsql as $$
declare job_id bigint;
begin
 insert into cron.job(jobname,schedule,command) values(job_name,cron_schedule,cron_command)
 on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into job_id;
 return job_id;
end $$;
create function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$
begin delete from cron.job where jobid=job_id;return found;end $$;
create function public.check_scheduler(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
