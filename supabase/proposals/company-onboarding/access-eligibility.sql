-- Candidata privada para uso dentro da futura transação de convite ou reautorização.
begin;

create function cali_v2_onboarding.require_access_adhesion(p_company_id uuid)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  linked_draft_id uuid;
  company_status text;
  latest cali_v2_onboarding.adhesion_events;
begin
  select d.id into linked_draft_id
  from cali_v2_onboarding.company_drafts d
  where d.company_id = p_company_id
  for update;

  select c.status into company_status from cali_workspace.companies c
  where c.id = p_company_id
  for share;

  if linked_draft_id is null or company_status is null
    or company_status not in ('active', 'paused') then
    raise exception using errcode = '55000', message = 'Empresa indisponível para autorizar acessos.';
  end if;

  select e.* into latest from cali_v2_onboarding.adhesion_events e
  where e.draft_id = linked_draft_id order by e.sequence desc limit 1;

  if latest.action is distinct from 'confirmed' or latest.document_snapshot is null then
    raise exception using errcode = '55000', message = 'Confirme a adesão com um documento no Storage.';
  end if;

  perform 1 from cali_v2_onboarding.adhesion_document_versions v
  where v.company_id = p_company_id
    and v.document_id = (latest.document_snapshot ->> 'document_id')::uuid
    and v.object_id = (latest.document_snapshot ->> 'object_id')::uuid
    and v.version = latest.document_snapshot ->> 'version'
  for share;

  if not found then
    raise exception using errcode = '55000', message = 'Confira a versão atual do documento de adesão.';
  end if;

  return latest.id;
end;
$$;

revoke all on function cali_v2_onboarding.require_access_adhesion(uuid)
  from public, anon, authenticated, service_role;

commit;
