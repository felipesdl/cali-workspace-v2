-- FLOW-06. Preparação de cópia por operação administrativa de banco.
-- A origem e as permissões legadas permanecem em vigor até o corte.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.phase4_legacy_delivery_files (
  file_id uuid primary key,
  company_id uuid not null,
  delivery_id uuid not null,
  source_metadata jsonb not null,
  content bytea not null check (octet_length(content) between 8 and 2097152),
  sha256 bytea generated always as (pg_catalog.sha256(content)) stored
);
alter table cali_session_guard.phase4_legacy_delivery_files enable row level security;
revoke all on cali_session_guard.phase4_legacy_delivery_files from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_prepare_legacy_delivery_file(
  p_company_id uuid,p_delivery_id uuid,p_file_id uuid,p_expected_sha256 bytea,p_content bytea
)
returns void language plpgsql set search_path = ''
as $$
declare
  source record;
  previous cali_session_guard.phase4_legacy_delivery_files%rowtype;
  metadata jsonb;
  file_name text;
  published boolean;
begin
  if coalesce(octet_length(p_content),0) not between 8 and 2097152
    or sha256(p_content) is distinct from p_expected_sha256 then
    raise exception using errcode='22023',message='Tamanho ou hash do arquivo inválido.';
  end if;

  perform 1 from cali_workspace.projects p join cali_workspace.deliverables d on d.project_id=p.id
  where p.company_id=p_company_id and d.company_id=p_company_id and d.id=p_delivery_id for update of p;
  perform 1 from cali_workspace.deliverables d where d.id=p_delivery_id and d.company_id=p_company_id for update;
  select to_jsonb(f) as details,d.status as delivery_status,d.client_visible as delivery_visible,
    p.planning_status into source
  from cali_workspace.files f
  join cali_workspace.deliverables d on d.id=f.deliverable_id and d.company_id=f.company_id
  join cali_workspace.projects p on p.id=d.project_id and p.company_id=d.company_id
  where f.id=p_file_id and f.deliverable_id=p_delivery_id and f.company_id=p_company_id
    and f.project_id=p.id and f.storage_path is not null and f.drive_url is null for share of f;
  if not found then raise exception using errcode='42501',message='Vínculo de origem indisponível.'; end if;

  metadata:=source.details;
  file_name:=metadata->>'original_filename';
  published:=metadata->>'status'='published' and (metadata->>'client_visible')::boolean;
  if (metadata->>'file_size_bytes')::bigint is distinct from octet_length(p_content)::bigint
    or coalesce(length(file_name),0) not between 5 and 180
    or file_name ~ '[[:cntrl:]/]' or position(chr(92) in file_name)>0
    or not (
      (lower(right(file_name,4))='.pdf' and substring(p_content for 5)=convert_to('%PDF-','UTF8'))
      or (not published and lower(right(file_name,5))='.docx' and substring(p_content for 4)=decode('504b0304','hex'))
    )
    or (not published and (metadata->>'status'<>'archived' or (metadata->>'client_visible')::boolean))
    or (published and (metadata->>'uploaded_by' is null or metadata->>'published_at' is null
      or source.delivery_status not in ('client_review','approved') or not source.delivery_visible
      or source.planning_status not in ('client_review','adjustment_requested','approved','active','rebriefing','closed'))) then
    raise exception using errcode='22023',message='Formato, versão ou visibilidade da origem incompatível.';
  end if;

  select * into previous from cali_session_guard.phase4_legacy_delivery_files where file_id=p_file_id;
  if found then
    if previous.source_metadata is distinct from metadata or previous.sha256 is distinct from p_expected_sha256 then
      raise exception using errcode='40001',message='A origem mudou desde a cópia.';
    end if;
    return;
  end if;

  insert into cali_session_guard.phase4_legacy_delivery_files(file_id,company_id,delivery_id,source_metadata,content)
  values(p_file_id,p_company_id,p_delivery_id,metadata,p_content);
  if published then
    insert into cali_session_guard.phase4_documents(id,company_id,title,delivery_id,created_at)
    values(p_file_id,p_company_id,metadata->>'title',p_delivery_id,(metadata->>'created_at')::timestamptz);
    insert into cali_session_guard.phase4_document_revisions(id,document_id,number,file_name,content,uploaded_by,uploaded_at)
    values(p_file_id,p_file_id,1,file_name,p_content,(metadata->>'uploaded_by')::uuid,(metadata->>'created_at')::timestamptz);
    update cali_session_guard.phase4_documents set published_revision=p_file_id where id=p_file_id;
  end if;
end;
$$;
revoke all on function cali_session_guard.phase4_prepare_legacy_delivery_file(uuid,uuid,uuid,bytea,bytea)
  from public,anon,authenticated,service_role;
commit;
