-- Reportes iniciados pelo Partner ficam privados até revisão e materialização Admin.
-- Aplicar após phase-5/partner-catalogs.sql e phase-4/report-draft-operations.sql.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase5_partner_report_drafts (
  id uuid primary key,
  company_id uuid not null references cali_workspace.companies(id),
  staff_id uuid not null references cali_workspace.staff_members(id),
  author_user_id uuid not null references auth.users(id),
  reference_month date not null,
  title text not null,
  summary text not null,
  status text not null check(status in ('draft','submitted','returned','materialized')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  decision_note text,
  materialized_at timestamptz,
  materialized_by uuid references auth.users(id),
  report_id uuid unique references cali_workspace.reports(id),
  check ((status='materialized')=(report_id is not null)),
  check ((status='materialized')=(materialized_at is not null and materialized_by is not null)),
  check ((status='draft')=(submitted_at is null)),
  check ((status='returned')=(decision_note is not null))
);
create index if not exists phase5_partner_report_drafts_admin_queue
  on cali_session_guard.phase5_partner_report_drafts(company_id,status,updated_at desc);
alter table cali_session_guard.phase5_partner_report_drafts enable row level security;
revoke all on cali_session_guard.phase5_partner_report_drafts from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase5_require_partner_reports(p_company uuid)
returns cali_session_guard.phase4_staff_invites
language plpgsql stable security definer set search_path=''
as $$
begin
  perform cali_session_guard.require_phase5_partner(p_company,'reports');
  return cali_session_guard.phase5_partner_invite();
end;
$$;

create or replace function cali_workspace.v2_save_partner_report_draft(
  p_company uuid,p_draft uuid,p_expected timestamptz,p_month date,p_title text,p_summary text,p_submit boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_require_partner_reports(p_company);
  report_row cali_session_guard.phase5_partner_report_drafts%rowtype; cleaned_title text:=btrim(p_title); cleaned_summary text:=btrim(p_summary);
  next_state text:=case when p_submit then 'submitted' else 'draft' end;
begin
  if p_draft is null or p_month is null or p_month not between date '1900-01-01' and date '9999-12-01'
    or extract(day from p_month)<>1 or p_submit is null
    or coalesce(length(cleaned_title),0) not between 1 and 180
    or coalesce(length(cleaned_summary),0) not between 1 and 8000 then
    raise exception using errcode='22023',message='Confira o mês, o título e o resumo.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('partner-report-draft:'||p_company::text||':'||p_draft::text,0));
  select * into report_row from cali_session_guard.phase5_partner_report_drafts d
  where d.id=p_draft for update;
  if found then
    if report_row.company_id<>p_company or report_row.staff_id<>invitation.member_id
      or report_row.author_user_id<>invitation.target_user_id then
      raise exception using errcode='42501',message='Este rascunho não pode mais ser alterado.';
    end if;
    if report_row.reference_month=p_month and report_row.title=cleaned_title
      and report_row.summary=cleaned_summary and report_row.status=next_state
    then return jsonb_build_object('id',report_row.id,'companyId',p_company,'month',report_row.reference_month,
      'title',report_row.title,'summary',report_row.summary,'status',report_row.status,'updatedAt',report_row.updated_at,
      'submittedAt',report_row.submitted_at,'decisionNote',report_row.decision_note,'reportId',report_row.report_id); end if;
    if report_row.status not in ('draft','returned') then
      raise exception using errcode='42501',message='Este rascunho não pode mais ser alterado.';
    end if;
    if report_row.updated_at is distinct from p_expected then
      raise exception using errcode='40001',message='O rascunho mudou. Atualize a lista.';
    end if;
    update cali_session_guard.phase5_partner_report_drafts set reference_month=p_month,title=cleaned_title,
      summary=cleaned_summary,status=next_state,decision_note=null,
      updated_at=clock_timestamp(),submitted_at=case when p_submit then clock_timestamp() else null end
    where id=p_draft returning * into report_row;
  elsif p_expected is not null then
    raise exception using errcode='40001',message='O rascunho não foi encontrado. Atualize a lista.';
  else
    insert into cali_session_guard.phase5_partner_report_drafts(
      id,company_id,staff_id,author_user_id,reference_month,title,summary,status,submitted_at
    ) values(p_draft,p_company,invitation.member_id,invitation.target_user_id,p_month,cleaned_title,
      cleaned_summary,next_state,
      case when p_submit then clock_timestamp() else null end) returning * into report_row;
  end if;
  return jsonb_build_object('id',report_row.id,'companyId',p_company,'month',report_row.reference_month,
    'title',report_row.title,'summary',report_row.summary,'status',report_row.status,'updatedAt',report_row.updated_at,
    'submittedAt',report_row.submitted_at,'decisionNote',report_row.decision_note,'reportId',report_row.report_id);
end;
$$;

create or replace function cali_workspace.v2_list_partner_report_drafts(p_company uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_require_partner_reports(p_company);
begin
  if p_page is null or p_page not between 1 and 10000 then raise exception using errcode='22023'; end if;
  return (with rows as (
    select d.id,d.reference_month,d.title,d.summary,d.status,d.updated_at,d.submitted_at,d.decision_note,d.report_id
    from cali_session_guard.phase5_partner_report_drafts d
    where d.company_id=p_company and d.staff_id=invitation.member_id and d.author_user_id=invitation.target_user_id
  ), selected as (select * from rows order by updated_at desc,id limit 25 offset (p_page-1)*25)
  select jsonb_build_object('companyId',p_company,'total',(select count(*) from rows),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'month',reference_month,'title',title,
      'summary',summary,'status',status,'updatedAt',updated_at,'submittedAt',submitted_at,'decisionNote',decision_note,'reportId',report_id)
      order by updated_at desc,id) from selected),'[]'::jsonb)));
