-- FLOW-18. Exportação administrativa por destinatário e conferência de eliminação.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_export_pilot_company_data(p_company_id uuid,p_recipient text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  recipient text := btrim(p_recipient);
  result jsonb;
  forms jsonb;
begin
  if coalesce(length(recipient),0) not between 3 and 200 or recipient ~ '[[:cntrl:]]' then
    raise exception using errcode='22023',message='Informe o destinatário autorizado.';
  end if;
  perform 1 from cali_workspace.companies c where c.id=p_company_id and c.data_eliminated_at is null for share;
  if not found then raise exception using errcode='42501',message='Empresa indisponível para exportação.'; end if;
  result:=cali_workspace.admin_export_company_data(p_company_id,recipient);
  if result is null or result#>>'{company,id}' is distinct from p_company_id::text then
    raise exception using errcode='42501',message='Exportação indisponível.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]'::jsonb) into forms
  from (
    select form.id,form.slug,form.title,form.status,form.questions,
      coalesce((select jsonb_agg(to_jsonb(response) order by response.submitted_at,response.id) from (
        select r.id,r.submitted_at,r.answers,r.stage,r.owner,
          exists(select 1 from cali_session_guard.phase4_form_pdfs p where p.response_id=r.id) as "pdfAvailable"
        from cali_workspace.form_responses r where r.form_id=form.id
      ) response),'[]'::jsonb) as responses
    from cali_workspace.forms form where form.company_id=p_company_id
  ) f;
  result:=result||jsonb_build_object('workspace_v2',jsonb_build_object('forms',forms,
    'escopo','Registros estruturados. Arquivos e conteúdo em sistemas externos exigem conferência separada.'));
  if octet_length(result::text)>8388608 then
    raise exception using errcode='22023',message='A exportação excede 8 MiB.';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return result;
end;
$$;

create or replace function cali_workspace.v2_preview_pilot_company_elimination(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  company cali_workspace.companies;
  storage_count integer;
begin
  select c.* into company from cali_workspace.companies c where c.id=p_company_id;
  if not found then raise exception using errcode='42501',message='Empresa indisponível.'; end if;
  if not cali_workspace.company_elimination_ready(p_company_id) then
    return jsonb_build_object('companyId',p_company_id,'eligible',false);
  end if;
  select count(*) into storage_count from cali_workspace.admin_company_storage_objects(p_company_id);
  return jsonb_build_object('companyId',p_company_id,'eligible',true,
    'legacyStorageObjects',storage_count,
    'forms',(select count(*) from cali_workspace.forms f where f.company_id=p_company_id),
    'formsPdfs',(select count(*) from cali_session_guard.phase4_form_pdfs p
      join cali_workspace.form_responses r on r.id=p.response_id
      join cali_workspace.forms f on f.id=r.form_id where f.company_id=p_company_id),
    'workspaceFiles',jsonb_build_object(
      'documentRevisions',(select count(*) from cali_session_guard.phase4_document_revisions v
        join cali_session_guard.phase4_documents d on d.id=v.document_id where d.company_id=p_company_id),
      'recordAttachments',(select count(*) from cali_session_guard.phase4_record_attachments a
        join cali_workspace.account_record_messages m on m.id=a.message_id where m.company_id=p_company_id),
      'reportPdfs',(select count(*) from cali_session_guard.phase4_report_pdfs p
        join cali_workspace.reports r on r.id=p.report_id where r.company_id=p_company_id),
      'agendaPdfs',(select count(*) from cali_session_guard.phase4_agenda_material m
        join cali_workspace.events e on e.id=m.event_id where e.company_id=p_company_id and m.content is not null),
      'expenseReceipts',(select count(*) from cali_session_guard.phase4_extra_expense_pdf p
        join cali_workspace.extra_visit_expenses e on e.id=p.expense_id where e.company_id=p_company_id),
      'proposalPdfs',(select count(*) from cali_session_guard.phase4_commercial_email e
        join cali_session_guard.phase4_commercial_scope s on s.proposal_id=e.proposal_id
        where s.company_id=p_company_id and e.pdf is not null),
      'exclusiveNoticeCovers',(select count(*) from cali_session_guard.phase4_notice_cover c
        join cali_workspace.notices n on n.id=c.notice_id
        where c.content is not null and n.audience='selected'
          and exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id=p_company_id)
          and not exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id is distinct from p_company_id))));
end;
$$;

revoke all on function cali_workspace.v2_export_pilot_company_data(uuid,text),
  cali_workspace.v2_preview_pilot_company_elimination(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_export_pilot_company_data(uuid,text),
  cali_workspace.v2_preview_pilot_company_elimination(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
