-- Preparação da adesão das empresas existentes do piloto. Sem opt-in de acesso.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_prepare_pilot_company_draft(p_company_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  company cali_workspace.companies;
  draft_id uuid;
begin
  if not exists (
    select 1 from auth.sessions s where s.user_id = actor
      and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'Sessão Admin indisponível.';
  end if;
  -- O lock serializa dois pedidos para a mesma empresa já existente.
  select c.* into company from cali_workspace.companies c
  where c.id = p_company_id and (c.id, c.notes) in (
    ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid, 'CALI_V2_TEST_A_20261101'),
    ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid, 'CALI_V2_TEST_B_20261101')
  ) for update;
  if not found then
    raise exception using errcode = '22023', message = 'Empresa fora do piloto.';
  end if;
  select d.id into draft_id from cali_v2_onboarding.company_drafts d where d.company_id = company.id;
  if found then return draft_id; end if;

  insert into cali_v2_onboarding.company_drafts (
    display_name, legal_name, recorded_by, request_id, company_id, materialized_by, materialized_at
  ) values (
    company.display_name, coalesce(nullif(btrim(company.legal_name), ''), company.display_name),
    actor, gen_random_uuid(), company.id, actor, clock_timestamp()
  ) returning id into draft_id;

  return draft_id;
end;
$$;
revoke all on function cali_workspace.v2_prepare_pilot_company_draft(uuid)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_prepare_pilot_company_draft(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
