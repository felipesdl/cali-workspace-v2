-- Primeiro interrompe novas reservas automáticas; histórico DISC é preservado.
\ir scheduler-disable.sql
begin;
set local lock_timeout='5s';
create or replace function cali_v2_disc.kick() returns void language plpgsql security definer set search_path='' as $$
declare config cali_v2_disc.config;
begin
 select * into config from cali_v2_disc.config where id;
 if not config.enabled then return;end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=5000)'
 using 'https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/workspace-disc-pilot',
 jsonb_build_object('Content-Type','application/json','x-cali-disc-hook',config.hook_secret),'{}'::jsonb;
end $$;
create or replace function cali_workspace.v2_disc_worker(p_action text,p_job uuid default null,p_fields jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j cali_v2_disc.jobs;i cali_v2_disc.invites;c cali_v2_disc.campaigns;r cali_v2_disc.results;deadline timestamptz;
begin
 if p_action='authorize_hook' then return to_jsonb(exists(select 1 from cali_v2_disc.config where id and enabled and hook_secret=p_fields->>'secret'));
 elsif p_action='claim' then
  perform cali_v2_disc.schedule(statement_timestamp());
  select * into j from cali_v2_disc.jobs where (state='pending' or (state in('failed','processing') and lease_at<statement_timestamp()-interval '5 minutes')) and attempts<3 and (first_attempt_at is null or first_attempt_at>statement_timestamp()-interval '23 hours')
   order by created_at for update skip locked limit 1;
  if j.id is null then return null;end if;
  if not exists(select 1 from cali_v2_disc.allowed_recipients where email=j.recipient) then
   update cali_v2_disc.jobs set state='failed',error='Destinatário retirado da homologação.',attempts=3 where id=j.id;return null;end if;
  select * into c from cali_v2_disc.campaigns where id=j.campaign_id;
  select * into i from cali_v2_disc.invites where id=j.invite_id;
  if (j.kind='invite' and (c.status<>'open' or i.sent_at is not null or i.declined_at is not null or i.completed_at is not null))
   or (j.kind like 'reminder%' and (i.completed_at is not null or i.declined_at is not null or i.deadline_at<statement_timestamp() or c.status<>'open'))
   or (j.kind in('focal_eve','focal_close') and c.status<>'open')
   or (j.kind in('gestao_pdf','gestao_released') and (c.approved_at is null or c.revision<>(j.payload->'report'->>'revision')::integer)) then
   update cali_v2_disc.jobs set state='failed',error='Contexto alterado; envio cancelado.',attempts=3 where id=j.id;return null;end if;
  if j.kind='invite' then
   deadline:=((date_trunc('day',statement_timestamp() at time zone 'America/Sao_Paulo')+interval '7 days 23 hours 59 minutes') at time zone 'America/Sao_Paulo');
   update cali_v2_disc.invites set deadline_at=coalesce(deadline_at,deadline) where id=i.id returning * into i;
  end if;
  update cali_v2_disc.jobs set state='processing',lease_at=clock_timestamp(),first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1 where id=j.id;
  if j.kind='respondent_pdf' then select * into r from cali_v2_disc.results where invite_id=i.id;end if;
  return jsonb_build_object('id',j.id,'kind',j.kind,'recipient',j.recipient,'title',c.title,'organization',c.organization,'name',coalesce(i.person_name,j.payload->>'name',c.focal_name),
   'token',i.token,'deadline',i.deadline_at,'payload',j.payload,'created_at',j.created_at,
   'respondent',case when r.id is not null then jsonb_build_object('audience','respondent','title',c.title,'organization',c.organization,'protocol',r.protocol,'personName',r.person_name,
    'primary',r.primary_style,'secondary',r.secondary_style,'mixed',r.mixed,'createdAt',r.created_at,'signer',cali_workspace.profile_signer_snapshot()) else null end);
 elsif p_action='validate' then
  return to_jsonb(exists(select 1 from cali_v2_disc.jobs queued_job join cali_v2_disc.campaigns context_campaign on context_campaign.id=queued_job.campaign_id
   left join cali_v2_disc.invites context_invite on context_invite.id=queued_job.invite_id
   where queued_job.id=p_job and queued_job.state='processing' and exists(select 1 from cali_v2_disc.allowed_recipients a where a.email=queued_job.recipient)
    and (queued_job.kind not in('invite','reminder1','reminder2','reminder3','focal_eve','focal_close') or context_campaign.status='open')
    and (queued_job.kind not like 'reminder%' or (context_invite.completed_at is null and context_invite.declined_at is null and context_invite.deadline_at>statement_timestamp()))
    and (queued_job.kind not in('gestao_pdf','gestao_released') or (context_campaign.approved_at is not null and context_campaign.revision=(queued_job.payload->'report'->>'revision')::integer))));
 elsif p_action in('sent','failed') then
  select * into j from cali_v2_disc.jobs where id=p_job and state='processing' for update;
  if j.id is null then raise exception using errcode='22023',message='Envio não reservado.';end if;
  if p_action='sent' and nullif(p_fields->>'providerId','') is null then raise exception using errcode='22023',message='Provedor não confirmou o envio.';end if;
  update cali_v2_disc.jobs set state=p_action,finished_at=clock_timestamp(),provider_id=p_fields->>'providerId',error=case when p_action='failed' then left(p_fields->>'error',300) else null end where id=j.id;
  if p_action='sent' and j.kind='invite' then update cali_v2_disc.invites set sent_at=coalesce(sent_at,clock_timestamp()) where id=j.invite_id;end if;
  return jsonb_build_object('recorded',true);
 else raise exception using errcode='22023',message='Ação do worker inválida.';end if;
end $$;
drop function cali_v2_disc.worker_at(text,uuid,jsonb,timestamptz);
drop function cali_v2_disc.notification_window(timestamptz);
alter table cali_v2_disc.config drop column last_kick_at,drop column last_request_id,drop column last_kick_error;
commit;
