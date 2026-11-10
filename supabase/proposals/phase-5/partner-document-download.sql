-- Partner recebe somente a revisão publicada do documento avulso inscrito.
create function cali_workspace.v2_download_partner_pilot_document(p_company uuid,p_document uuid,p_revision uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  payload jsonb;
begin
  perform cali_session_guard.require_phase5_partner(p_company,'documents');
  select jsonb_build_object('id',d.id,'revisionId',v.id,'fileName',v.file_name,
    'content',encode(v.content,'base64'),'sha256',encode(sha256(v.content),'hex')) into payload
  from cali_session_guard.phase4_documents d
  join cali_session_guard.phase5_partner_catalog_scope scope
    on scope.company_id=d.company_id and scope.item_id=d.id and scope.module='documents'
  join cali_session_guard.phase4_document_revisions v on v.document_id=d.id and v.id=d.published_revision
  where d.id=p_document and d.company_id=p_company and d.delivery_id is null and v.id=p_revision
  for share of d;
  if not found then raise exception using errcode='42501',message='Documento indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;
revoke all on function cali_workspace.v2_download_partner_pilot_document(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_download_partner_pilot_document(uuid,uuid,uuid) to authenticated;
