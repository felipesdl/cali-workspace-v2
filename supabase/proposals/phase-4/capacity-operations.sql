-- FLOW-07. Registra a decisão mensal de capacidade no mesmo estado usado pelo legado.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_set_pilot_capacity_pause(
  p_company_id uuid,p_month date,p_request_id uuid,p_expected timestamptz,p_paused boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  previous cali_workspace.capacity_pauses%rowtype;
  current_version timestamptz;
  fingerprint bytea;
  saved uuid;
  stamp timestamptz;
begin
  if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1
    or p_request_id is null or p_paused is null then
    raise exception using errcode='22023',message='Confira o mês e a ação.';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array('capacity-pause',p_month,
    extract(epoch from p_expected),p_paused)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-capacity:'||p_company_id::text,0));
  saved := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,fingerprint);
  if saved is not null then return saved; end if;

  select * into previous from cali_workspace.capacity_pauses
    where company_id=p_company_id and month=p_month for update;
  current_version := coalesce(previous.resumed_at,previous.paused_at);
  if current_version is distinct from p_expected
    or (previous.company_id is not null and previous.resumed_at is null)=p_paused then
    raise exception using errcode='40001',message='A situação da pausa mudou.';
  end if;
  if p_paused and not exists(select 1 from cali_workspace.capacity_month(p_company_id,p_month) c
    where c.contracted_minutes>0 and c.used_minutes>c.contracted_minutes) then
    raise exception using errcode='22023',message='A pausa exige capacidade excedida no mês.';
  end if;

  stamp := clock_timestamp();
  if previous.company_id is null then
    insert into cali_workspace.capacity_pauses(company_id,month,paused_at,paused_by)
      values(p_company_id,p_month,stamp,actor) on conflict(company_id,month) do nothing;
    if not found then raise exception using errcode='40001',message='A situação da pausa mudou.'; end if;
  elsif p_paused then
    update cali_workspace.capacity_pauses set paused_at=stamp,paused_by=actor,resumed_at=null,resumed_by=null
      where company_id=p_company_id and month=p_month;
  else
    update cali_workspace.capacity_pauses set resumed_at=stamp,resumed_by=actor
      where company_id=p_company_id and month=p_month;
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,case when p_paused then 'capacity_pause_recorded' else 'capacity_pause_resumed' end,
      'company',p_company_id,jsonb_build_object('month',p_month));
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,fingerprint,p_company_id);
  return p_company_id;
end;
$$;

revoke all on function cali_workspace.v2_set_pilot_capacity_pause(uuid,date,uuid,timestamptz,boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_set_pilot_capacity_pause(uuid,date,uuid,timestamptz,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
