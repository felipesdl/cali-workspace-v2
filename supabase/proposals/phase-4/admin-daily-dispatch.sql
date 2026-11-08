-- RESUMO-01. Consumo da fila pelo simulador, sem instalar agendamento.
begin;
set local lock_timeout='5s';

alter table cali_session_guard.phase4_admin_digest_queue
  add column if not exists claim_id uuid,
  add column if not exists claimed_until timestamptz,
  add column if not exists provider_id uuid,
  add column if not exists completed_at timestamptz;

create or replace function cali_workspace.v2_claim_pilot_admin_digest()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  now_at timestamptz := statement_timestamp();
  job cali_session_guard.phase4_admin_digest_queue%rowtype;
begin
  select q.* into job from cali_session_guard.phase4_admin_digest_queue q
  join cali_session_guard.phase4_admin_digest_recipients r on r.profile_id=q.profile_id
  join cali_workspace.profiles p on p.id=q.profile_id
  where q.provider_id is null and (q.claimed_until is null or q.claimed_until<=now_at)
    and q.as_of between now_at-interval '2 hours' and now_at
    and p.role::text='admin' and p.active and nullif(btrim(p.email),'') is not null
  order by q.day,q.profile_id limit 1 for update of q skip locked;
  if not found then return null; end if;
  update cali_session_guard.phase4_admin_digest_queue q
  set claim_id=gen_random_uuid(),claimed_until=now_at+interval '45 seconds'
  where q.day=job.day and q.profile_id=job.profile_id returning q.* into job;
  return jsonb_build_object('claimId',job.claim_id,
    'idempotencyKey','cali-admin-digest-test-'||job.day::text||'-'||job.profile_id::text,'summary',job.payload);
end;
$$;

create or replace function cali_workspace.v2_ack_pilot_admin_digest(p_claim_id uuid,p_provider_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if p_claim_id is null or p_provider_id is null then
    raise exception using errcode='22023',message='Recibo inválido.';
  end if;
  update cali_session_guard.phase4_admin_digest_queue q
  set provider_id=p_provider_id,completed_at=coalesce(q.completed_at,statement_timestamp()),claimed_until=null
  where q.claim_id=p_claim_id and (q.provider_id is null or q.provider_id=p_provider_id);
  return found;
end;
$$;
revoke all on function cali_workspace.v2_claim_pilot_admin_digest(),
  cali_workspace.v2_ack_pilot_admin_digest(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_claim_pilot_admin_digest(),
  cali_workspace.v2_ack_pilot_admin_digest(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
