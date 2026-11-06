-- FLOW-12. Prepara e aprova a versão interna. Publicação depende do artefato privado da revisão.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.phase4_report_approvals (
  report_id uuid not null references cali_workspace.reports(id),
  company_id uuid not null,
  version integer not null check (version>0),
  approved_by uuid not null,
  approved_at timestamptz not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  primary key (report_id,version)
);
alter table cali_session_guard.phase4_report_approvals enable row level security;
revoke all on cali_session_guard.phase4_report_approvals from public,anon,authenticated,service_role;

create sequence if not exists cali_session_guard.phase4_executive_protocol maxvalue 999999;
alter table cali_session_guard.phase4_report_approvals
  add column if not exists render_protocol text unique,
  add column if not exists render_nonce uuid,
  add column if not exists render_requested_at timestamptz,
  add column if not exists render_requested_by uuid;

create table if not exists cali_session_guard.phase4_report_pdfs (
  report_id uuid not null,
  version integer not null,
  content bytea not null check (octet_length(content) between 8 and 2097152),
  generated_at timestamptz not null default clock_timestamp(),
  primary key (report_id,version),
  foreign key (report_id,version) references cali_session_guard.phase4_report_approvals(report_id,version)
);
create table if not exists cali_session_guard.phase4_report_releases (
  report_id uuid not null,
  version integer not null,
  released_at timestamptz not null,
  released_by uuid not null,
  requires_ack boolean not null,
  withdrawn_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  primary key (report_id,version),
  foreign key (report_id,version) references cali_session_guard.phase4_report_pdfs(report_id,version)
);
create unique index if not exists phase4_report_one_release
  on cali_session_guard.phase4_report_releases(report_id) where withdrawn_at is null;
alter table cali_session_guard.phase4_report_pdfs enable row level security;
alter table cali_session_guard.phase4_report_releases enable row level security;
revoke all on cali_session_guard.phase4_report_pdfs,cali_session_guard.phase4_report_releases
  from public,anon,authenticated,service_role;
