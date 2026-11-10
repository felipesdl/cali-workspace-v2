\set cali_keep_team_maintenance 1
\ir test-maintenance.sql
\unset cali_keep_team_maintenance
\ir private-fields.sql
do $$
declare
  company constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  other constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  member constant uuid := '10000000-0000-4000-8000-000000000002';
  payload constant jsonb := '{"salary":1000,"salary_review_date":"2026-10-01","gender":"female","gender_detail":null,"has_children":"no"}';
  private jsonb;
begin
  set local role authenticated;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  begin
    perform cali_workspace.v2_read_pilot_team_private(other,member);
    raise exception 'Cliente leu dados privados de outra empresa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_write_pilot_team_private(company,member,null,false,payload);
    raise exception 'Dados privados gravados sem declaração';
  exception when invalid_parameter_value then null;
  end;
  perform cali_workspace.v2_write_pilot_team_private(company,member,null,true,payload);
  private := cali_workspace.v2_read_pilot_team_private(company,member);
  if private->>'gender' is distinct from 'female' or (private->>'salary')::numeric is distinct from 1000
    or cali_workspace.v2_read_pilot_team_member(company,member) ?| array['salary','gender','avatar_style']
  then raise exception 'Projeção privada inválida'; end if;
  begin
    perform cali_workspace.v2_write_pilot_team_private(company,member,null,true,payload);
    raise exception 'Ficha privada foi sobrescrita sem preimagem';
  exception when serialization_failure then null;
  end;
  reset role;
  if (select avatar_style from cali_workspace.team_members where id=member)<>'neutral'
    or (select count(*) from cali_workspace.team_private_audit where member_id=member and changed_fields=array['salary_review_date'])<>1 then
    raise exception 'Avatar profissional ou trilha privada incorretos';
  end if;
end;
$$;
\if :{?cali_keep_team_private}
\else
\ir rollback-private-fields.sql
\ir rollback-maintenance.sql
\ir rollback-directory.sql
\endif
