-- Executar apenas em PostgreSQL descartável. Auth e catálogo de origem são fixtures.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema storage;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to anon,authenticated;

create function auth.uid() returns uuid language sql stable as $$
  select '10000000-0000-4000-8000-000000000001'::uuid;
$$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable as $$
  select '{"accepted":true}'::jsonb;
$$;
create table cali_workspace.profiles(id uuid, company_id uuid, role text, active boolean);
create table cali_workspace.drive_connections(
  id uuid, company_id uuid, owner_type text, status text, google_account_id text
);
create table cali_workspace.files(
  id uuid, company_id uuid, status text, client_visible boolean, storage_path text,
  updated_at timestamptz, original_filename text, title text, file_type text, deliverable_id uuid
);
create table storage.objects(bucket_id text, name text, updated_at timestamptz);

insert into cali_workspace.profiles values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','client',true);
insert into cali_workspace.drive_connections values
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','client','connected','old-account');
insert into cali_workspace.files values
  ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','published',true,'report.pdf',now(),null,'Relatório','application/pdf',null),
  ('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006','published',true,'other.pdf',now(),null,'Outro relatório','application/pdf',null);

\ir drive.sql

set role authenticated;
do $$
declare
  connection_id uuid := '10000000-0000-4000-8000-000000000003';
  file_id uuid := '10000000-0000-4000-8000-000000000004';
  other_file uuid := '10000000-0000-4000-8000-000000000005';
  claim jsonb;
begin
  claim := cali_workspace.v2_drive_copy('claim',file_id,connection_id,'old-account');
  assert claim->>'done' = 'false';
  perform set_config('cali_test.old_lease',claim->>'lease',false);

  begin
    perform cali_workspace.v2_drive_copy('claim',other_file,connection_id,'old-account');
    raise exception 'Arquivo de outra empresa aceito';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

update cali_workspace.drive_connections set google_account_id='new-account';

set role authenticated;
do $$
declare
  connection_id uuid := '10000000-0000-4000-8000-000000000003';
  file_id uuid := '10000000-0000-4000-8000-000000000004';
  old_lease uuid := current_setting('cali_test.old_lease')::uuid;
  new_lease uuid;
begin
  begin
    perform cali_workspace.v2_drive_copy('reserve',file_id,connection_id,'old-account',old_lease,'provider_old');
    raise exception 'Operação antiga aceita após trocar a conta';
  exception when insufficient_privilege then null;
  end;

  new_lease := (cali_workspace.v2_drive_copy('claim',file_id,connection_id,'new-account')->>'lease')::uuid;
  assert old_lease <> new_lease;
  perform cali_workspace.v2_drive_copy('reserve',file_id,connection_id,'new-account',new_lease,'provider_new');
  perform cali_workspace.v2_drive_copy('complete',file_id,connection_id,'new-account',new_lease);
  assert cali_workspace.v2_drive_copy('claim',file_id,connection_id,'new-account')->>'url' =
    'https://drive.google.com/file/d/provider_new/view';
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('anon','cali_workspace.v2_drive_copy(text,uuid,uuid,text,uuid,text)','EXECUTE');
  assert not has_table_privilege('authenticated','cali_session_guard.drive_copies','SELECT');
end $$;
