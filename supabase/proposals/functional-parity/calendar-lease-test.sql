begin;
do $$
declare
  first_claim jsonb;
  busy_claim jsonb;
  wrong_release jsonb;
  second_claim jsonb;
  stale_release jsonb;
  final_release jsonb;
  fixture_event_id constant uuid := '10000000-0000-4000-8000-000000000005';
begin
  if has_function_privilege('anon','cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)','execute')
    or has_function_privilege('authenticated','cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)','execute')
    or not has_function_privilege('service_role','cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)','execute') then
    raise exception 'Lease RPC grants diverged from service-only contract';
  end if;
  execute 'set local role service_role';
  first_claim:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'acquire',null);
  if first_claim->>'acquired'<>'true' or first_claim->>'token' is null then
    raise exception 'First acquire failed: %',first_claim;
  end if;
  busy_claim:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'acquire',null);
  if busy_claim->>'acquired'<>'false' or (busy_claim->>'retryAfterSeconds')::integer<=0 then
    raise exception 'Active lease was not reported busy: %',busy_claim;
  end if;
  wrong_release:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'release',gen_random_uuid());
  if wrong_release->>'released'<>'false' then
    raise exception 'Release accepted wrong token: %',wrong_release;
  end if;
  execute 'reset role';
  update cali_session_guard.agenda_calendar_leases
    set lease_until=clock_timestamp()-interval '1 second' where event_id=fixture_event_id;
  execute 'set local role service_role';
  second_claim:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'acquire',null);
  if second_claim->>'acquired'<>'true' or second_claim->>'token'=first_claim->>'token' then
    raise exception 'Expired lease was not fenced by new token: %',second_claim;
  end if;
  stale_release:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'release',(first_claim->>'token')::uuid);
  if stale_release->>'released'<>'false' then
    raise exception 'Stale owner released replacement lease: %',stale_release;
  end if;
  final_release:=cali_workspace.v2_agenda_calendar_lease(fixture_event_id,'release',(second_claim->>'token')::uuid);
  if final_release->>'released'<>'true' then
    raise exception 'Current owner could not release lease: %',final_release;
  end if;
  execute 'reset role';
end;
$$;
rollback;
