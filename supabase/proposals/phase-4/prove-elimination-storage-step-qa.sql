-- A primeira reserva fica obsoleta após a perda da resposta do transporte.
do $$
declare
  bucket constant text:='qa-delete-version-0123456789abcdef0123';
  key constant text:='plano.pdf';
  object_id uuid:=gen_random_uuid();
  company uuid:=gen_random_uuid();
  job uuid:=gen_random_uuid();
  previous uuid;
  step cali_phase4_elimination_qa.steps;
begin
  insert into storage.objects values(object_id,bucket,key,'v1');
  perform cali_phase4_elimination_qa.prepare(job,company,
    '{"operational_content":"remove","exclusive_files":"remove","client_identity":"deidentify_and_revoke",
      "company_record":"minimize","billing":"preserve","audit_and_privacy_requests":"preserve","synthetic_assessments":"remove"}',
    jsonb_build_object('drive',gen_random_uuid(),'email',gen_random_uuid(),'portal_mapa',gen_random_uuid(),'backup_acervo',gen_random_uuid()),
    array[object_id],gen_random_uuid());
  perform cali_phase4_elimination_qa.freeze_storage_target(job,company,5,bucket,key,'v1');
  for i in 1..4 loop
    step:=cali_phase4_elimination_qa.claim(job,company);
    perform cali_phase4_elimination_qa.record_result(job,company,i,step.lease_id,'not_applicable',null);
  end loop;
  step:=cali_phase4_elimination_qa.claim(job,company);
  previous:=step.lease_id;
  update storage.objects set version='v2' where id=object_id;
  begin
    perform cali_phase4_elimination_qa.arm_storage_step(job,company,5,previous);
    raise exception 'Substituto aceito pelo plano';
  exception when serialization_failure then null; end;
  update storage.objects set version='v1' where id=object_id;
  assert cali_phase4_elimination_qa.arm_storage_step(job,company,5,previous)->>'path'=key;
  begin
    perform cali_phase4_elimination_qa.confirm_storage_step(job,company,5,previous);
    raise exception 'Recibo aceito com objeto presente';
  exception when serialization_failure then null; end;
  delete from storage.objects where id=object_id;
  update cali_phase4_elimination_qa.steps set lease_until=clock_timestamp()-interval '1 second'
    where job_id=job and position=5;
  step:=cali_phase4_elimination_qa.claim(job,company);
  assert step.lease_id<>previous and step.position=5;
  begin
    perform cali_phase4_elimination_qa.confirm_storage_step(job,company,5,previous);
    raise exception 'Reserva expirada aceitou recibo';
  exception when serialization_failure then null; end;
  perform cali_phase4_elimination_qa.confirm_storage_step(job,company,5,step.lease_id);
  perform cali_phase4_elimination_qa.confirm_storage_step(job,company,5,step.lease_id);
  step:=cali_phase4_elimination_qa.claim(job,company);
  assert step.kind='database';
end;
$$;
