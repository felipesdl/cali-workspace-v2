-- Download apenas da revisão CALI V2 explicitamente liberada na empresa e inscrita no piloto.
create function cali_workspace.v2_download_partner_pilot_report(p_company uuid,p_report uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  payload jsonb;
begin
  perform cali_session_guard.require_phase5_partner(p_company,'reports');
  select jsonb_build_object('id',r.id,'version',p.version,'fileName',a.render_protocol||'.pdf',
    'content',encode(p.content,'base64'),'sha256',encode(sha256(p.content),'hex')) into payload
  from cali_workspace.reports r
  join cali_session_guard.phase5_partner_catalog_scope scope
    on scope.company_id=r.company_id and scope.item_id=r.id and scope.module='reports'
  join cali_session_guard.phase4_report_releases x on x.report_id=r.id and x.version=r.version and x.withdrawn_at is null
  join cali_session_guard.phase4_report_approvals a on a.report_id=x.report_id and a.version=x.version and a.company_id=r.company_id
  join cali_session_guard.phase4_report_pdfs p on p.report_id=a.report_id and p.version=a.version
  where r.id=p_report and r.company_id=p_company and r.version=p_version
    and r.status='approved' and r.published_at is null and r.sent_at is null and r.withdrawn_at is null
    and a.render_protocol is not null
  for share of r,x;
  if not found then raise exception using errcode='42501',message='PDF indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;
revoke all on function cali_workspace.v2_download_partner_pilot_report(uuid,uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_download_partner_pilot_report(uuid,uuid,integer) to authenticated;
