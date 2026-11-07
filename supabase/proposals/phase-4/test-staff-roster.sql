create table cali_workspace.staff_members (
  id uuid primary key, full_name text, email text, active boolean not null,
  modules text[], accepted_at timestamptz, invited_at timestamptz, user_id uuid
);
create table cali_workspace.staff_company_assignments (
  staff_id uuid references cali_workspace.staff_members(id),company_id uuid,assigned_at timestamptz,
  primary key(staff_id,company_id)
);
\ir staff-roster-read.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member_a uuid:=gen_random_uuid();
  member_b uuid:=gen_random_uuid();
  payload jsonb;
begin
  insert into cali_workspace.staff_members values
    (member_a,'Equipe A','a@example.invalid',true,array['projects'],now(),now(),gen_random_uuid()),
    (member_b,'Equipe B','b@example.invalid',false,array['hours'],null,now(),null);
  insert into cali_workspace.staff_company_assignments values(member_a,a,now()),(member_b,b,now());
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_staff_roster(a,1);
    raise exception 'Consulta sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_staff_roster(a,1);
    raise exception 'Consulta por Cliente';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  payload:=cali_workspace.v2_read_pilot_staff_roster(a,1);
  assert payload->>'total'='1' and payload#>>'{entries,0,name}'='Equipe A';
  assert payload#>>'{entries,0,invitation}'='accepted';
  assert payload::text not like '%example.invalid%' and payload::text not like '%Equipe B%';
  assert cali_workspace.v2_read_pilot_staff_roster(a,2)->'entries'='[]'::jsonb;
  assert cali_workspace.v2_read_pilot_staff_roster(b,1)#>>'{entries,0,invitation}'='invited';
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_staff_roster(uuid,integer)','EXECUTE');
end;
$$;
rollback;
\echo Fase 4E: Equipe CALI limitada à empresa e a Admin com MFA.
