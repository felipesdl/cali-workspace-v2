-- Candidata experimental para a política Cliente de documentos/entregáveis.
-- Restrita à cópia descartável. Não altera a autorização de Admin/Partner.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only'
     or current_user <> 'postgres'
     or current_database() !~ '^cali_session_cut_20261101_[0-9a-f]{8}$' then
    raise exception 'Ensaio de Storage restrito à cópia isolada';
  end if;
end $$;

alter policy cali_workspace_private_client_documents_select on storage.objects using (
  bucket_id = 'cali-workspace-private'
  and (
    (split_part(name, '/', 1) = 'documents'
      and split_part(name, '/', 2) = (select cali_workspace.current_company_id())::text)
    or (split_part(name, '/', 1) = (select cali_workspace.current_company_id())::text
      and split_part(name, '/', 2) = 'deliverables')
  )
  and (
    not cali_v2_onboarding.uses_managed_access((select cali_workspace.current_company_id()), null)
    or storage.allow_any_operation(array['object.get_authenticated', 'object.get_authenticated_info'])
  )
);
commit;
