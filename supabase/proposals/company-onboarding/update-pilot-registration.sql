-- Cadastro complementar no piloto. Usa os campos existentes de companies.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_update_pilot_company_registration(
  p_company_id uuid, p_expected_at timestamptz, p_values jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  original cali_workspace.companies;
  proposed record;
  proposed_branches jsonb;
  changed_fields jsonb;
begin
  if not exists (select 1 from cali_session_guard.pilot_companies where company_id = p_company_id) then
    raise exception using errcode = '22023', message = 'Empresa fora da homologação.';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object'
    or not (p_values ?& array['segment','monthly_hours_contracted','address_street','address_number',
      'address_neighborhood','address_city','address_state','branches','has_branches'])
    or (p_values - array['segment','monthly_hours_contracted','address_street','address_number',
      'address_neighborhood','address_city','address_state','branches','has_branches']) <> '{}'::jsonb
    or jsonb_typeof(p_values->'branches') <> 'array'
    or jsonb_typeof(p_values->'has_branches') <> 'boolean' then
    raise exception using errcode = '22023', message = 'Dados cadastrais inválidos.';
  end if;
  select nullif(btrim(segment),'') as segment, nullif(monthly_hours_contracted,0) as hours,
    nullif(btrim(address_street),'') as street, nullif(btrim(address_number),'') as street_number,
    nullif(btrim(address_neighborhood),'') as neighborhood, nullif(btrim(address_city),'') as city,
    nullif(upper(btrim(address_state)),'') as state, has_branches
  into proposed from jsonb_to_record(p_values) as values_row(segment text, monthly_hours_contracted numeric,
    address_street text, address_number text, address_neighborhood text, address_city text,
    address_state text, has_branches boolean);
  proposed_branches := case when proposed.has_branches then p_values->'branches' else '[]'::jsonb end;
  if proposed.hours < 0 or proposed.hours > 999999.99 or scale(proposed.hours) > 2
    or proposed.state !~ '^[A-Z]{2}$'
    or greatest(length(proposed.segment),length(proposed.street),length(proposed.street_number),
      length(proposed.neighborhood),length(proposed.city)) > 250
    or length(proposed_branches::text) > 5100
    or exists (select 1 from jsonb_array_elements(proposed_branches) b
      where jsonb_typeof(b) <> 'string' or nullif(btrim(b #>> '{}'),'') is null) then
    raise exception using errcode = '22023', message = 'Dados cadastrais inválidos.';
  end if;

  select * into strict original from cali_workspace.companies
    where id = p_company_id for update;
  if p_expected_at is distinct from original.updated_at then
    raise exception using errcode = '40001', message = 'Cadastro alterado. Recarregue a ficha.';
  end if;

  select jsonb_agg(field) into changed_fields
  from (values
    ('segment', original.segment is distinct from proposed.segment),
    ('monthly_hours_contracted', original.monthly_hours_contracted is distinct from proposed.hours),
    ('address_street', original.address_street is distinct from proposed.street),
    ('address_number', original.address_number is distinct from proposed.street_number),
    ('address_neighborhood', original.address_neighborhood is distinct from proposed.neighborhood),
    ('address_city', original.address_city is distinct from proposed.city),
    ('address_state', original.address_state is distinct from proposed.state),
    ('has_branches', original.has_branches is distinct from proposed.has_branches),
    ('branches', original.branches is distinct from proposed_branches)
  ) as comparison(field, changed) where changed;
  if changed_fields is null then return p_company_id; end if;

  update cali_workspace.companies set segment = proposed.segment, monthly_hours_contracted = proposed.hours,
    address_street = proposed.street, address_number = proposed.street_number,
    address_neighborhood = proposed.neighborhood, address_city = proposed.city, address_state = proposed.state,
    has_branches = proposed.has_branches, branches = proposed_branches
  where id = p_company_id;
  insert into cali_workspace.activity_log (company_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_company_id, actor, 'v2_company_registration_updated', 'company', p_company_id,
    jsonb_build_object('fields',changed_fields));
  return p_company_id;
end;
$$;

revoke all on function cali_workspace.v2_update_pilot_company_registration(uuid,timestamptz,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_update_pilot_company_registration(uuid,timestamptz,jsonb)
  to authenticated;
notify pgrst, 'reload schema';
commit;
