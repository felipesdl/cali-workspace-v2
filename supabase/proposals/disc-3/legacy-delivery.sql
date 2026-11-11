-- Optional private respondent PDF delivery for newly submitted V1 bridge receipts.
-- Edge worker must call v2_disc_legacy_delivery; no public/browser grants.
begin;
set local lock_timeout='5s';

alter table cali_workspace.profile_invite_submit_receipts
  add column result_id uuid references cali_workspace.profile_results(id);

create table cali_v2_disc.legacy_delivery_jobs(
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references cali_workspace.profile_invites(id),
  result_id uuid not null references cali_workspace.profile_results(id),
  request_id uuid not null unique,
  recipient text,
  state text not null check(state in('pending','blocked','processing','failed','sent')),
  created_at timestamptz not null default clock_timestamp(),
  first_attempt_at timestamptz,
  lease_at timestamptz,
  lease_id uuid,
  finished_at timestamptz,
  provider_id text,
  error text,
  attempts integer not null default 0 check(attempts between 0 and 3),
  unique(invite_id)
);
alter table cali_v2_disc.legacy_delivery_jobs enable row level security;
revoke all on cali_v2_disc.legacy_delivery_jobs from public,anon,authenticated,service_role;

create function cali_v2_disc.legacy_receipt_resolve_result()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  select i.result_id into new.result_id from cali_workspace.profile_invites i
  where i.id=new.invite_id and i.completed_at is not null and i.result_id is not null;
  if new.result_id is null then raise exception using errcode='22023',message='Resultado legado não confirmado.'; end if;
  return new;
end $$;
create trigger legacy_receipt_resolve_result before insert on cali_workspace.profile_invite_submit_receipts
for each row execute function cali_v2_disc.legacy_receipt_resolve_result();

create function cali_v2_disc.legacy_receipt_queue_delivery()
returns trigger language plpgsql security definer set search_path='' as $$
declare r cali_workspace.profile_results; i cali_workspace.profile_invites; allowed boolean;
begin
  select * into r from cali_workspace.profile_results where id=new.result_id;
  select * into i from cali_workspace.profile_invites where id=new.invite_id;
  select exists(select 1 from cali_v2_disc.allowed_recipients where email=lower(btrim(r.email))) into allowed;
  insert into cali_v2_disc.legacy_delivery_jobs(invite_id,result_id,request_id,recipient,state,error)
  values(i.id,r.id,new.request_id,
    case when allowed then lower(btrim(r.email)) else null end,
    case when allowed then 'pending' else 'blocked' end,
    case when allowed then null else 'recipient_outside_preview' end);
  return new;
end $$;
create trigger legacy_receipt_queue_delivery after insert on cali_workspace.profile_invite_submit_receipts
for each row execute function cali_v2_disc.legacy_receipt_queue_delivery();

