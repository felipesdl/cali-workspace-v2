-- FLOW-12. Geração no servidor e liberação no app, sem fila de e-mail legada.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_prepare_pilot_report_pdf(
  p_company_id uuid,p_report_id uuid,p_version integer
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  approval cali_session_guard.phase4_report_approvals%rowtype;
  source jsonb;
  metrics jsonb;
begin
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.version=p_version and r.status='approved' and r.published_at is null and r.sent_at is null for update;
  if not found then raise exception using errcode='40001',message='A revisão não está aprovada.'; end if;
  if exists(select 1 from cali_session_guard.phase4_report_pdfs p where p.report_id=p_report_id and p.version=p_version)
    then return null; end if;
  update cali_session_guard.phase4_report_approvals a set
    render_nonce=gen_random_uuid(),render_requested_by=actor,render_requested_at=clock_timestamp(),
    render_protocol=coalesce(a.render_protocol,'CALI-EXEC-'||
      to_char(a.approved_at at time zone 'America/Sao_Paulo','YYYY')||'-'||
      lpad(nextval('cali_session_guard.phase4_executive_protocol')::text,6,'0'))
  where a.report_id=p_report_id and a.company_id=p_company_id and a.version=p_version
  returning a.* into approval;
  if not found then raise exception using errcode='42501',message='Aprovação indisponível.'; end if;
  source := approval.snapshot->'source';
  metrics := jsonb_build_object(
    'hours',jsonb_build_object('contractedHours',source#>'{hours,contractedHours}',
      'consumedMinutes',source#>'{hours,consumedMinutes}'),
    'deliverables',jsonb_build_object('approvedCount',source#>'{deliverables,approvedCount}',
      'createdCount',source#>'{deliverables,createdCount}'));
  if source ? 'workflow_mode' then
    metrics := metrics||jsonb_build_object('workflow_mode',source->'workflow_mode');
  end if;
  if jsonb_typeof(source->'feedback')='object' then
    metrics := metrics||jsonb_build_object('feedback',jsonb_build_object(
      'count',source#>'{feedback,count}','average',source#>'{feedback,average}'));
  end if;
  return jsonb_build_object('ticket',approval.render_nonce,
    'input',approval.snapshot||jsonb_build_object('protocol',approval.render_protocol,
      'version',approval.version,'approvedAt',approval.approved_at,'source',metrics));
end;
$$;

create or replace function cali_workspace.v2_store_generated_pilot_report_pdf(
  p_company_id uuid,p_report_id uuid,p_version integer,p_ticket uuid,p_pdf_base64 text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  approval cali_session_guard.phase4_report_approvals%rowtype;
  bytes bytea;
begin
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.version=p_version and r.status='approved' and r.published_at is null and r.sent_at is null for update;
  if not found then raise exception using errcode='40001',message='A revisão mudou.'; end if;
  select * into approval from cali_session_guard.phase4_report_approvals a
  where a.report_id=p_report_id and a.company_id=p_company_id and a.version=p_version
    and a.render_nonce=p_ticket and a.render_requested_at>=clock_timestamp()-interval '2 minutes';
  if not found then raise exception using errcode='42501',message='Geração indisponível.'; end if;
  if coalesce(length(p_pdf_base64),0) not between 12 and 2796204 then
    raise exception using errcode='22023',message='PDF inválido.';
  end if;
  bytes := decode(p_pdf_base64,'base64');
  if octet_length(bytes) not between 8 and 2097152 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
    raise exception using errcode='22023',message='PDF inválido.';
  end if;
  insert into cali_session_guard.phase4_report_pdfs(report_id,version,content)
  values(p_report_id,p_version,bytes);
  update cali_session_guard.phase4_report_approvals set render_nonce=null
  where report_id=p_report_id and version=p_version;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,approval.render_requested_by,'report_pdf_generated','report',p_report_id,
    jsonb_build_object('version',p_version,'protocol',approval.render_protocol,'sha256',encode(sha256(bytes),'hex')));
  return p_report_id;
end;
$$;

create or replace function cali_workspace.v2_release_pilot_report(
  p_company_id uuid,p_report_id uuid,p_version integer,p_request_ack boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  first_release boolean;
  must_ack boolean;
  previous boolean;
begin
  if p_request_ack is null then raise exception using errcode='22023',message='Informe a condição de ciência.'; end if;
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.version=p_version and r.status='approved' and r.published_at is null and r.sent_at is null for update;
  if not found then raise exception using errcode='40001',message='A revisão mudou.'; end if;
  if not exists(select 1 from cali_session_guard.phase4_report_pdfs p where p.report_id=p_report_id and p.version=p_version) then
    raise exception using errcode='P4R02',message='Gere o PDF desta revisão antes de publicar.';
  end if;
  first_release := not exists(select 1 from cali_session_guard.phase4_report_releases x
    where x.report_id=p_report_id and x.version<>p_version);
  must_ack := first_release or p_request_ack;
  select x.requires_ack into previous from cali_session_guard.phase4_report_releases x
  where x.report_id=p_report_id and x.version=p_version and x.withdrawn_at is null;
  if found then
    if previous=must_ack then return p_report_id; end if;
    raise exception using errcode='40001',message='Esta revisão já foi publicada.';
  end if;
  insert into cali_session_guard.phase4_report_releases(report_id,version,released_at,released_by,requires_ack)
  values(p_report_id,p_version,clock_timestamp(),actor,must_ack);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_released_in_app','report',p_report_id,
    jsonb_build_object('version',p_version,'requiresAck',must_ack));
  return p_report_id;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_report_pdf(
  p_company_id uuid,p_report_id uuid,p_version integer
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  payload jsonb;
begin
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and (admin or (r.version=p_version and r.status='approved' and r.published_at is null and r.sent_at is null))
  for share;
  if not found then raise exception using errcode='42501',message='PDF indisponível.'; end if;
  select jsonb_build_object('id',p.report_id,'version',p.version,'fileName',a.render_protocol||'.pdf',
    'content',encode(p.content,'base64'),'sha256',encode(sha256(p.content),'hex')) into payload
  from cali_session_guard.phase4_report_pdfs p
  join cali_session_guard.phase4_report_approvals a using(report_id,version)
  where p.report_id=p_report_id and p.version=p_version and a.company_id=p_company_id
    and (admin or exists(select 1 from cali_session_guard.phase4_report_releases x
      where x.report_id=p_report_id and x.version=p_version and x.withdrawn_at is null));
  if not found then raise exception using errcode='42501',message='PDF indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

create or replace function cali_workspace.v2_ack_pilot_report_release(
  p_company_id uuid,p_report_id uuid,p_version integer
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  acknowledgment timestamptz;
begin
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.version=p_version and r.status='approved' and r.published_at is null and r.sent_at is null for update;
  if not found then raise exception using errcode='42501',message='Ciência indisponível.'; end if;
  select x.acknowledged_at into acknowledgment from cali_session_guard.phase4_report_releases x
  where x.report_id=p_report_id and x.version=p_version and x.withdrawn_at is null and x.requires_ack;
  if not found then raise exception using errcode='42501',message='Ciência indisponível.'; end if;
  if acknowledgment is not null then return p_report_id; end if;
  update cali_session_guard.phase4_report_releases set acknowledged_by=actor,acknowledged_at=clock_timestamp()
  where report_id=p_report_id and version=p_version;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_release_acknowledged','report',p_report_id,jsonb_build_object('version',p_version));
  return p_report_id;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_report_catalog(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select r.id,coalesce(a.snapshot->>'title',r.title) as title,
        coalesce(a.render_protocol,r.protocol) as protocol,
        case when x.report_id is not null then 'published' else r.status end as status,
        coalesce(x.released_at,r.published_at) as instant,r.period_start as day,
        coalesce(a.snapshot->>'summary',r.executive_summary) as summary,
        case when x.report_id is not null then x.requires_ack and x.acknowledged_at is null
          else r.status in ('sent','published') and r.revision_parent_id is null
            and coalesce(r.version,1)=1 and r.acknowledged_at is null end as "acknowledgmentAvailable",
        case when admin then r.updated_at end as "reportUpdatedAt",
        case when a.report_id is not null then r.version end as "reportVersion",
        p.report_id is not null as "reportPdfReady",
        exists(select 1 from cali_session_guard.phase4_report_releases prev where prev.report_id=r.id and prev.version<>r.version)
          as "reportPreviouslyReleased"
      from cali_workspace.reports r
      left join cali_session_guard.phase4_report_approvals a on a.report_id=r.id and a.version=r.version
        and a.company_id=r.company_id and r.status='approved' and r.published_at is null and r.sent_at is null
      left join cali_session_guard.phase4_report_pdfs p on p.report_id=a.report_id and p.version=a.version
      left join cali_session_guard.phase4_report_releases x on x.report_id=p.report_id and x.version=p.version
        and x.withdrawn_at is null
      where r.company_id=p_company_id and (admin or r.status in ('sent','published') or x.report_id is not null)
    ), page as (
      select * from matched order by instant desc nulls last,day desc nulls last,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'module','reports','month',null,'total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(page) order by instant desc nulls last,day desc nulls last,id) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_prepare_pilot_report_pdf(uuid,uuid,integer),
  cali_workspace.v2_store_generated_pilot_report_pdf(uuid,uuid,integer,uuid,text),
  cali_workspace.v2_release_pilot_report(uuid,uuid,integer,boolean),
  cali_workspace.v2_read_pilot_report_pdf(uuid,uuid,integer),
  cali_workspace.v2_ack_pilot_report_release(uuid,uuid,integer),
  cali_workspace.v2_read_pilot_report_catalog(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_store_generated_pilot_report_pdf(uuid,uuid,integer,uuid,text) to service_role;
grant execute on function cali_workspace.v2_prepare_pilot_report_pdf(uuid,uuid,integer),
  cali_workspace.v2_release_pilot_report(uuid,uuid,integer,boolean),
  cali_workspace.v2_read_pilot_report_pdf(uuid,uuid,integer),
  cali_workspace.v2_ack_pilot_report_release(uuid,uuid,integer),
  cali_workspace.v2_read_pilot_report_catalog(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
