-- Aplicar na mesma instância após o ensaio e antes de remover as fixtures restantes.
drop trigger if exists cali_qa_elimination_insert on storage.objects;
drop trigger if exists cali_qa_elimination_update on storage.objects;
drop trigger if exists cali_qa_elimination_delete on storage.objects;
drop function cali_storage_fence_qa.arm(text,text,uuid,text);
drop function cali_storage_fence_qa.attach(text);
drop function cali_storage_fence_qa.guard_object();
drop function cali_storage_fence_qa.lock_path(text,text);
drop table cali_storage_fence_qa.targets;
drop schema cali_storage_fence_qa;
