-- DEC-09: projeção privada por ficha. As policies das tabelas legadas continuam separadas.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_read_pilot_team_private(p_company_id uuid,p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  return (
    select jsonb_build_object('member_id',m.id,'company_id',m.company_id,'updated_at',p.updated_at,
      'salary',p.salary,'salary_review_date',p.salary_review_date,'gender',p.gender,
      'gender_detail',p.gender_detail,'has_children',p.has_children)
    from cali_workspace.team_members m
    left join cali_workspace.team_member_private p on p.member_id=m.id and p.company_id=m.company_id
    where m.id=p_member_id and m.company_id=p_company_id
  );
end;
$$;

create function cali_workspace.v2_write_pilot_team_private(
  p_company_id uuid,p_member_id uuid,p_expected_at timestamptz,p_declared boolean,p_fields jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_write(p_company_id,
    date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date);
  member cali_workspace.team_members;
  original cali_workspace.team_member_private;
  proposed cali_workspace.team_member_private;
  permitted constant text[] := array['salary','salary_review_date','gender','gender_detail','has_children'];
begin
  if p_declared is distinct from true or p_fields is null or jsonb_typeof(p_fields)<>'object'
    or not (p_fields ?& permitted) or p_fields - permitted <> '{}'::jsonb then
    raise exception using errcode='22023',message='Confirme a origem autorizada e confira os dados privados.';
  end if;

  select * into member from cali_workspace.team_members
    where id=p_member_id and company_id=p_company_id and archived_at is null for update;
  if not found then
    raise exception using errcode='42501',message='Ficha indisponível para edição.';
  end if;
  select * into original from cali_workspace.team_member_private
    where member_id=p_member_id and company_id=p_company_id for update;
  if original.updated_at is distinct from p_expected_at then
    raise exception using errcode='40001',message='A ficha privada mudou. Recarregue antes de salvar.';
  end if;
  select * into proposed from jsonb_populate_record(original,p_fields);
  proposed.gender_detail := case when proposed.gender='other' then nullif(btrim(proposed.gender_detail),'') end;
  if (proposed.salary is not null and not (proposed.salary between 0 and 9999999999.99))
    or proposed.gender not in ('female','male','other','prefer_not')
    or length(proposed.gender_detail)>120
    or proposed.has_children not in ('yes','no','prefer_not') then
    raise exception using errcode='22023',message='Confira os valores da ficha privada.';
  end if;

  if to_jsonb(proposed)-array['member_id','company_id','updated_at'] is not distinct from
      to_jsonb(original)-array['member_id','company_id','updated_at']
    or (original.member_id is null and proposed.salary is null and proposed.salary_review_date is null
      and proposed.gender is null and proposed.has_children is null) then
    return p_member_id;
  end if;
  insert into cali_workspace.team_member_private(member_id,company_id,salary,salary_review_date,gender,gender_detail,has_children,updated_at)
    values(p_member_id,p_company_id,proposed.salary,proposed.salary_review_date,proposed.gender,
      proposed.gender_detail,proposed.has_children,clock_timestamp())
  on conflict(member_id) do update set salary=excluded.salary,salary_review_date=excluded.salary_review_date,
    gender=excluded.gender,gender_detail=excluded.gender_detail,has_children=excluded.has_children,updated_at=excluded.updated_at
  where team_member_private.company_id=excluded.company_id;
  if not found then
    raise exception using errcode='42501',message='Ficha indisponível para edição.';
  end if;

  -- O trigger legado audita salário, gênero e filhos e também deriva o avatar.
  -- A escrita V2 preserva o avatar anterior na mesma transação.
  update cali_workspace.team_members set avatar_style=member.avatar_style
  where id=p_member_id and company_id=p_company_id and avatar_style is distinct from member.avatar_style;
  if original.salary_review_date is distinct from proposed.salary_review_date then
    insert into cali_workspace.team_private_audit(member_id,company_id,actor_user_id,changed_fields)
    values(p_member_id,p_company_id,actor,array['salary_review_date']);
  end if;
  return p_member_id;
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_team_private(uuid,uuid),
  cali_workspace.v2_write_pilot_team_private(uuid,uuid,timestamptz,boolean,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_team_private(uuid,uuid),
  cali_workspace.v2_write_pilot_team_private(uuid,uuid,timestamptz,boolean,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
