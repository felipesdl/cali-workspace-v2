-- Candidata para abertura explícita do ciclo mensal da empresa cadastrada pela V2.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_open_current_service_cycle(p_company_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  company cali_workspace.companies;
  current_month date := date_trunc('month', current_date)::date;
  cycle_id uuid;
begin
  if not exists (
    select 1 from auth.sessions s where s.user_id = actor
      and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'Sessão Admin indisponível.';
  end if;
  perform 1 from cali_v2_onboarding.company_drafts d
    where d.company_id = p_company_id for share;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa não vinculada ao cadastro V2.';
  end if;
  select c.* into company from cali_workspace.companies c
    where c.id = p_company_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa indisponível.';
  end if;

  select c.id into cycle_id from cali_workspace.service_cycles c
    where c.company_id = company.id and c.reference_month = current_month;
  if found then return cycle_id; end if;

  if company.status::text <> 'active' or coalesce(company.monthly_hours_contracted, 0) <= 0 then
    raise exception using errcode = '55000', message = 'Empresa ativa e horas contratadas são obrigatórias.';
  end if;

  insert into cali_workspace.service_cycles (company_id, reference_month, contracted_hours, status)
  values (company.id, current_month, company.monthly_hours_contracted, 'open')
  on conflict on constraint service_cycles_company_id_reference_month_key do nothing
  returning id into cycle_id;
  if not found then
    select c.id into strict cycle_id from cali_workspace.service_cycles c
      where c.company_id = company.id and c.reference_month = current_month;
    return cycle_id;
  end if;
  insert into cali_workspace.activity_log (
    company_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    company.id, actor, 'v2_service_cycle_opened', 'service_cycle', cycle_id,
    jsonb_build_object('reference_month', current_month, 'contracted_hours', company.monthly_hours_contracted)
  );
  return cycle_id;
end;
$$;
revoke all on function cali_workspace.v2_open_current_service_cycle(uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_open_current_service_cycle(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
