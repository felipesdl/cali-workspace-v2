-- RESUMO-01/DEC-19. Preparação privada de fila no piloto.
-- A inscrição é explícita. Nenhum cron ou transporte é instalado.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_admin_digest_recipients (
  profile_id uuid primary key references cali_workspace.profiles(id) on delete cascade
);
create table if not exists cali_session_guard.phase4_admin_digest_queue (
  day date not null,
  profile_id uuid not null references cali_workspace.profiles(id) on delete cascade,
  as_of timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  primary key(day,profile_id)
);
alter table cali_session_guard.phase4_admin_digest_recipients enable row level security;
alter table cali_session_guard.phase4_admin_digest_queue enable row level security;
revoke all on cali_session_guard.phase4_admin_digest_recipients,cali_session_guard.phase4_admin_digest_queue
  from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_enqueue_admin_digest(p_instant timestamptz)
returns integer language plpgsql set search_path=''
as $$
declare
  local_instant timestamp := p_instant at time zone 'America/Sao_Paulo';
  cutoff timestamptz := (local_instant::date+time '19:00') at time zone 'America/Sao_Paulo';
  snapshot jsonb;
  inserted integer;
begin
  if local_instant is null or not isfinite(local_instant)
    or date_trunc('minute',local_instant)::time<>time '19:00' then return 0; end if;

  -- Usa a hora oficial mesmo se a execução iniciar alguns segundos depois.
  snapshot:=cali_session_guard.phase4_build_admin_daily_preview(cutoff);
  if jsonb_array_length(snapshot->'companies')=0 then return 0; end if;

  insert into cali_session_guard.phase4_admin_digest_queue(day,profile_id,as_of,payload)
  select local_instant::date,p.id,cutoff,snapshot
  from cali_session_guard.phase4_admin_digest_recipients s join cali_workspace.profiles p on p.id=s.profile_id
  where p.role::text='admin' and p.active and nullif(btrim(p.email),'') is not null
  order by p.id
  on conflict(day,profile_id) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end;
$$;
revoke all on function cali_session_guard.phase4_enqueue_admin_digest(timestamptz)
  from public,anon,authenticated,service_role;
commit;
