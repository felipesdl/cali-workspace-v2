-- Depende do timer (guarda por módulo). Escopo inicial por registro sintético inscrito.
create or replace function cali_workspace.v2_read_partner_pilot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  terms record;
begin
  if invite.id is null then return jsonb_build_object('status','blocked'); end if;
  if not cali_session_guard.phase5_partner_mfa() then return jsonb_build_object('status','mfa_required'); end if;
  if invite.accepted_at is null then return jsonb_build_object('status','invite_required'); end if;
  select p.version,p.content_hash into terms from cali_v2_terms.publications p where p.is_current;
  if not found then return jsonb_build_object('status','terms_unavailable'); end if;
  if not exists(select 1 from cali_session_guard.phase5_partner_terms t
    where t.user_id=invite.target_user_id and t.version=terms.version and t.content_hash=terms.content_hash) then
    return jsonb_build_object('status','terms_required','version',terms.version,'contentHash',terms.content_hash);
  end if;
  return (
    select jsonb_build_object('status','ready','actor',invite.target_user_id,'company',c.id,'companyName',c.display_name,
      'modules',to_jsonb(array(select module from unnest(m.modules) module where module in ('projects','records','hours','calendar','documents','reports','notices','team'))))
    from cali_workspace.companies c cross join cali_workspace.staff_members m
    where c.id=invite.company_id and m.id=invite.member_id
  );
end;
$$;

create table if not exists cali_session_guard.phase5_partner_catalog_scope (
  company_id uuid not null,
  module text not null check(module in ('calendar','documents','reports','notices','team')),
  item_id uuid not null,
  primary key(company_id,module,item_id)
);
alter table cali_session_guard.phase5_partner_catalog_scope enable row level security;
revoke all on cali_session_guard.phase5_partner_catalog_scope from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_list_partner_pilot_catalog(p_company uuid,p_module text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb:=cali_session_guard.require_phase5_partner(p_company,p_module);
begin
  if p_page is null or p_page not between 1 and 10000 or
    p_module not in ('calendar','documents','reports','notices','team') then
    raise exception using errcode='22023',message='Consulta inválida.';
  end if;
  return (
    with scope as (
      select item_id from cali_session_guard.phase5_partner_catalog_scope
      where company_id=p_company and module=p_module
    ), matched as (
      select e.id,e.title,e.protocol,e.event_type as status,
        (e.starts_at at time zone 'America/Sao_Paulo')::date as day,e.starts_at as instant,null::text as summary
      from cali_workspace.events e join scope s on s.item_id=e.id
      where p_module='calendar' and e.company_id=p_company and e.staff_visible and e.cancelled_at is null
      union all
      select f.id,f.title,f.protocol,f.status,(f.published_at at time zone 'America/Sao_Paulo')::date,null::timestamptz,null::text
      from cali_workspace.files f join scope s on s.item_id=f.id
      where p_module='documents' and f.company_id=p_company and f.status='published' and f.client_visible
      union all
      select r.id,r.title,r.protocol,r.status,r.period_end,null::timestamptz,null::text
      from cali_workspace.reports r join scope s on s.item_id=r.id
      where p_module='reports' and r.company_id=p_company and r.withdrawn_at is null and (
        r.status in ('sent','published') or (
          r.status='approved' and r.published_at is null and r.sent_at is null and exists(
            select 1 from cali_session_guard.phase4_report_releases x
            where x.report_id=r.id and x.version=r.version and x.withdrawn_at is null
          )
        )
      )
      union all
      select n.id,n.title,n.protocol,n.category,n.notice_date,null::timestamptz,n.body
      from cali_workspace.notices n join scope s on s.item_id=n.id
      where p_module='notices' and n.status='published' and (
        n.audience='all' or exists(select 1 from cali_workspace.notice_targets t
          where t.notice_id=n.id and t.company_id=p_company)
      )
      union all
      select m.id,m.full_name,null::text,null::text,null::date,null::timestamptz,
        nullif(concat_ws(' · ',nullif(m.job_title,''),nullif(m.department,'')),'')
      from cali_workspace.team_members m join scope s on s.item_id=m.id
      where p_module='team' and m.company_id=p_company and m.archived_at is null and m.status='active'
    ), page as (
      select m.*,null::integer as minutes,(
        select r.version from cali_workspace.reports r
        join cali_session_guard.phase4_report_releases x on x.report_id=r.id and x.version=r.version and x.withdrawn_at is null
        where p_module='reports' and r.id=m.id and r.company_id=p_company and r.status='approved'
          and r.published_at is null and r.sent_at is null and r.withdrawn_at is null
      ) as "downloadVersion" from matched m order by day desc nulls last,instant desc nulls last,title,id
      limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((
      select jsonb_agg(to_jsonb(page) order by day desc nulls last,instant desc nulls last,title,id) from page
    ),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_list_partner_pilot_catalog(uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_partner_pilot_catalog(uuid,text,integer) to authenticated;
