-- Lease server-side for Google Calendar effects. Candidate only; do not deploy implicitly.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.agenda_calendar_leases (
  event_id uuid primary key references cali_workspace.events(id) on delete cascade,
  token uuid not null,
  acquired_at timestamptz not null,
  lease_until timestamptz not null
);
alter table cali_session_guard.agenda_calendar_leases enable row level security;
revoke all on cali_session_guard.agenda_calendar_leases from public, anon, authenticated, service_role;

create or replace function cali_workspace.v2_agenda_calendar_lease(
  p_event_id uuid, p_action text, p_token uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fresh_token uuid;
  lease_end timestamptz;
  released boolean := false;
begin
  if p_event_id is null or p_action is null or p_action not in ('acquire','release') then
    raise exception using errcode='22023', message='Operação de lease inválida.';
  end if;
  if p_action='acquire' then
    fresh_token := gen_random_uuid();
    lease_end := clock_timestamp()+interval '10 minutes';
    insert into cali_session_guard.agenda_calendar_leases(event_id,token,acquired_at,lease_until)
      values(p_event_id,fresh_token,clock_timestamp(),lease_end)
      on conflict(event_id) do update set token=excluded.token,
        acquired_at=excluded.acquired_at,lease_until=excluded.lease_until
        where cali_session_guard.agenda_calendar_leases.lease_until<=clock_timestamp()
      returning token,lease_until into fresh_token,lease_end;
    if found then
      return jsonb_build_object('acquired',true,'token',fresh_token,'leaseUntil',lease_end);
    end if;
    select lease_until into lease_end from cali_session_guard.agenda_calendar_leases
      where event_id=p_event_id;
    return jsonb_build_object('acquired',false,'token',null,
      'retryAfterSeconds',case when lease_end is null then 1
        else ceil(greatest(0,extract(epoch from (lease_end-clock_timestamp()))))::integer end);
  end if;

  delete from cali_session_guard.agenda_calendar_leases
    where event_id=p_event_id and token=p_token returning true into released;
  return jsonb_build_object('released',coalesce(released,false));
end;
$$;
revoke all on function cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
