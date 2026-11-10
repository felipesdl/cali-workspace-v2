-- FLOW-03. Transporte exclusivo do simulador Resend e aceite externo da versão aprovada.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_commercial_email (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.cali_proposals(id),
  approved_at timestamptz not null,
  requested_at timestamptz not null default clock_timestamp(),
  deadline timestamptz not null,
  snapshot jsonb not null,
  pdf bytea,
  token_hash bytea unique,
  provider_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz
);
alter table cali_session_guard.phase4_commercial_email enable row level security;
revoke all on cali_session_guard.phase4_commercial_email from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_prepare_pilot_commercial_email(
  p_company_id uuid,p_proposal_id uuid,p_expected timestamptz
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,p_role=>'admin');
  draft public.cali_proposals%rowtype;
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  job cali_session_guard.phase4_commercial_email%rowtype;
  protocol text;
begin
  -- Segue a ordem de locks da entrega no Workspace.
  select * into scope from cali_session_guard.phase4_commercial_scope g
  where g.company_id=p_company_id and g.proposal_id=p_proposal_id
    and g.operator_id=actor and g.expires_at>statement_timestamp() for update;
  if not found then raise exception using errcode='42501',message='Proposta indisponível.'; end if;
  select * into job from cali_session_guard.phase4_commercial_email where proposal_id=p_proposal_id;
  if found then
    if job.approved_at is distinct from p_expected or job.revoked_at is not null
      or job.requested_at<statement_timestamp()-interval '1 hour' then
      raise exception using errcode='40001',message='Envio indisponível para esta revisão.';
    end if;
    return jsonb_build_object('id',job.id,'sent',job.provider_id is not null,'snapshot',job.snapshot);
  end if;
  select s.protocol into protocol from public.cali_submissions s
  where s.id=scope.submission_id and left(s.protocol,11)='CALI-QA-V2-'
    and s.contact_email='qa-proposta-v2@example.invalid';
  if not found or scope.recipient_id is not null or scope.delivered_at is not null then
    raise exception using errcode='42501',message='Oportunidade fora do piloto de e-mail.';
  end if;
  select p.* into draft from public.cali_proposals p where p.id=p_proposal_id and p.submission_id=scope.submission_id for update;
  if not found or draft.status<>'aprovada' or draft.updated_at is distinct from p_expected
    or draft.total_value<=0 or draft.calculator_data->'pilotBuild' is null then
    raise exception using errcode='40001',message='Revise o cálculo e a aprovação.';
  end if;
  insert into cali_session_guard.phase4_commercial_email(proposal_id,approved_at,deadline,snapshot)
  values(draft.id,draft.updated_at,statement_timestamp()+make_interval(days=>draft.validity_days),
    jsonb_build_object('protocol',protocol,'version',draft.version,'total',draft.total_value,
      'package',draft.package_code,'months',draft.contract_months,'paymentTerms',draft.payment_terms,
      'publicNotes',draft.public_notes)) returning * into job;
  return jsonb_build_object('id',job.id,'sent',false,'snapshot',job.snapshot);
end;
$$;

create or replace function cali_workspace.v2_stage_pilot_commercial_email(p_id uuid,p_pdf text,p_token_hash text)
returns text language plpgsql security definer set search_path=''
as $$
declare
  job cali_session_guard.phase4_commercial_email%rowtype;
  bytes bytea;
begin
  select * into job from cali_session_guard.phase4_commercial_email where id=p_id for update;
  if not found or job.revoked_at is not null or job.requested_at<statement_timestamp()-interval '1 hour'
    or p_pdf is null or length(p_pdf)>700000 or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='42501',message='Envio indisponível.';
  end if;
  if job.pdf is not null then
    if job.token_hash is distinct from decode(p_token_hash,'hex') then
      raise exception using errcode='40001',message='Chave de envio mudou.';
    end if;
    return encode(job.pdf,'base64');
  end if;
  bytes:=decode(p_pdf,'base64');
  if substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
    raise exception using errcode='22023',message='PDF inválido.';
  end if;
  update cali_session_guard.phase4_commercial_email set pdf=bytes,token_hash=decode(p_token_hash,'hex') where id=p_id;
  return encode(bytes,'base64');
