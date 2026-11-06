-- FLOW-12. Prepara e aprova a versão interna. Publicação depende do artefato privado da revisão.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_create_pilot_report_draft(
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
    report_type,period_start,period_end,source_snapshot,generated_at,data_refreshed_at)
  values(p_report_id,p_company_id,btrim(p_title),p_month,'draft',btrim(p_summary),
    'monthly',p_month,month_end,source_data,now(),now());
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_draft_created','report',p_report_id,jsonb_build_object('period',p_month));
  return p_report_id;
end;
$$;

create function cali_workspace.v2_update_pilot_report_draft(
  p_company_id uuid,p_report_id uuid,p_expected timestamptz,p_action text,p_summary text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  report_row cali_workspace.reports%rowtype;
begin
  if p_action is null or p_action not in ('edit','review','approve')
    or (p_action='edit' and coalesce(length(btrim(p_summary)),0) not between 1 and 8000) then
    raise exception using errcode='22023', message='Ação de relatório inválida.';
  end if;
  select * into report_row from cali_workspace.reports r
  where r.company_id=p_company_id and r.id=p_report_id for update;
  if not found then raise exception using errcode='42501', message='Relatório indisponível.'; end if;
  if report_row.updated_at is distinct from p_expected
    or (p_action='edit' and report_row.status not in ('draft','review'))
    or (p_action='review' and report_row.status<>'draft')
    or (p_action='approve' and report_row.status<>'review')
    or report_row.published_at is not null or report_row.sent_at is not null then
    raise exception using errcode='40001', message='O relatório mudou de versão ou estado.';
  end if;

  case p_action
    when 'edit' then update cali_workspace.reports set executive_summary=btrim(p_summary),updated_at=now() where id=p_report_id;
    when 'review' then update cali_workspace.reports set status='review',review_started_at=now(),updated_at=now() where id=p_report_id;
    when 'approve' then update cali_workspace.reports set status='approved',approved_at=now(),approved_by=actor,updated_at=now() where id=p_report_id;
  end case;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'report_'||p_action,'report',p_report_id,jsonb_build_object('version',report_row.version));
  return p_report_id;
end;
$$;

revoke all on function cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text),
  cali_workspace.v2_update_pilot_report_draft(uuid,uuid,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text),
  cali_workspace.v2_update_pilot_report_draft(uuid,uuid,timestamptz,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
