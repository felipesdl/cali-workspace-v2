-- FLOW-18. Consulta administrativa de preparação, sem exportar nem eliminar dados.
begin;
set local lock_timeout='5s';
create function cali_workspace.v2_read_pilot_data_lifecycle(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  result jsonb;
begin
  select jsonb_build_object(
    'companyId',c.id,'status',c.status,'accessClosed',cali_workspace.company_access_closed(c.id),
    'closedAt',c.closed_at,'eliminatedAt',c.data_eliminated_at,
    'waitingPeriodMet',cali_workspace.company_elimination_ready(c.id)
  ) into result
  from cali_workspace.companies c where c.id=p_company_id;
  if result is null then
    raise exception using errcode='42501',message='Ciclo de dados indisponível.';
  end if;
  return result;
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_data_lifecycle(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_data_lifecycle(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