create function cali_workspace.v2_disc_legacy_delivery(
  p_action text,p_job uuid default null,p_fields jsonb default '{}'
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j cali_v2_disc.legacy_delivery_jobs; r cali_workspace.profile_results; i cali_workspace.profile_invites;
  l cali_workspace.profile_links; c cali_workspace.companies; lease uuid; provider text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode='42501',message='Worker de entrega indisponível.';
  end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' or pg_column_size(p_fields)>4096
    or p_action not in('claim','validate','sent','failed') then
    raise exception using errcode='22023',message='Operação de entrega inválida.';
  end if;
  if p_action='claim' then
    select * into j from cali_v2_disc.legacy_delivery_jobs
    where (state='pending' or (state in('failed','processing') and lease_at<statement_timestamp()-interval '5 minutes'))
      and attempts<3 and (first_attempt_at is null or first_attempt_at>statement_timestamp()-interval '23 hours')
    order by created_at for update skip locked limit 1;
    if j.id is null then return null; end if;
    if not exists(select 1 from cali_v2_disc.allowed_recipients a where a.email=j.recipient) then
      update cali_v2_disc.legacy_delivery_jobs set state='blocked',error='recipient_outside_preview',lease_id=null where id=j.id;
      return null;
    end if;
    select * into r from cali_workspace.profile_results where id=j.result_id;
    select * into i from cali_workspace.profile_invites where id=j.invite_id;
    select * into l from cali_workspace.profile_links where id=i.link_id;
    select * into c from cali_workspace.companies where id=l.company_id;
    if r.id is null or i.completed_at is null or i.result_id is distinct from r.id or l.company_id is null
      or l.company_id not in('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid) then
      update cali_v2_disc.legacy_delivery_jobs set state='blocked',error='legacy_context_unavailable',lease_id=null where id=j.id;
      return null;
    end if;
    lease:=gen_random_uuid();
    update cali_v2_disc.legacy_delivery_jobs set state='processing',lease_at=clock_timestamp(),lease_id=lease,
      first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1 where id=j.id returning * into j;
    return jsonb_build_object(
      'id',j.id,'kind','respondent_pdf','state','processing','campaign_id',l.id,'created_at',j.created_at,
      'error',null,'recipient',j.recipient,
      'title',l.title,'organization',coalesce(c.display_name,l.company_label,'CALI RH'),'name',r.person_name,
      'token',null,'deadline',null,'created_at',j.created_at,'payload','{}'::jsonb,'legacyLease',lease,
      'respondent',jsonb_build_object('audience','respondent','title',l.title,
        'organization',coalesce(c.display_name,l.company_label,'CALI RH'),
        'protocol',coalesce(nullif(r.protocol,''),'CALI-PERFIL-LEGADO-'||upper(substr(replace(r.id::text,'-',''),1,12))),
        'personName',r.person_name,'primary',r.primary_style,'secondary',r.secondary_style,'mixed',r.mixed,
        'createdAt',r.created_at,'signer',null)
    );
  end if;

  if p_job is null or (p_fields->>'lease') is null then
    raise exception using errcode='22023',message='Lease de entrega ausente.';
  end if;
  lease:=(p_fields->>'lease')::uuid;
  select * into j from cali_v2_disc.legacy_delivery_jobs where id=p_job for update;
  if j.id is null or j.state<>'processing' or j.lease_id is distinct from lease then
    raise exception using errcode='40001',message='Lease de entrega vencido.';
  end if;

  if p_action='validate' then
    return to_jsonb(exists(
      select 1 from cali_v2_disc.legacy_delivery_jobs x
      join cali_workspace.profile_invites v on v.id=x.invite_id
      join cali_workspace.profile_results result on result.id=x.result_id
      join cali_workspace.profile_links link on link.id=v.link_id
      where x.id=p_job and x.state='processing' and x.lease_id=lease and v.completed_at is not null
        and v.result_id=result.id and lower(result.email)=x.recipient
        and link.company_id in('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid)
        and exists(select 1 from cali_v2_disc.allowed_recipients a where a.email=x.recipient)
    ));
  elsif p_action='sent' then
    provider:=nullif(p_fields->>'providerId','');
    if provider is null or length(provider)>300 then raise exception using errcode='22023',message='Confirmação do provedor ausente.'; end if;
    update cali_v2_disc.legacy_delivery_jobs set state='sent',provider_id=provider,finished_at=clock_timestamp(),error=null
      where id=j.id and state='processing' and lease_id=lease;
    update cali_workspace.profile_results set report_emailed_at=coalesce(report_emailed_at,clock_timestamp()) where id=j.result_id;
    return jsonb_build_object('id',j.id,'state','sent');
  else
    update cali_v2_disc.legacy_delivery_jobs set state='failed',finished_at=clock_timestamp(),
      error=case when p_fields->>'error'='recipient_outside_preview' then 'recipient_outside_preview' else 'delivery_unconfirmed' end
      where id=j.id and state='processing' and lease_id=lease;
    return jsonb_build_object('id',j.id,'state','failed');
  end if;
end $$;
revoke all on function cali_workspace.v2_disc_legacy_delivery(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function cali_workspace.v2_disc_legacy_delivery(text,uuid,jsonb) to service_role;
commit;
