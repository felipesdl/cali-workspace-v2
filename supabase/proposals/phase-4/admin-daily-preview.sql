-- RESUMO-01/DEC-19. Prévia de leitura; não configura cron, destinatários ou envio.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_build_admin_daily_preview(p_instant timestamptz)
returns jsonb language sql stable set search_path=''
as $$
with period as (
  select (p_instant at time zone 'America/Sao_Paulo')::date as day
), bounds as (
  select day,day::timestamp at time zone 'America/Sao_Paulo' as starts_at,
    (day+1)::timestamp at time zone 'America/Sao_Paulo' as ends_at from period
), eligible as (
  select n.id,n.company_id,n.created_at,n.title,n.body,n.entity_type,n.entity_id,n.action_url,
    case p.role::text when 'admin' then 'client' else 'cali' end as block
  from cali_workspace.notifications n
  join cali_session_guard.pilot_companies pilot on pilot.company_id=n.company_id
  join cali_workspace.profiles p on p.id=n.user_id
  cross join bounds b
  where n.created_at>=b.starts_at and n.created_at<b.ends_at and n.created_at<=p_instant
    and (
      (p.role::text='admin' and n.notification_type in (
        'client_task_adjustment_requested','client_task_approved','deliverable_status','nps','project_schedule_adjustment',
        'project_schedule_approved','record_feedback','record_reopen_request','review_response',
        'scheduling_confirmed','scheduling_request'
      ))
      or (p.role::text='client' and p.company_id=n.company_id and n.notification_type in (
        'client_dependency','deliverable_due_revision','deliverable_status','project_schedule_review',
        'project_schedule_adjustment_resolution','record_reopen_decision','record_status','review_request',
        'scheduling_response','task_client_review'
      ))
    )
  union all
  select md5('report-release:'||r.id::text||':'||release.version::text)::uuid,
    r.company_id,release.released_at,'Relatório liberado',r.title,'report',r.id,
    '/admin/relatorios?companyId='||r.company_id::text,'cali'
  from cali_session_guard.phase4_report_releases release
  join cali_workspace.reports r on r.id=release.report_id
  join cali_session_guard.pilot_companies pilot on pilot.company_id=r.company_id
  cross join bounds b
  where release.released_at>=b.starts_at and release.released_at<b.ends_at and release.released_at<=p_instant
    and (release.withdrawn_at is null or release.withdrawn_at>p_instant)
), deduplicated as (
  select distinct on (company_id,block,title,body,entity_type,entity_id) *
  from eligible
  order by company_id,block,title,body,entity_type,entity_id,created_at desc,id desc
), ranked as (
  select *,row_number() over(partition by company_id,block order by created_at desc,id desc) as position
  from deduplicated
), blocks as (
  select company_id,block,count(*) as total,
    jsonb_agg(jsonb_build_object('id',id,'at',created_at,'title',title,'excerpt',left(body,180),
      'link',case when action_url ~ '^/(admin|cliente)/[A-Za-z0-9/_?&=.%:-]+$' then action_url end)
      order by position) filter(where position<=12) as items
  from ranked group by company_id,block
), hours as (
  select h.company_id,sum(h.minutes) as minutes
  from cali_workspace.hour_entries h
  join cali_session_guard.pilot_companies pilot on pilot.company_id=h.company_id
  cross join bounds b where h.work_date=b.day group by h.company_id
), companies as (
  select c.id,c.display_name,coalesce(a.total,0) as client_total,coalesce(w.total,0) as cali_total,
    coalesce(h.minutes,0) as minutes,coalesce(a.items,'[]'::jsonb) as client_items,coalesce(w.items,'[]'::jsonb) as cali_items
  from cali_workspace.companies c join cali_session_guard.pilot_companies pilot on pilot.company_id=c.id
  left join blocks a on a.company_id=c.id and a.block='client'
  left join blocks w on w.company_id=c.id and w.block='cali'
  left join hours h on h.company_id=c.id
  where a.company_id is not null or w.company_id is not null or h.minutes>0
)
select jsonb_build_object('day',(select day from bounds),'asOf',p_instant,
  'clientTotal',coalesce(sum(client_total),0),'caliTotal',coalesce(sum(cali_total),0),'minutes',coalesce(sum(minutes),0),
  'companies',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',display_name,'minutes',minutes,
    'client',jsonb_build_object('total',client_total,'items',client_items),
    'cali',jsonb_build_object('total',cali_total,'items',cali_items)
  ) order by client_total+cali_total desc,display_name,id),'[]'::jsonb))
from companies;
$$;

create or replace function cali_workspace.v2_read_pilot_admin_daily_preview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  company uuid := (select p.company_id from cali_session_guard.pilot_companies p order by p.company_id limit 1);
  actor uuid;
begin
  if company is null then raise exception using errcode='42501',message='Resumo indisponível.'; end if;
  actor:=cali_session_guard.require_phase4_role(company,'admin');
  return cali_session_guard.phase4_build_admin_daily_preview(now());
end;
$$;

revoke all on function cali_session_guard.phase4_build_admin_daily_preview(timestamptz) from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_read_pilot_admin_daily_preview() from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_admin_daily_preview() to authenticated;
notify pgrst,'reload schema';
commit;
