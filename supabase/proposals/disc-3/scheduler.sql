-- Incremento DISC: preparação local. Não instala cron nem habilita envios.
-- Aplicação hospedada exige preimagem, worker compatível e gate DEC-28 próprio.
begin;
set local lock_timeout='5s';
alter table cali_v2_disc.config add column last_kick_at timestamptz,
 add column last_request_id bigint, add column last_kick_error text;

create function cali_v2_disc.notification_window(p_now timestamptz) returns boolean
language sql immutable set search_path='' as $$
 select extract(isodow from p_now at time zone 'America/Sao_Paulo') between 1 and 5
 and extract(hour from p_now at time zone 'America/Sao_Paulo')>=8
 and extract(hour from p_now at time zone 'America/Sao_Paulo')<18;
$$;

create or replace function cali_v2_disc.kick() returns void language plpgsql security definer set search_path='' as $$
declare config cali_v2_disc.config; bearer text; request_id bigint;
begin
 select * into config from cali_v2_disc.config where id for update;
 if not config.enabled or config.last_kick_at>clock_timestamp()-interval '1 minute' then return;end if;
 update cali_v2_disc.config set last_kick_at=clock_timestamp(),last_kick_error=null where id;
 -- O erro de infraestrutura não desfaz a submissão que inseriu a tarefa.
 begin
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1'
   into bearer using 'cali_disc_worker_bearer';
  if bearer is null or bearer !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then
   update cali_v2_disc.config set last_kick_error='scheduler_bearer_unavailable' where id;return;
  end if;
  execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=90000)'
   into request_id using 'https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/workspace-disc-pilot',
   jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||bearer,'x-cali-disc-hook',config.hook_secret),
   '{"action":"scheduled"}'::jsonb;
  update cali_v2_disc.config set last_request_id=request_id where id;
 exception when others then
  update cali_v2_disc.config set last_kick_error='scheduler_transport_unavailable' where id;
 end;
end $$;