revoke all on sequence cali_session_guard.phase4_executive_protocol from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_create_pilot_report_draft(
  p_company_id uuid,p_report_id uuid,p_month date,p_title text,p_summary text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  month_end date;
  readiness jsonb;
  source_data jsonb;
begin
  if p_report_id is null or p_month is null or not isfinite(p_month) or extract(day from p_month)<>1
    or coalesce(length(btrim(p_title)),0) not between 1 and 180
    or coalesce(length(btrim(p_summary)),0) not between 1 and 8000 then
    raise exception using errcode='22023', message='Confira os dados do relatório.';
  end if;
  month_end := (p_month+interval '1 month'-interval '1 day')::date;
  perform pg_advisory_xact_lock(hashtextextended('phase4-report:'||p_company_id::text||':'||p_month::text,0));
  if exists(select 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.period_start=p_month and r.period_end=month_end and r.title=btrim(p_title)
    and r.executive_summary=btrim(p_summary)) then return p_report_id; end if;

  readiness := cali_workspace.report_generation_readiness_v61(p_company_id,'monthly',p_month,month_end);
  if (readiness->>'can_generate_official')::boolean is distinct from true then
    raise exception using errcode='40001', message='O período não está disponível para geração oficial.';
  end if;
  if exists(select 1 from cali_workspace.reports r where r.company_id=p_company_id
    and r.report_type='monthly' and r.period_start=p_month and r.period_end=month_end and r.status<>'archived') then
    raise exception using errcode='40001', message='Já há um relatório para este período.';
  end if;
  source_data := cali_workspace.build_report_source_snapshot(p_company_id,p_month,month_end);
  if jsonb_typeof(source_data) is distinct from 'object' then
    raise exception using errcode='22023', message='A coleta não retornou um retrato válido.';
  end if;
  insert into cali_workspace.reports(id,company_id,title,reference_month,status,executive_summary,
    report_type,period_start,period_end,source_snapshot,generated_at,data_refreshed_at,version)
  values(p_report_id,p_company_id,btrim(p_title),p_month,'draft',btrim(p_summary),
    'monthly',p_month,month_end,source_data,now(),now(),1);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_draft_created','report',p_report_id,jsonb_build_object('period',p_month));
  return p_report_id;
end;
$$;

create or replace function cali_workspace.v2_update_pilot_report_draft(
  p_company_id uuid,p_report_id uuid,p_expected timestamptz,p_action text,p_summary text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  report_row cali_workspace.reports%rowtype;
  signer jsonb;
begin
  if p_action is null or p_action not in ('edit','review','approve','reopen')
    or (p_action='edit' and coalesce(length(btrim(p_summary)),0) not between 1 and 8000)
    or (p_action='reopen' and coalesce(length(btrim(p_summary)),0) not between 3 and 4000) then
    raise exception using errcode='22023', message='Ação de relatório inválida.';
  end if;
  select * into report_row from cali_workspace.reports r
  where r.company_id=p_company_id and r.id=p_report_id for update;
  if not found or not exists(
    select 1 from cali_workspace.activity_log l where l.entity_id=p_report_id and l.company_id=p_company_id
      and l.entity_type='report' and l.event_type='report_draft_created'
  ) then raise exception using errcode='42501', message='Relatório indisponível.'; end if;
  if report_row.updated_at is distinct from p_expected
    or (p_action='edit' and report_row.status not in ('draft','review'))
    or (p_action='review' and report_row.status<>'draft')
    or (p_action='approve' and report_row.status<>'review')
    or (p_action='reopen' and (report_row.status<>'approved' or not exists(
      select 1 from cali_session_guard.phase4_report_approvals a where a.report_id=p_report_id
        and a.company_id=p_company_id and a.version=report_row.version)))
    or report_row.published_at is not null or report_row.sent_at is not null then
    raise exception using errcode='40001', message='O relatório mudou de versão ou estado.';
  end if;

  case p_action
    when 'edit' then update cali_workspace.reports set executive_summary=btrim(p_summary),updated_at=now() where id=p_report_id;
    when 'review' then update cali_workspace.reports set status='review',review_started_at=now(),updated_at=now() where id=p_report_id;
    when 'approve' then
      if jsonb_typeof(report_row.source_snapshot) is distinct from 'object'
        or coalesce(length(btrim(report_row.executive_summary)),0)=0 then
        raise exception using errcode='22023',message='O relatório precisa de coleta e resumo executivo.';
      end if;
      signer := cali_workspace.profile_signer_snapshot();
      if nullif(btrim(signer->>'full_name'),'') is null or nullif(btrim(signer->>'avatar_url'),'') is null then
        raise exception using errcode='P4R01',message='Confira a assinatura e a foto configuradas da CALI.';
      end if;
      update cali_workspace.reports set status='approved',approved_at=clock_timestamp(),approved_by=actor,
        updated_at=clock_timestamp() where id=p_report_id returning * into report_row;
      insert into cali_session_guard.phase4_report_approvals(report_id,company_id,version,approved_by,approved_at,snapshot)
      values(p_report_id,p_company_id,coalesce(report_row.version,1),actor,report_row.approved_at,
        jsonb_build_object('reportId',p_report_id,'companyId',p_company_id,'title',report_row.title,
          'protocol',report_row.protocol,'companyName',(select display_name from cali_workspace.companies where id=p_company_id),'periodStart',report_row.period_start,'periodEnd',report_row.period_end,
          'summary',report_row.executive_summary,'source',report_row.source_snapshot,
          'signer',jsonb_build_object('full_name',signer->>'full_name','job_title',signer->>'job_title',
            'avatar_url',signer->>'avatar_url','signature_mode',signer->>'signature_mode',
            'signature_url',signer->>'signature_url','signature_style',signer->>'signature_style')));
    when 'reopen' then
      update cali_session_guard.phase4_report_releases set withdrawn_at=clock_timestamp()
      where report_id=p_report_id and version=report_row.version and withdrawn_at is null;
      update cali_workspace.reports set status='draft',version=report_row.version+1,approved_at=null,
        approved_by=null,review_started_at=null,updated_at=clock_timestamp() where id=p_report_id;
  end case;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_'||p_action,'report',p_report_id,
    case when p_action='reopen' then jsonb_build_object('previousVersion',report_row.version,
      'version',report_row.version+1,'reason',btrim(p_summary))
    else jsonb_build_object('version',report_row.version) end);
  return p_report_id;
end;
$$;

create or replace function cali_workspace.v2_list_pilot_report_approvals(p_company_id uuid,p_report_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by version desc),'[]'::jsonb) from (
      select a.version,a.approved_at as "approvedAt",coalesce(a.render_protocol,a.snapshot->>'protocol') as protocol,
        exists(select 1 from cali_session_guard.phase4_report_pdfs p where p.report_id=a.report_id and p.version=a.version) as "pdfReady"
      from cali_session_guard.phase4_report_approvals a
      where a.company_id=p_company_id and a.report_id=p_report_id
      order by version desc limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

revoke all on function cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text),
  cali_workspace.v2_update_pilot_report_draft(uuid,uuid,timestamptz,text,text),
  cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text),
  cali_workspace.v2_update_pilot_report_draft(uuid,uuid,timestamptz,text,text),
  cali_workspace.v2_list_pilot_report_approvals(uuid,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
