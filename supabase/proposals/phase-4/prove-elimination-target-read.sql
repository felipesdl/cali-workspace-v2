-- Fixture descartável com a forma das relações consultadas. Nunca usar em staging.
create schema cali_workspace;
create schema cali_session_guard;
create schema storage;
create table cali_workspace.companies(id uuid primary key,status text,closed_at timestamptz,data_eliminated_at timestamptz);
create table storage.objects(id uuid primary key,bucket_id text,name text,version text,unique(bucket_id,name));
create function cali_workspace.company_elimination_ready(uuid)
returns boolean language sql stable as $$
  select exists(select 1 from cali_workspace.companies c where c.id=$1 and c.status='closed'
    and c.closed_at<=now()-interval '45 days' and c.data_eliminated_at is null);
$$;
\ir elimination-target-read.sql
do $$
declare
  company_a uuid:=gen_random_uuid();
  object_id uuid:=gen_random_uuid();
  replacement_id uuid:=gen_random_uuid();
  closed_at timestamptz:=now()-interval '46 days';
  bucket constant text:='cali-workspace-private';
  object_path constant text:='qa/document.pdf';
begin
  insert into cali_workspace.companies values(company_a,'closed',closed_at,null);
  insert into storage.objects values(object_id,bucket,object_path,'v1');
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,'v1')='same_object';
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,'v2')='object_changed';
  update storage.objects set name='qa/moved.pdf' where id=object_id;
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,'v1')='object_changed';
  delete from storage.objects where id=object_id;
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,'v1')='absent_at_check';
  insert into storage.objects values(replacement_id,bucket,object_path,'v1');
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,'v1')='object_changed';
  update cali_workspace.companies set status='active' where id=company_a;
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,replacement_id,'v1')='company_changed';
  update cali_workspace.companies c set status='closed',closed_at=c.closed_at+interval '1 minute' where id=company_a;
  assert cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,replacement_id,'v1')='company_changed';
  begin
    perform cali_session_guard.phase4_check_elimination_target(company_a,closed_at,bucket,object_path,object_id,null);
    raise exception 'Versão ausente aceita';
  exception when invalid_parameter_value then null; end;
  assert not has_function_privilege('authenticated',
    'cali_session_guard.phase4_check_elimination_target(uuid,timestamptz,text,text,uuid,text)','execute');
end;
$$;
