-- Aplicar após materialize-company.sql.
begin;

alter table cali_v2_onboarding.adhesion_events add column document_snapshot jsonb;

create view cali_v2_onboarding.adhesion_document_versions as
select d.company_id, d.id as document_id, d.title, d.document_type,
  o.id as object_id, o.version
from cali_workspace.account_documents d
join storage.objects o on o.bucket_id = 'cali-workspace-private' and o.name = d.storage_path
where d.document_type in ('contract', 'addendum')
  and starts_with(d.storage_path, d.company_id::text || '/account/')
  and o.archived_at is null and not coalesce(o.is_delete_marker, false)
  and nullif(o.version, '') is not null;

revoke all on cali_v2_onboarding.adhesion_document_versions
  from public, anon, authenticated, service_role;

create function cali_v2_onboarding.list_adhesion_documents(p_draft_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  perform cali_v2_onboarding.require_admin();
  select coalesce(jsonb_agg(to_jsonb(v) - 'company_id' order by v.title, v.document_id), '[]'::jsonb)
  into result
  from cali_v2_onboarding.company_drafts d
  join cali_v2_onboarding.adhesion_document_versions v on v.company_id = d.company_id
  where d.id = p_draft_id;
  return result;
end;
$$;

create function cali_v2_onboarding.confirm_adhesion_document(
  p_draft_id uuid, p_request_id uuid, p_expected_event_id uuid, p_reference text,
  p_note text, p_document_id uuid, p_object_id uuid, p_version text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  linked_company_id uuid;
  stored_event cali_v2_onboarding.adhesion_events;
  version_row cali_v2_onboarding.adhesion_document_versions;
  result jsonb;
begin
  select d.company_id into linked_company_id
  from cali_v2_onboarding.company_drafts d where d.id = p_draft_id for update;

  select e.* into stored_event from cali_v2_onboarding.adhesion_events e
  where e.recorded_by = actor and e.request_id = p_request_id;
  if found then
    if stored_event.document_snapshot is null or
      (stored_event.document_snapshot ->> 'document_id') is distinct from p_document_id::text or
      (stored_event.document_snapshot ->> 'object_id') is distinct from p_object_id::text or
      (stored_event.document_snapshot ->> 'version') is distinct from p_version then
      raise exception using errcode = '23505', message = 'Chave de operação já usada com outros dados.';
    end if;
    return cali_v2_onboarding.review_adhesion(
      p_draft_id, p_request_id, p_expected_event_id, 'confirmed', p_reference, p_version, p_note
    );
  end if;

  select v.* into version_row
  from cali_v2_onboarding.adhesion_document_versions v
  where v.company_id = linked_company_id and v.document_id = p_document_id
    and v.object_id = p_object_id and v.version = p_version
  for share;
  if not found then
    raise exception using errcode = '55000', message = 'Versão indisponível. Atualize os documentos e confira novamente.';
  end if;

  result := cali_v2_onboarding.review_adhesion(
    p_draft_id, p_request_id, p_expected_event_id, 'confirmed', p_reference, p_version, p_note
  );
  update cali_v2_onboarding.adhesion_events
  set document_snapshot = to_jsonb(version_row) - 'company_id'
  where id = (result ->> 'id')::uuid;
  return result || jsonb_build_object('document_snapshot', to_jsonb(version_row) - 'company_id');
end;
$$;

create function cali_workspace.v2_list_adhesion_documents(p_draft_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select cali_v2_onboarding.list_adhesion_documents(p_draft_id); $$;

create function cali_workspace.v2_confirm_adhesion_document(
  p_draft_id uuid, p_request_id uuid, p_expected_event_id uuid, p_reference text,
  p_note text, p_document_id uuid, p_object_id uuid, p_version text
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select cali_v2_onboarding.confirm_adhesion_document(
    p_draft_id, p_request_id, p_expected_event_id, p_reference, p_note, p_document_id, p_object_id, p_version
  );
$$;

revoke all on function cali_v2_onboarding.list_adhesion_documents(uuid),
  cali_workspace.v2_list_adhesion_documents(uuid),
  cali_v2_onboarding.confirm_adhesion_document(uuid, uuid, uuid, text, text, uuid, uuid, text),
  cali_workspace.v2_confirm_adhesion_document(uuid, uuid, uuid, text, text, uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function cali_v2_onboarding.list_adhesion_documents(uuid),
  cali_workspace.v2_list_adhesion_documents(uuid),
  cali_v2_onboarding.confirm_adhesion_document(uuid, uuid, uuid, text, text, uuid, uuid, text),
  cali_workspace.v2_confirm_adhesion_document(uuid, uuid, uuid, text, text, uuid, uuid, text)
  to authenticated;

commit;
