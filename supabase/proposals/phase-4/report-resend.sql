begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_resend_pilot_report(
  p_company uuid,p_report uuid,p_version integer,p_request uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  signature bytea:=sha256(convert_to(jsonb_build_array('report-resend',p_report,p_version)::text,'UTF8'));
  prior uuid;
  title text;
begin
  if p_report is null or p_version is null or p_version<1 then
    raise exception using errcode='22023',message='Revisão inválida.';
  end if;
  prior:=cali_session_guard.read_phase4_receipt(actor,p_company,p_request,signature);
  if prior is not null then return prior; end if;
  select r.title into title from cali_workspace.reports r
  join cali_session_guard.phase4_report_releases x on x.report_id=r.id and x.version=r.version
  where r.id=p_report and r.company_id=p_company and r.version=p_version and r.status='approved'
    and x.withdrawn_at is null for update of r;
  if not found then raise exception using errcode='40001',message='A revisão publicada mudou.'; end if;
  perform cali_workspace.notify_workspace_movement(p_company,actor,'client','report_resent',
    'Relatório reenviado','“'||title||'” está disponível no Workspace.','report',p_report,
    '/cliente/relatorios?report='||p_report::text,'normal',false);
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company,p_request,signature,p_report);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'report_resent','report',p_report,jsonb_build_object('version',p_version));
  return p_report;
end;
$$;

revoke all on function cali_workspace.v2_resend_pilot_report(uuid,uuid,integer,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_resend_pilot_report(uuid,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
