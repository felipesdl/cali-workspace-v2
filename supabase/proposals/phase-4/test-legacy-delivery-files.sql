\ir prepare-legacy-delivery-files.sql
begin;
alter table cali_workspace.files
  add column project_id uuid,add column storage_path text,add column drive_url text,
  add column original_filename text,add column file_size_bytes bigint,
  add column uploaded_by uuid,add column created_at timestamptz,add column version_label text,
  add column revision_of_id uuid;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  delivery uuid := (select id from cali_workspace.deliverables where company_id=a and title='Entrega pública');
  project uuid := (select project_id from cali_workspace.deliverables where id=delivery);
  pdf uuid := gen_random_uuid();
  archived_pdf uuid := gen_random_uuid();
  archived_docx uuid := gen_random_uuid();
  pdf_bytes bytea := convert_to(E'%PDF-1.4\n[TESTE V2] publicado','UTF8');
  archive_bytes bytea := convert_to(E'%PDF-1.4\n[TESTE V2] arquivado','UTF8');
  docx_bytes bytea := decode('504b030400000000','hex');
  actor uuid;
  archived uuid;
begin
  perform cali_workspace.fixture_as('admin');
  actor:=auth.uid();
  update cali_workspace.deliverables set status='approved' where id=delivery;
  insert into cali_workspace.files(id,company_id,project_id,deliverable_id,title,status,published_at,client_visible,
    storage_path,original_filename,file_size_bytes,uploaded_by,created_at,version_label,revision_of_id)
  values (pdf,a,project,delivery,'[TESTE V2] PDF publicado','published','2026-11-06Z',true,
    'qa/publicado.pdf','publicado.pdf',octet_length(pdf_bytes),actor,'2026-11-05Z','v2',archived_pdf),
    (archived_pdf,a,project,delivery,'[TESTE V2] PDF arquivado','archived',null,false,
    'qa/arquivado.pdf','arquivado.pdf',octet_length(archive_bytes),actor,'2026-11-02Z','v1',null),
    (archived_docx,a,project,delivery,'[TESTE V2] DOCX arquivado','archived',null,false,
    'qa/arquivado.docx','arquivado.docx',octet_length(docx_bytes),actor,'2026-11-01Z','rascunho',archived_pdf);

  begin
    perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,pdf,sha256(archive_bytes),pdf_bytes);
    raise exception 'Hash divergente aceito';
  exception when invalid_parameter_value then null; end;
  begin
    perform cali_session_guard.phase4_prepare_legacy_delivery_file(b,delivery,pdf,sha256(pdf_bytes),pdf_bytes);
    raise exception 'Vínculo cruzado aceito';
  exception when insufficient_privilege then null; end;

  perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,pdf,sha256(pdf_bytes),pdf_bytes);
  perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,pdf,sha256(pdf_bytes),pdf_bytes);
  perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,archived_pdf,sha256(archive_bytes),archive_bytes);
  perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,archived_docx,sha256(docx_bytes),docx_bytes);
  assert (select count(*) from cali_session_guard.phase4_legacy_delivery_files)=3;
  assert (select count(*) from cali_session_guard.phase4_legacy_delivery_files c
    join cali_workspace.files f on f.id=c.file_id where c.source_metadata=to_jsonb(f))=3;
  assert (select sha256 from cali_session_guard.phase4_legacy_delivery_files where file_id=archived_docx)=sha256(docx_bytes);
  assert not exists(select 1 from cali_session_guard.phase4_documents where id in (archived_pdf,archived_docx));

  begin
    update cali_workspace.files set version_label='mudou' where id=pdf;
    perform cali_session_guard.phase4_prepare_legacy_delivery_file(a,delivery,pdf,sha256(pdf_bytes),pdf_bytes);
    raise exception 'Sobrescrita do histórico aceita';
  exception when serialization_failure then null; end;

  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_read_pilot_delivery_pdf_info(a,delivery)->>'revisionId'=pdf::text;
  assert cali_workspace.v2_read_pilot_document_pdf(a,pdf,pdf)->>'sha256'=encode(sha256(pdf_bytes),'hex');
  foreach archived in array array[archived_pdf,archived_docx] loop
    begin
      perform cali_workspace.v2_read_pilot_document_pdf(a,archived,archived);
      raise exception 'Arquivo arquivado exposto ao Cliente A';
    exception when insufficient_privilege then null; end;
  end loop;
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_read_pilot_delivery_pdf_info(b,delivery) is null;
  begin
    perform cali_workspace.v2_read_pilot_document_pdf(b,pdf,pdf);
    raise exception 'PDF retornado ao Cliente B';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not has_function_privilege('authenticated',
    'cali_session_guard.phase4_prepare_legacy_delivery_file(uuid,uuid,uuid,bytea,bytea)','execute');
  assert not has_table_privilege('authenticated','cali_session_guard.phase4_legacy_delivery_files','select');
end $$;
rollback;
do $$
begin
  assert not exists(select 1 from cali_session_guard.phase4_legacy_delivery_files);
  assert not exists(select 1 from cali_session_guard.phase4_documents where title='[TESTE V2] PDF publicado');
end $$;
\echo Fase 4: cópia sintética de entregáveis, hash, histórico privado, escopo A/B e rollback validados.
