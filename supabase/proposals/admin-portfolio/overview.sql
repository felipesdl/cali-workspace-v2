-- Candidata de leitura da Visão geral Admin. Aplicar somente após reconciliar o catálogo do destino.
begin;
set local lock_timeout = '5s';

create or replace function cali_workspace.v2_read_admin_overview(p_company_id uuid, p_month date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_actor uuid := cali_session_guard.require_pilot_admin_session();
  v_next_month date;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from cali_workspace.profiles p where p.id = v_actor and p.active and p.role = 'admin')
     or (cali_workspace.v2_read_terms_state() ->> 'accepted') is distinct from 'true' then
    raise exception using errcode = '42501', message = 'Visão geral indisponível.';
  end if;
  if p_month is null or not isfinite(p_month) or p_month not between date '1900-01-01' and date '9999-12-01'
     or extract(day from p_month) <> 1 then
    raise exception using errcode = '22023', message = 'Mês de referência inválido.';
  end if;
  if p_company_id is not null and not exists (select 1 from cali_workspace.companies where id = p_company_id) then
    raise exception using errcode = '42501', message = 'Conta indisponível.';
  end if;
  v_next_month := (p_month + interval '1 month')::date;

  return (
    with accounts as (
      select id, display_name, status, monthly_hours_contracted from cali_workspace.companies
      where p_company_id is null or id = p_company_id
    ), month_hours as (
      select h.company_id, sum(h.minutes) as minutes from cali_workspace.hour_entries h
      join accounts a on a.id = h.company_id
      where h.work_date >= p_month and h.work_date < v_next_month
      group by h.company_id
    ), consumption as (
      select a.id, a.display_name, coalesce(h.minutes, 0) as minutes,
             round(coalesce(sc.contracted_hours, a.monthly_hours_contracted, 0) * 60)::integer as contracted
      from accounts a
      left join month_hours h on h.company_id = a.id
      left join lateral (
        select s.contracted_hours from cali_workspace.service_cycles s
        where s.company_id = a.id and s.reference_month >= p_month and s.reference_month < v_next_month
        order by s.created_at desc, s.id desc limit 1
      ) sc on true
      where h.company_id is not null or a.status in ('active', 'paused')
    ), actions as (
      select p.id, p.company_id, p.name as title, 'project'::text as kind, p.updated_at
      from cali_workspace.projects p join accounts a on a.id = p.company_id and a.status in ('active', 'paused')
      where p.planning_status = 'adjustment_requested' and p.execution_status = 'normal'
      union all
      select r.id, r.company_id, r.title, 'record'::text, r.updated_at
      from cali_workspace.account_records r join accounts a on a.id = r.company_id and a.status in ('active', 'paused')
      where r.workflow_status = 'in_progress'
    ), next_events as (
      select e.id, e.company_id, e.title, e.starts_at
      from cali_workspace.events e join accounts a on a.id = e.company_id
      where e.cancelled_at is null and e.starts_at >= now() and e.starts_at < now() + interval '15 days'
      order by e.starts_at, e.id limit 8
    ), deliveries as (
      select d.id, d.company_id, d.project_id, d.title, d.status,
             (d.due_at at time zone 'America/Sao_Paulo')::date as due_on
      from cali_workspace.deliverables d join accounts a on a.id = d.company_id
      where d.status <> 'cancelled'
    ), feedback as (
      select f.score from cali_workspace.account_record_feedback f
      join accounts a on a.id = f.company_id
      join cali_workspace.account_records r on r.id = f.record_id and r.company_id = a.id
      where f.score between 1 and 5
      union all
      select n.score from cali_workspace.nps_responses n join accounts a on a.id = n.company_id
      where n.score between 1 and 5
    )
    select jsonb_build_object(
      'companyId', p_company_id,
      'month', p_month,
      'activeAccounts', (select count(*) from accounts where status = 'active'),
      'pendingActions', (select count(*) from actions),
      'hoursMinutes', (select coalesce(sum(minutes), 0) from consumption),
      'contractedMinutes', (select coalesce(sum(contracted), 0) from consumption),
      'hoursByCompany', coalesce((select jsonb_agg(jsonb_build_object(
        'companyId', id, 'name', display_name, 'minutes', minutes, 'contractedMinutes', contracted
      ) order by minutes desc, display_name, id) from (
        select * from consumption order by minutes desc, display_name, id limit 20
      ) c), '[]'::jsonb),
      'priorities', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'companyId', company_id, 'title', title, 'kind', kind
      ) order by updated_at desc, kind, id) from (
        select * from actions order by updated_at desc, kind, id limit 8
      ) a), '[]'::jsonb),
      'agenda', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'companyId', company_id, 'title', title, 'startsAt', starts_at
      ) order by starts_at, id) from next_events), '[]'::jsonb),
      'deliverables', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'total', total) order by status)
        from (select status, count(*) as total from deliveries group by status) d), '[]'::jsonb),
      'deadlines', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'companyId', company_id, 'projectId', project_id, 'title', title, 'dueOn', due_on
      ) order by due_on, id) from (
        select * from deliveries where due_on >= v_today and due_on < v_today + 15 and status <> 'approved'
        order by due_on, id limit 8
      ) d), '[]'::jsonb),
      'satisfaction', jsonb_build_object(
        'average', (select round(avg(score)::numeric, 2) from feedback),
        'total', (select count(*) from feedback),
        'distribution', (select jsonb_agg(jsonb_build_object('score', score, 'total', total) order by score)
          from (select s.score, count(f.score) as total from generate_series(1, 5) s(score)
                left join feedback f using (score) group by s.score) d)
      )
    )
  );
end;
$$;

revoke all on function cali_workspace.v2_read_admin_overview(uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_read_admin_overview(uuid, date) to authenticated;
notify pgrst, 'reload schema';
commit;