create function cali_v2_disc.worker_at(p_action text,p_job uuid,p_fields jsonb,p_now timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare skipped integer;j cali_v2_disc.jobs;i cali_v2_disc.invites;c cali_v2_disc.campaigns;r cali_v2_disc.results;deadline timestamptz;
begin
 if p_action='authorize_hook' then return to_jsonb(exists(select 1 from cali_v2_disc.config where id and enabled and hook_secret=p_fields->>'secret'));
 elsif p_action='claim' then
  perform cali_v2_disc.schedule(p_now);
  for skipped in 1..20 loop
  select * into j from cali_v2_disc.jobs where (state='pending' or (state in('failed','processing') and lease_at<p_now-interval '5 minutes')) and attempts<3 and (first_attempt_at is null or first_attempt_at>p_now-interval '23 hours')
   and (kind not in('reminder1','reminder2','reminder3','focal_eve','focal_close') or cali_v2_disc.notification_window(p_now))
   order by created_at,id for update skip locked limit 1;
  if j.id is null then return null;end if;
  if not exists(select 1 from cali_v2_disc.allowed_recipients where email=j.recipient) then
   update cali_v2_disc.jobs set state='failed',error='Destinatário retirado da homologação.',attempts=3 where id=j.id;continue;end if;
  select * into c from cali_v2_disc.campaigns where id=j.campaign_id;
  select * into i from cali_v2_disc.invites where id=j.invite_id;
  if (j.kind='invite' and (c.status<>'open' or i.sent_at is not null or i.declined_at is not null or i.completed_at is not null))
   or (j.kind like 'reminder%' and (i.completed_at is not null or i.declined_at is not null or i.deadline_at<=p_now or c.status<>'open'))
   or (j.kind in('focal_eve','focal_close') and c.status<>'open')
   or (j.kind in('gestao_pdf','gestao_released') and (c.approved_at is null or c.revision<>(j.payload->'report'->>'revision')::integer)) then
   update cali_v2_disc.jobs set state='failed',error='Contexto alterado; envio cancelado.',attempts=3 where id=j.id;continue;end if;
  if j.kind='invite' then
   deadline:=((date_trunc('day',p_now at time zone 'America/Sao_Paulo')+interval '7 days 23 hours 59 minutes') at time zone 'America/Sao_Paulo');
   update cali_v2_disc.invites set deadline_at=coalesce(deadline_at,deadline) where id=i.id returning * into i;
  end if;
  update cali_v2_disc.jobs set state='processing',lease_at=p_now,first_attempt_at=coalesce(first_attempt_at,p_now),attempts=attempts+1 where id=j.id;
  if j.kind='respondent_pdf' then select * into r from cali_v2_disc.results where invite_id=i.id;end if;
  return jsonb_build_object('id',j.id,'kind',j.kind,'recipient',j.recipient,'title',c.title,'organization',c.organization,'name',coalesce(i.person_name,j.payload->>'name',c.focal_name),
   'token',i.token,'deadline',i.deadline_at,'payload',j.payload,'created_at',j.created_at,
   'respondent',case when r.id is not null then jsonb_build_object('audience','respondent','title',c.title,'organization',c.organization,'protocol',r.protocol,'personName',r.person_name,
    'primary',r.primary_style,'secondary',r.secondary_style,'mixed',r.mixed,'createdAt',r.created_at,'signer',cali_workspace.profile_signer_snapshot()) else null end);
  end loop;
  return null;
 elsif p_action='validate' then
  return to_jsonb(exists(select 1 from cali_v2_disc.jobs queued_job join cali_v2_disc.campaigns context_campaign on context_campaign.id=queued_job.campaign_id
   left join cali_v2_disc.invites context_invite on context_invite.id=queued_job.invite_id
   where queued_job.id=p_job and queued_job.state='processing'
    and (queued_job.kind not in('reminder1','reminder2','reminder3','focal_eve','focal_close') or cali_v2_disc.notification_window(p_now)) and exists(select 1 from cali_v2_disc.allowed_recipients a where a.email=queued_job.recipient)
    and (queued_job.kind not in('invite','reminder1','reminder2','reminder3','focal_eve','focal_close') or context_campaign.status='open')
    and (queued_job.kind not like 'reminder%' or (context_invite.completed_at is null and context_invite.declined_at is null and context_invite.deadline_at>p_now))
    and (queued_job.kind not in('gestao_pdf','gestao_released') or (context_campaign.approved_at is not null and context_campaign.revision=(queued_job.payload->'report'->>'revision')::integer))));
 elsif p_action in('sent','failed') then
  select * into j from cali_v2_disc.jobs where id=p_job and state='processing' for update;
  if j.id is null then raise exception using errcode='22023',message='Envio não reservado.';end if;
  if p_action='sent' and nullif(p_fields->>'providerId','') is null then raise exception using errcode='22023',message='Provedor não confirmou o envio.';end if;
  update cali_v2_disc.jobs set state=p_action,finished_at=p_now,provider_id=p_fields->>'providerId',error=case when p_action='failed' then left(p_fields->>'error',300) else null end where id=j.id;
  if p_action='sent' and j.kind='invite' then update cali_v2_disc.invites set sent_at=coalesce(sent_at,p_now) where id=j.invite_id;end if;
  return jsonb_build_object('recorded',true);
 else raise exception using errcode='22023',message='Ação do worker inválida.';end if;
end $$;

-- O relógio configurável fica privado e sem grants. A API usa apenas o relógio do servidor.
create or replace function cali_workspace.v2_disc_worker(p_action text,p_job uuid default null,p_fields jsonb default '{}')
returns jsonb language sql volatile security definer set search_path='' as $$
 select cali_v2_disc.worker_at(p_action,p_job,p_fields,clock_timestamp());
$$;
revoke all on function cali_v2_disc.notification_window(timestamptz),
 cali_v2_disc.worker_at(text,uuid,jsonb,timestamptz),cali_v2_disc.kick() from public,anon,authenticated,service_role;
-- CREATE OR REPLACE mantém os grants existentes da RPC; nenhuma concessão nova.
commit;
