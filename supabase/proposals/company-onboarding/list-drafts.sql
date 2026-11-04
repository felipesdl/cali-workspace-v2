-- Complemento da migration de cadastro. Aplicação explícita após candidate.sql.
begin;

create function cali_v2_onboarding.list_drafts(p_before uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  before_time timestamptz;
  result jsonb;
begin
  perform cali_v2_onboarding.require_admin();

  if p_before is not null then
    select d.recorded_at into before_time
    from cali_v2_onboarding.company_drafts d where d.id = p_before;
    if not found then
      raise exception using errcode = '22023', message = 'Página indisponível. Volte ao início.';
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(page) order by page.recorded_at desc, page.id desc), '[]'::jsonb)
  into result
  from (
    select d.id, d.display_name, d.legal_name, d.recorded_at, d.recorded_by
    from cali_v2_onboarding.company_drafts d
    where p_before is null or (d.recorded_at, d.id) < (before_time, p_before)
    order by d.recorded_at desc, d.id desc
    limit 26
  ) page;
  return result;
end;
$$;

create index company_drafts_listing
  on cali_v2_onboarding.company_drafts(recorded_at desc, id desc);

create function cali_workspace.v2_list_company_drafts(p_before uuid default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select cali_v2_onboarding.list_drafts(p_before); $$;

revoke all on function cali_v2_onboarding.list_drafts(uuid),
  cali_workspace.v2_list_company_drafts(uuid)
  from public, anon, authenticated, service_role;

grant execute on function cali_v2_onboarding.list_drafts(uuid),
  cali_workspace.v2_list_company_drafts(uuid) to authenticated;

commit;
