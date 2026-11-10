-- Fixtures descartáveis sobre o catálogo simulado do ensaio de alvo.
create table storage.buckets(id text primary key,public boolean not null);
\ir elimination-storage-fence-qa.sql
do $$
declare
  qa_bucket constant text:='qa-delete-version-0123456789abcdef0123';
  other_bucket constant text:='workspace-assets';
  path constant text:='fixture.txt';
  approved_id uuid:=gen_random_uuid();
  replacement_id uuid:=gen_random_uuid();
  control_id uuid:=gen_random_uuid();
begin
  insert into storage.buckets values(qa_bucket,false),(other_bucket,false);
  insert into storage.objects values(approved_id,qa_bucket,path,'v1'),(control_id,other_bucket,path,'v2');
  perform cali_storage_fence_qa.attach(qa_bucket);
  assert not cali_storage_fence_qa.arm(qa_bucket,path,approved_id,'old');
  assert cali_storage_fence_qa.arm(qa_bucket,path,approved_id,'v1');
  begin
    update storage.objects set version='v2' where id=approved_id;
    raise exception 'Sobrescrita de alvo aprovada';
  exception when insufficient_privilege then null; end;
  begin
    update storage.objects set name='moved.txt' where id=approved_id;
    raise exception 'Movimentação de alvo aprovada';
  exception when insufficient_privilege then null; end;

  -- Simula uma aprovação antiga recebida no executor.
  update cali_storage_fence_qa.targets t set object_id=replacement_id where t.bucket=qa_bucket;
  begin
    delete from storage.objects where id=approved_id;
    raise exception 'Exclusão de objeto diferente aprovada';
  exception when insufficient_privilege then null; end;
  update cali_storage_fence_qa.targets t set object_id=approved_id where t.bucket=qa_bucket;
  delete from storage.objects where id=approved_id;
  assert found;
  assert cali_storage_fence_qa.arm(qa_bucket,path,approved_id,'v1');
  begin
    insert into storage.objects values(replacement_id,qa_bucket,path,'v1');
    raise exception 'Recriação de caminho aprovado';
  exception when insufficient_privilege then null; end;
  update storage.objects set version='v3' where id=control_id;
  assert found;
  assert exists(select 1 from storage.objects where id=control_id and version='v3');
  assert not has_function_privilege('service_role','cali_storage_fence_qa.arm(text,text,uuid,text)','execute');
end;
$$;
\ir elimination-storage-step-qa.sql
\ir prove-elimination-storage-step-qa.sql
\ir rollback-elimination-storage-fence-qa.sql
