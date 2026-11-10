create table cali_workspace.staff_members (
  id uuid primary key, full_name text, email text, active boolean not null,
  modules text[], accepted_at timestamptz, invited_at timestamptz default now(), user_id uuid, invited_by uuid,
  updated_at timestamptz not null default clock_timestamp()
);
create table cali_workspace.staff_company_assignments (
  staff_id uuid references cali_workspace.staff_members(id),company_id uuid,assigned_at timestamptz,
  primary key(staff_id,company_id)
);
\ir staff-roster-read.sql
\ir staff-roster-write.sql
\ir staff-roster-activation.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member_a uuid:=gen_random_uuid();
  member_b uuid:=gen_random_uuid();
  payload jsonb;
  draft uuid:=gen_random_uuid();
  change uuid:=gen_random_uuid();
  revision timestamptz;
  next_revision timestamptz;
  activate uuid:=gen_random_uuid();
begin
  insert into cali_workspace.staff_members(id,full_name,email,active,modules,accepted_at,invited_at,user_id) values
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
  assert cali_workspace.v2_save_pilot_staff_draft(a,draft,null,null,'Pessoa QA',array['hours'],false)=draft;
  assert cali_workspace.v2_save_pilot_staff_draft(a,draft,null,null,'Pessoa QA',array['hours'],false)=draft;
  select (item->>'draftRevision')::timestamptz into strict revision
  from jsonb_array_elements(cali_workspace.v2_read_pilot_staff_roster(a,1)->'entries') item
  where item->>'id'=draft::text and item->>'invitation'='not_invited';
  begin
    perform cali_workspace.v2_save_pilot_staff_draft(b,gen_random_uuid(),draft,revision,'Pessoa QA',array['hours'],false);
    raise exception 'Alteração cruzada aceita';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_save_pilot_staff_draft(a,change,draft,revision,'Pessoa QA 2',array['projects'],false)=draft;
  begin
    perform cali_workspace.v2_save_pilot_staff_draft(a,gen_random_uuid(),draft,revision,'Pessoa QA 3',array['hours'],false);
    raise exception 'Edição obsoleta aceita';
  exception when serialization_failure then null; end;
  select (item->>'draftRevision')::timestamptz into strict next_revision
  from jsonb_array_elements(cali_workspace.v2_read_pilot_staff_roster(a,1)->'entries') item where item->>'id'=draft::text;
  begin
    perform cali_workspace.v2_set_pilot_staff_active(b,gen_random_uuid(),draft,next_revision,true);
    raise exception 'Ativação cruzada aceita';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_set_pilot_staff_active(a,activate,draft,next_revision,true)=draft;
  assert cali_workspace.v2_set_pilot_staff_active(a,activate,draft,next_revision,true)=draft;
  begin
    perform cali_workspace.v2_set_pilot_staff_active(a,gen_random_uuid(),draft,next_revision,false);
    raise exception 'Ativação obsoleta aceita';
  exception when serialization_failure then null; end;
  select (item->>'activationRevision')::timestamptz into strict revision
  from jsonb_array_elements(cali_workspace.v2_read_pilot_staff_roster(a,1)->'entries') item
  where item->>'id'=draft::text and (item->>'active')::boolean and item->>'draftRevision' is null;
  assert cali_workspace.v2_set_pilot_staff_active(a,gen_random_uuid(),draft,revision,false)=draft;
  select (item->>'draftRevision')::timestamptz into strict next_revision
  from jsonb_array_elements(cali_workspace.v2_read_pilot_staff_roster(a,1)->'entries') item where item->>'id'=draft::text;
  assert cali_workspace.v2_save_pilot_staff_draft(a,gen_random_uuid(),draft,next_revision,null,null,true)=draft;
  assert cali_workspace.v2_read_pilot_staff_roster(a,1)->>'total'='1';
  reset role;
  assert exists(select 1 from cali_workspace.staff_members where id=draft and not active and user_id is null);
  assert (select count(*) from cali_workspace.activity_log where entity_id=draft)=5;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_staff_roster(uuid,integer)','EXECUTE');
end;
$$;
rollback;
\echo Fase 4E: Equipe CALI limitada à empresa e a Admin com MFA.
drop function cali_workspace.v2_set_pilot_staff_active(uuid,uuid,uuid,timestamptz,boolean);
\ir rollback-staff-roster-write.sql