end;
$$;

create or replace function cali_workspace.v2_record_pilot_commercial_email(p_id uuid,p_provider uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  job cali_session_guard.phase4_commercial_email%rowtype;
  scope cali_session_guard.phase4_commercial_scope%rowtype;
  sent timestamptz := clock_timestamp();
begin
  select g.* into scope from cali_session_guard.phase4_commercial_scope g
  join cali_session_guard.phase4_commercial_email e on e.proposal_id=g.proposal_id
  where e.id=p_id for update of g;
  select * into job from cali_session_guard.phase4_commercial_email where id=p_id for update;
  if not found or scope.proposal_id is null or p_provider is null or job.pdf is null or job.revoked_at is not null then
    raise exception using errcode='42501',message='Envio indisponível.';
  end if;
  if job.provider_id=p_provider then return; end if;
  if job.provider_id is not null then raise exception using errcode='40001',message='Envio já registrado.'; end if;
  update public.cali_proposals p set status='enviada',updated_at=sent,sent_at=sent,resend_email_id=p_provider::text
    where p.id=job.proposal_id and p.submission_id=scope.submission_id
      and p.status='aprovada' and p.updated_at=job.approved_at;
  if not found then raise exception using errcode='40001',message='A revisão aprovada mudou.'; end if;
  update cali_session_guard.phase4_commercial_email set provider_id=p_provider where id=p_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(scope.company_id,scope.operator_id,'commercial_proposal_delivered','commercial_proposal',job.proposal_id,
    jsonb_build_object('version',job.snapshot->'version','channel','resend_test'));
end;
$$;

create or replace function public.v2_external_pilot_commercial_offer(p_token text,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  job cali_session_guard.phase4_commercial_email%rowtype;
  company uuid;
  accepted timestamptz := clock_timestamp();
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_accept is null then return null; end if;
  select * into job from cali_session_guard.phase4_commercial_email
    where token_hash=sha256(convert_to(p_token,'UTF8')) and provider_id is not null
      and revoked_at is null and deadline>statement_timestamp() for update;
  if not found then return null; end if;
  if p_accept and job.accepted_at is null then
    if job.deadline<=clock_timestamp() then return null; end if;
    update public.cali_proposals p set status='aceita',updated_at=accepted
      where p.id=job.proposal_id and p.status='enviada' and p.resend_email_id=job.provider_id::text
        and p.version=(job.snapshot->>'version')::integer and p.total_value=(job.snapshot->>'total')::numeric
        and p.package_code=job.snapshot->>'package' and p.contract_months=(job.snapshot->>'months')::integer
        and p.payment_terms is not distinct from job.snapshot->>'paymentTerms'
        and p.public_notes is not distinct from job.snapshot->>'publicNotes';
    if not found then raise exception using errcode='40001',message='A revisão mudou.'; end if;
    update cali_session_guard.phase4_commercial_email set accepted_at=accepted where id=job.id;
    select company_id into strict company from cali_session_guard.phase4_commercial_scope where proposal_id=job.proposal_id;
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(company,null,'commercial_proposal_accepted','commercial_proposal',job.proposal_id,
      jsonb_build_object('version',job.snapshot->'version','channel','external_test'));
    job.accepted_at:=accepted;
  end if;
  return job.snapshot||jsonb_build_object('deadline',job.deadline,'acceptedAt',job.accepted_at);
end;
$$;

revoke all on function cali_workspace.v2_prepare_pilot_commercial_email(uuid,uuid,timestamptz),
  cali_workspace.v2_stage_pilot_commercial_email(uuid,text,text),
  cali_workspace.v2_record_pilot_commercial_email(uuid,uuid),
  public.v2_external_pilot_commercial_offer(text,boolean) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_prepare_pilot_commercial_email(uuid,uuid,timestamptz) to authenticated;
grant execute on function cali_workspace.v2_stage_pilot_commercial_email(uuid,text,text),
  cali_workspace.v2_record_pilot_commercial_email(uuid,uuid) to service_role;
grant execute on function public.v2_external_pilot_commercial_offer(text,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
