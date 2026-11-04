-- Transições manuais para ciclos existentes das duas empresas de homologação.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_transition_service_cycle(
  p_company_id uuid, p_cycle_id uuid, p_expected_status text, p_next_status text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  company_status text;
  cycle cali_workspace.service_cycles;
begin
  if (case p_expected_status
    when 'planned' then p_next_status = 'open'
    when 'open' then p_next_status = 'review'
    when 'review' then p_next_status = 'closed'
    else false end) is not true then
    raise exception using errcode = '22023', message = 'Transição de ciclo inválida.';
  end if;
  if not exists (select 1 from cali_session_guard.pilot_companies where company_id = p_company_id) then
    raise exception using errcode = '22023', message = 'Empresa fora da homologação.';
  end if;
  perform 1 from cali_v2_onboarding.company_drafts where company_id = p_company_id for share;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa não vinculada ao cadastro V2.';
  end if;
  select c.status::text into strict company_status from cali_workspace.companies c
    where c.id = p_company_id for share;
  select * into cycle from cali_workspace.service_cycles c
    where c.id = p_cycle_id and c.company_id = p_company_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Ciclo indisponível para esta empresa.';
  end if;

  if cycle.status = p_next_status then return cycle.id; end if;
  if cycle.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'Situação do ciclo alterada. Atualize a ficha.';
  end if;
  if p_next_status = 'open' and
    (company_status <> 'active' or coalesce(cycle.contracted_hours, 0) <= 0) then
    raise exception using errcode = '55000', message = 'Empresa ativa e horas do ciclo são obrigatórias.';
  end if;

  update cali_workspace.service_cycles set status = p_next_status
    where id = cycle.id;
  insert into cali_workspace.activity_log (
    company_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    p_company_id, actor, 'v2_service_cycle_transitioned', 'service_cycle', cycle.id,
    jsonb_build_object('reference_month', cycle.reference_month, 'previous_status', p_expected_status,
      'next_status', p_next_status)
  );
  return cycle.id;
end;
$$;
revoke all on function cali_workspace.v2_transition_service_cycle(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_transition_service_cycle(uuid, uuid, text, text)
  to authenticated;
notify pgrst, 'reload schema';
commit;
