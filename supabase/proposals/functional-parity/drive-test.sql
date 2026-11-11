-- PostgreSQL descartável. As dependências de Auth, Storage e Documentos são fixtures.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema storage;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to anon,authenticated,service_role;

create function auth.uid() returns uuid language sql stable as $$
  select '10000000-0000-4000-8000-000000000001'::uuid;
$$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable as $$
  select '{"accepted":true}'::jsonb;
$$;
create function cali_workspace.client_can_view_deliverable(p_delivery uuid) returns boolean
language sql stable as $$ select p_delivery='10000000-0000-4000-8000-000000000010'::uuid; $$;
create function cali_session_guard.phase4_delivery_pdf_visible(p_company uuid,p_delivery uuid) returns boolean
language sql stable as $$ select cali_workspace.client_can_view_deliverable(p_delivery); $$;
create table cali_workspace.profiles(id uuid, company_id uuid, role text, active boolean);
create table cali_workspace.drive_connections(
  id uuid, company_id uuid, owner_type text, status text, google_account_id text
);
create table cali_workspace.files(
  id uuid, company_id uuid, status text, client_visible boolean, storage_path text,
  updated_at timestamptz, original_filename text, title text, file_type text, deliverable_id uuid
);
create table cali_workspace.deliverables(id uuid,company_id uuid,title text);
create table cali_session_guard.phase4_documents(id uuid,company_id uuid,title text,delivery_id uuid,published_revision uuid);
create table cali_session_guard.phase4_document_revisions(id uuid,document_id uuid,file_name text);
create table storage.objects(bucket_id text, name text, updated_at timestamptz);

insert into cali_workspace.profiles values
  ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','client',true);
insert into cali_workspace.drive_connections values
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','client','connected','old-account');
insert into cali_workspace.files values
  ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','published',true,'report.pdf',now(),null,'Arquivo antigo','application/pdf',null),
  ('10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006','published',true,'other.pdf',now(),null,'Outra empresa','application/pdf',null),
  ('10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','published',true,'previous.pdf',now(),null,'Versão antiga','application/pdf',null),
  ('10000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000002','published',true,'hidden.pdf',now(),null,'Entregável oculto','application/pdf','10000000-0000-4000-8000-000000000011');
insert into storage.objects select 'cali-workspace-private',storage_path,now() from cali_workspace.files;
insert into cali_workspace.deliverables values
  ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','Pasta publicada');
insert into cali_session_guard.phase4_documents values
  ('10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','PDF V2','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000008');
insert into cali_session_guard.phase4_document_revisions values
  ('10000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000007','v2.pdf');

\ir drive.sql

set role authenticated;
do $$
declare
  files jsonb := cali_workspace.v2_list_drive_sources(1);
  folder uuid := '10000000-0000-4000-8000-000000000010';
  document uuid := '10000000-0000-4000-8000-000000000007';
  legacy uuid := '10000000-0000-4000-8000-000000000004';
  forbidden uuid;
begin
  assert jsonb_array_length(files)=2;
  assert files @> '[{"title":"Arquivo antigo","source":"legacy"},{"title":"PDF V2","source":"document"}]';
  assert cali_workspace.v2_list_drive_sources(1,folder) @> '[{"deliveryTitle":"Pasta publicada","source":"document"}]';
  assert cali_workspace.v2_read_drive_source(document,'document')->>'revisionId'='10000000-0000-4000-8000-000000000008';
  perform set_config('cali_test.version',cali_workspace.v2_read_drive_source(legacy,'legacy')->>'version',false);
  foreach forbidden in array array['10000000-0000-4000-8000-000000000005'::uuid,document,'10000000-0000-4000-8000-000000000009'::uuid] loop
    begin
      perform cali_workspace.v2_read_drive_source(forbidden,'legacy');
      raise exception 'Origem cruzada, substituída ou oculta aceita';
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

update cali_session_guard.phase4_documents set published_revision=null;
set role authenticated;
do $$
begin
  assert jsonb_array_length(cali_workspace.v2_list_drive_sources(1))=1;
end $$;
reset role;

set role service_role;
do $$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  connection uuid := '10000000-0000-4000-8000-000000000003';
  legacy uuid := '10000000-0000-4000-8000-000000000004';
  claim jsonb;
begin
  claim := cali_workspace.v2_drive_copy(actor,'claim',legacy,connection,'old-account',current_setting('cali_test.version'));
  assert claim->>'done'='false';
  perform set_config('cali_test.old_lease',claim->>'lease',false);
end $$;
reset role;

update cali_workspace.drive_connections set google_account_id='new-account';

set role service_role;
do $$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  connection uuid := '10000000-0000-4000-8000-000000000003';
  legacy uuid := '10000000-0000-4000-8000-000000000004';
  version text := current_setting('cali_test.version');
  old_lease uuid := current_setting('cali_test.old_lease')::uuid;
  new_lease uuid;
begin
  begin
    perform cali_workspace.v2_drive_copy(actor,'reserve',legacy,connection,'old-account',version,old_lease,'provider_old');
    raise exception 'Operação antiga aceita após trocar a conta';
  exception when insufficient_privilege then null;
  end;
  new_lease := (cali_workspace.v2_drive_copy(actor,'claim',legacy,connection,'new-account',version)->>'lease')::uuid;
  assert old_lease <> new_lease;
  perform cali_workspace.v2_drive_copy(actor,'reserve',legacy,connection,'new-account',version,new_lease,'provider_new');
  perform cali_workspace.v2_drive_copy(actor,'complete',legacy,connection,'new-account',version,new_lease);
  assert cali_workspace.v2_drive_copy(actor,'claim',legacy,connection,'new-account',version)->>'url'=
    'https://drive.google.com/file/d/provider_new/view';
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('authenticated','cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text)','EXECUTE');
  assert not has_function_privilege('anon','cali_workspace.v2_list_drive_sources(integer,uuid)','EXECUTE');
  assert not has_table_privilege('authenticated','cali_session_guard.drive_copies','SELECT');
end $$;
