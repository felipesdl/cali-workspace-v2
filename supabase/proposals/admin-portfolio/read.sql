-- FLOW-04. Resumo global Admin, sem projeção de registros individuais.
begin;
set local lock_timeout = '5s';

create or replace function cali_workspace.v2_read_admin_portfolio(p_month date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  v_next_month date;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_satisfaction jsonb;
begin
  if not exists (select 1 from cali_workspace.profiles p
       where p.id = actor and p.active and p.role = 'admin')
     or (cali_workspace.v2_read_terms_state() ->> 'accepted') is distinct from 'true' then
    raise exception using errcode = '42501', message = 'Resumo da carteira indisponível.';
  end if;
  if p_month is null or not isfinite(p_month) or p_month not between date '1900-01-01' and date '9999-12-01'
     or extract(day from p_month) <> 1 then
    raise exception using errcode = '22023', message = 'Mês de referência inválido.';
  end if;

  v_next_month := (p_month + interval '1 month')::date;
  v_month_start := p_month::timestamp at time zone 'America/Sao_Paulo';
  v_month_end := v_next_month::timestamp at time zone 'America/Sao_Paulo';
  v_satisfaction := cali_workspace.get_admin_satisfaction_overview();

  return jsonb_build_object(
    'month', p_month,
    'hoursMinutes', (
      select coalesce(sum(h.minutes), 0)
      from cali_workspace.hour_entries h
      join cali_workspace.companies c on c.id = h.company_id
      where h.work_date >= p_month and h.work_date < v_next_month
    ),
    'calendarEvents', (
      select count(*) from cali_workspace.events e
      where e.cancelled_at is null and e.starts_at < v_month_end
        and (e.starts_at >= v_month_start or e.ends_at > v_month_start)
    ),
    'calendarNotices', (
      select count(*) from cali_workspace.notices n
      where n.status = 'published' and n.notice_date >= p_month and n.notice_date < v_next_month
        and (n.audience = 'all' or exists (
          select 1 from cali_workspace.notice_targets t
          join cali_workspace.companies c on c.id = t.company_id
          where t.notice_id = n.id
        ))
    ),
    'projectAdjustments', (
      select count(*) from cali_workspace.projects p
      join cali_workspace.companies c on c.id = p.company_id and c.status in ('active', 'paused')
      where p.planning_status = 'adjustment_requested' and p.execution_status = 'normal'
    ),
    'recordsInProgress', (
      select count(*) from cali_workspace.account_records r
      join cali_workspace.companies c on c.id = r.company_id and c.status in ('active', 'paused')
      where r.workflow_status = 'in_progress'
    ),
    'satisfactionAverage', v_satisfaction -> 'average',
    'satisfactionCount', v_satisfaction -> 'total'
  );
end;
$$;

revoke all on function cali_workspace.v2_read_admin_portfolio(date)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_read_admin_portfolio(date) to authenticated;
notify pgrst, 'reload schema';
commit;
