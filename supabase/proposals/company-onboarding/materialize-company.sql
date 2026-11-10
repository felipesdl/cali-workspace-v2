-- Aplicação explícita após candidate.sql. O vínculo fica no schema privado da V2.
begin;

alter table cali_v2_onboarding.company_drafts
  add column company_id uuid unique,
  add column materialized_by uuid,
  add column materialized_at timestamptz,
  add constraint company_drafts_materialization_complete
    check (num_nonnulls(company_id, materialized_by, materialized_at) in (0, 3));

create function cali_v2_onboarding.materialize_company(p_draft_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  draft cali_v2_onboarding.company_drafts;
  new_company_id uuid;
begin
  select d.* into draft
  from cali_v2_onboarding.company_drafts d where d.id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Rascunho indisponível.';
  end if;

  if draft.company_id is not null then
    if not exists (select 1 from cali_workspace.companies c where c.id = draft.company_id) then
      raise exception using errcode = '55000', message = 'A empresa vinculada está indisponível.';
    end if;
    return draft.company_id;
  end if;

  insert into cali_workspace.companies (
    display_name, legal_name, automation_enabled, welcome_email_enabled,
    due_reminder_enabled, overdue_email_enabled, termination_email_enabled
  ) values (
    draft.display_name, draft.legal_name, false, false, false, false, false
  ) returning id into new_company_id;

  update cali_v2_onboarding.company_drafts
  set company_id = new_company_id, materialized_by = actor, materialized_at = clock_timestamp()
  where id = draft.id;

  return new_company_id;
end;
$$;

create function cali_workspace.v2_materialize_company(p_draft_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select cali_v2_onboarding.materialize_company(p_draft_id); $$;

revoke all on function cali_v2_onboarding.materialize_company(uuid),
  cali_workspace.v2_materialize_company(uuid)
  from public, anon, authenticated, service_role;

grant execute on function cali_v2_onboarding.materialize_company(uuid),
  cali_workspace.v2_materialize_company(uuid) to authenticated;

commit;