end;
$$;

create or replace function cali_workspace.v2_list_admin_partner_report_drafts(p_company uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then raise exception using errcode='22023'; end if;
  return (with rows as (
    select d.id,d.reference_month,d.title,d.summary,d.status,d.updated_at,d.submitted_at,d.decision_note,d.report_id,
      d.author_user_id,d.staff_id,s.full_name as author_name
    from cali_session_guard.phase5_partner_report_drafts d
    join cali_workspace.staff_members s on s.id=d.staff_id
    where d.company_id=p_company and d.status<>'draft'
  ), selected as (select * from rows order by updated_at desc,id limit 25 offset (p_page-1)*25)
  select jsonb_build_object('companyId',p_company,'total',(select count(*) from rows),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'month',reference_month,'title',title,
      'summary',summary,'status',status,'updatedAt',updated_at,'submittedAt',submitted_at,'decisionNote',decision_note,'reportId',report_id,
      'authorId',author_user_id,'authorName',author_name) order by updated_at desc,id) from selected),'[]'::jsonb)));
end;
$$;

create or replace function cali_workspace.v2_materialize_partner_report_draft(p_company uuid,p_draft uuid,p_expected timestamptz)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  draft cali_session_guard.phase5_partner_report_drafts%rowtype; report uuid;
begin
  select * into draft from cali_session_guard.phase5_partner_report_drafts d
  where d.id=p_draft and d.company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Rascunho do parceiro indisponível.'; end if;
  if draft.status='materialized' then return jsonb_build_object('id',draft.id,'reportId',draft.report_id,'status',draft.status); end if;
  if draft.status<>'submitted' or draft.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='O rascunho mudou. Atualize a fila.';
  end if;
  report:=gen_random_uuid();
  perform cali_workspace.v2_create_pilot_report_draft(p_company,report,draft.reference_month,draft.title,draft.summary);
  update cali_session_guard.phase5_partner_report_drafts set status='materialized',report_id=report,
    materialized_at=clock_timestamp(),materialized_by=actor,updated_at=clock_timestamp()
  where id=draft.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'partner_report_materialized','report',report,
    jsonb_build_object('partnerDraftId',draft.id,'partnerAuthorId',draft.author_user_id,'partnerStaffId',draft.staff_id));
  return jsonb_build_object('id',draft.id,'reportId',report,'status','materialized');
end;
$$;

create or replace function cali_workspace.v2_return_partner_report_draft(
  p_company uuid,p_draft uuid,p_expected timestamptz,p_note text
) returns void language plpgsql security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  draft cali_session_guard.phase5_partner_report_drafts%rowtype; note text:=btrim(p_note);
begin
  if coalesce(length(note),0) not between 1 and 2000 then
    raise exception using errcode='22023',message='Informe o ajuste solicitado.';
  end if;
  select * into draft from cali_session_guard.phase5_partner_report_drafts d
  where d.id=p_draft and d.company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Rascunho indisponível.'; end if;
  if draft.status='returned' and draft.decision_note=note then return; end if;
  if draft.status<>'submitted' or draft.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='O rascunho mudou. Atualize a fila.';
  end if;
  update cali_session_guard.phase5_partner_report_drafts set status='returned',decision_note=note,
    updated_at=clock_timestamp() where id=draft.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'partner_report_returned','partner_report_draft',draft.id,'{}'::jsonb);
end;
$$;

revoke all on function cali_session_guard.phase5_require_partner_reports(uuid),
  cali_workspace.v2_save_partner_report_draft(uuid,uuid,timestamptz,date,text,text,boolean),
  cali_workspace.v2_list_partner_report_drafts(uuid,integer),
  cali_workspace.v2_list_admin_partner_report_drafts(uuid,integer),
  cali_workspace.v2_return_partner_report_draft(uuid,uuid,timestamptz,text),
  cali_workspace.v2_materialize_partner_report_draft(uuid,uuid,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_partner_report_draft(uuid,uuid,timestamptz,date,text,text,boolean),
  cali_workspace.v2_list_partner_report_drafts(uuid,integer) to authenticated;
grant execute on function cali_workspace.v2_list_admin_partner_report_drafts(uuid,integer),
  cali_workspace.v2_return_partner_report_draft(uuid,uuid,timestamptz,text),
  cali_workspace.v2_materialize_partner_report_draft(uuid,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
