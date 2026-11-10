-- A prévia não grava a equipe e não retorna valores privados.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_preview_pilot_team_import(p_company_id uuid,p_fields jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  if p_fields is null or jsonb_typeof(p_fields)<>'array' then
    raise exception using errcode='22023',message='Prévia de importação inválida.';
  end if;
  if jsonb_array_length(p_fields) not between 1 and 2000 then
    raise exception using errcode='22023',message='Importe de 1 a 2.000 fichas.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_fields) x where
      jsonb_typeof(x)<>'object' or nullif(btrim(x->>'employee_code'),'') is null
      or x ?| array['salary','salary_review_date','gender','gender_detail','has_children','optional_data_declared'])
    or (select count(distinct btrim(x->>'employee_code')) from jsonb_array_elements(p_fields) x)<>jsonb_array_length(p_fields) then
    raise exception using errcode='22023',message='Códigos inválidos ou campos fora da prévia.';
  end if;

  with incoming as (
    select value, ordinality, btrim(value->>'employee_code') as code
    from jsonb_array_elements(p_fields) with ordinality
  ), classified as (
    select i.ordinality, i.code, m.updated_at, p.updated_at as private_updated_at,
      case when m.id is null then 'new' when m.archived_at is not null then 'reactivated'
        when to_jsonb(m) @> i.value then 'unchanged' else 'changed' end as kind,
      case when i.value ? 'manager_code' then i.value->>'manager_code' else m.manager_code end as manager
    from incoming i left join cali_workspace.team_members m
      on m.company_id=p_company_id and m.employee_code=i.code
    left join cali_workspace.team_member_private p on p.company_id=p_company_id and p.member_id=m.id
  )
  select jsonb_build_object(
    'rows', (select jsonb_agg(jsonb_build_object('code',c.code,'expectedAt',c.updated_at,
      'privateExpectedAt',c.private_updated_at,'kind',c.kind,'managerValid',
      c.manager is null or (c.manager<>c.code and (
        exists (select 1 from incoming g where g.code=c.manager) or exists (
          select 1 from cali_workspace.team_members g
          where g.company_id=p_company_id and g.employee_code=c.manager and g.archived_at is null
        )
      ))) order by c.ordinality) from classified c),
    'absent', (select count(*) from cali_workspace.team_members m where m.company_id=p_company_id
      and m.archived_at is null and not exists(select 1 from incoming i where i.code=m.employee_code))
  ) into result;
  return result;
end;
$$;

create function cali_workspace.v2_confirm_pilot_team_import(
  p_company_id uuid,p_month date,p_rows jsonb,p_private_rows jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
  item jsonb;
  target uuid;
  original cali_workspace.team_member_private;
  fields jsonb;
  allowed constant text[] := array['salary','salary_review_date','gender','gender_detail','has_children'];
begin
  if p_private_rows is null or jsonb_typeof(p_private_rows)<>'array'
    or p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception using errcode='22023',message='Importação inválida.';
  end if;
  if jsonb_array_length(p_private_rows)>jsonb_array_length(p_rows)
    or (select count(distinct x->>'code') from jsonb_array_elements(p_private_rows) x)<>jsonb_array_length(p_private_rows) then
    raise exception using errcode='22023',message='Códigos de dados privados inválidos.';
  end if;
  result := cali_workspace.v2_save_pilot_team(p_company_id,p_month,p_rows);
  for item in select value from jsonb_array_elements(p_private_rows) loop
    fields := item->'fields';
    if jsonb_typeof(item)<>'object' or not (item ?& array['code','expectedAt','declared','fields'])
      or item - array['code','expectedAt','declared','fields'] <> '{}'::jsonb
      or item->'declared' is distinct from 'true'::jsonb
      or jsonb_typeof(fields) is distinct from 'object' or fields - allowed <> '{}'::jsonb
      or not exists (select 1 from jsonb_array_elements(p_rows) row
        where row->'fields'->>'employee_code'=item->>'code') then
      raise exception using errcode='22023',message='Dados privados não correspondem ao lote declarado.';
    end if;
    select id into strict target from cali_workspace.team_members
      where company_id=p_company_id and employee_code=item->>'code';
    select * into original from cali_workspace.team_member_private
      where member_id=target and company_id=p_company_id for update;
    fields := jsonb_build_object('salary',original.salary,'salary_review_date',original.salary_review_date,
      'gender',original.gender,'gender_detail',original.gender_detail,'has_children',original.has_children) || fields;
    perform cali_workspace.v2_write_pilot_team_private(p_company_id,target,
      (item->>'expectedAt')::timestamptz,true,fields);
  end loop;
  return result;
end;
$$;

revoke all on function cali_workspace.v2_preview_pilot_team_import(uuid,jsonb),
  cali_workspace.v2_confirm_pilot_team_import(uuid,date,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_preview_pilot_team_import(uuid,jsonb),
  cali_workspace.v2_confirm_pilot_team_import(uuid,date,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
