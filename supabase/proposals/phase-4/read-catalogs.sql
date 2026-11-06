-- FLOW-09/10/11/12/13/18. Catálogos da empresa piloto, sem efeitos externos.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_read_pilot_catalog(
  p_company_id uuid, p_module text, p_month date, p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000
    or p_module is null or p_module not in ('calendar','records','documents','notices','reports','fronts')
    or (p_module='calendar' and (p_month is null or not isfinite(p_month) or extract(day from p_month)<>1)) then
    raise exception using errcode='22023', message='Filtros de consulta inválidos.';
  end if;
  return (
    with matched as (
      select e.id,e.title,e.protocol,
        case when e.cancelled_at is null then e.event_type else 'cancelled' end as status,
        e.starts_at as instant,null::date as day,null::text as summary
      from cali_workspace.events e
      where p_module='calendar' and e.company_id=p_company_id
        and e.starts_at < ((p_month+interval '1 month') at time zone 'America/Sao_Paulo')
        and (e.starts_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
          or e.ends_at > (p_month::timestamp at time zone 'America/Sao_Paulo'))
        and (admin or (e.visibility='client' and e.cancelled_at is null))
      union all
      select r.id,r.title,r.protocol,r.workflow_status,r.occurred_at,null::date,null::text
      from cali_workspace.account_records r
      where p_module='records' and r.company_id=p_company_id and (admin or r.visibility='client')
      union all
      select f.id,f.title,f.protocol,f.status,f.published_at,null::date,null::text
      from cali_workspace.files f
      where p_module='documents' and f.company_id=p_company_id
        and (admin or (f.status='published' and f.client_visible
          and (f.deliverable_id is null or cali_workspace.client_can_view_deliverable(f.deliverable_id))))
      union all
      select n.id,n.title,n.protocol,n.status,n.published_at,n.notice_date,n.body
      from cali_workspace.notices n
      where p_module='notices' and (n.audience='all' or exists(
        select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id=p_company_id
      )) and (admin or cali_workspace.can_read_notice(n.id))
      union all
      select r.id,r.title,r.protocol,r.status,r.published_at,r.period_start,r.executive_summary
      from cali_workspace.reports r
      where p_module='reports' and r.company_id=p_company_id and (admin or r.status in ('sent','published'))
      union all
      select f.id,coalesce(nullif(f.scope_label,''),f.front_code),null::text,f.status,null::timestamptz,
        f.started_at,null::text
      from cali_workspace.company_fronts f
      where p_module='fronts' and f.company_id=p_company_id and (admin or f.status='active')
    ), page as (
      select * from matched order by instant desc nulls last,day desc nulls last,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object(
      'companyId',p_company_id,'module',p_module,'month',p_month,'total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(page) order by instant desc nulls last,day desc nulls last,id) from page),'[]'::jsonb)
    )
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_catalog(uuid,text,date,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_catalog(uuid,text,date,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
