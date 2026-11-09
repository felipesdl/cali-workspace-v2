-- Prova com transportes fictícios. Os COMMITs marcados são exclusivos do PostgreSQL descartável.
create temp table elimination_fixture (
  job uuid not null, company_a uuid not null, company_b uuid not null,
  external_id uuid not null, first_file uuid not null, second_file uuid not null,
  control_file uuid not null, row_id uuid not null, control_row uuid not null, lost_lease uuid
);
insert into elimination_fixture
select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
  gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),null;
create temp table elimination_fake_storage(id uuid primary key,company_id uuid not null);
create temp table elimination_fake_database(id uuid primary key,company_id uuid not null);
insert into elimination_fake_storage
select first_file,company_a from elimination_fixture union all select second_file,company_a from elimination_fixture
union all select control_file,company_b from elimination_fixture;
insert into elimination_fake_database
select row_id,company_a from elimination_fixture union all select control_row,company_b from elimination_fixture;

do $$
declare
  qa elimination_fixture;
  step cali_phase4_elimination_qa.steps;
begin
  select * into strict qa from elimination_fixture;
  perform cali_phase4_elimination_qa.prepare(qa.job,qa.company_a,qa.external_id,array[qa.first_file,qa.second_file],qa.row_id);
  begin
    perform cali_phase4_elimination_qa.claim(qa.job,qa.company_b);
    raise exception 'Outra empresa recebeu a tarefa';
  exception when insufficient_privilege then null; end;

  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='external' and step.resource_id=qa.external_id;
  assert cali_phase4_elimination_qa.claim(qa.job,qa.company_a) is null;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,null,'transport_unavailable');
  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='external' and step.attempts=2;
  assert (select count(*) from elimination_fake_storage)=3;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'not_applicable',null);

  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='storage' and step.resource_id=qa.first_file;
  delete from elimination_fake_storage where id=step.resource_id and company_id=qa.company_a;
  assert found;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'removed',null);
  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='storage' and step.resource_id=qa.second_file;
  delete from elimination_fake_storage where id=step.resource_id and company_id=qa.company_a;
  assert found;
  update elimination_fixture set lost_lease=step.lease_id;
  -- Transporte concluiu, mas o processo caiu antes de gravar o recibo.
end;
$$;

commit; begin; -- LOCAL_BOUNDARY

do $$
declare
  qa elimination_fixture;
  step cali_phase4_elimination_qa.steps;
begin
  select * into strict qa from elimination_fixture;
  assert (select completed_at from cali_phase4_elimination_qa.jobs where id=qa.job) is null;
  assert not exists(select 1 from elimination_fake_storage where company_id=qa.company_a);
  assert exists(select 1 from elimination_fake_database where id=qa.row_id);
  assert cali_phase4_elimination_qa.claim(qa.job,qa.company_a) is null;
  update cali_phase4_elimination_qa.steps set lease_until=clock_timestamp()-interval '1 second'
  where job_id=qa.job and lease_id=qa.lost_lease;
  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.resource_id=qa.second_file and step.attempts=2 and step.lease_id<>qa.lost_lease;
  begin
    perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,qa.lost_lease,'removed',null);
    raise exception 'Reserva antiga aceitou o recibo';
  exception when serialization_failure then null; end;
  assert not exists(select 1 from elimination_fake_storage where id=step.resource_id);
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'already_absent',null);

  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='database' and step.resource_id=qa.row_id;
  begin
    delete from elimination_fake_database where id=step.resource_id and company_id=qa.company_a;
    assert found;
    perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'committed',null);
    raise exception using errcode='P0401',message='Falha simulada antes do commit do banco';
  exception when sqlstate 'P0401' then null; end;
  assert exists(select 1 from elimination_fake_database where id=qa.row_id);
  assert (select completed_at from cali_phase4_elimination_qa.jobs where id=qa.job) is null;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,null,'database_failed');
end;
$$;

commit; begin; -- LOCAL_BOUNDARY

do $$
declare
  qa elimination_fixture;
  step cali_phase4_elimination_qa.steps;
  finished timestamptz;
begin
  select * into strict qa from elimination_fixture;
  step:=cali_phase4_elimination_qa.claim(qa.job,qa.company_a);
  assert step.kind='database' and step.resource_id=qa.row_id and step.attempts=2 and step.last_failure='database_failed';
  delete from elimination_fake_database where id=step.resource_id and company_id=qa.company_a;
  assert found;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'committed',null);
  select completed_at into strict finished from cali_phase4_elimination_qa.jobs where id=qa.job;
  assert finished is not null;
  perform cali_phase4_elimination_qa.record_result(qa.job,qa.company_a,step.position,step.lease_id,'committed',null);
  assert (select completed_at from cali_phase4_elimination_qa.jobs where id=qa.job)=finished;
  assert cali_phase4_elimination_qa.claim(qa.job,qa.company_a) is null;
  assert not exists(select 1 from elimination_fake_database where id=qa.row_id);
  assert exists(select 1 from elimination_fake_database where id=qa.control_row and company_id=qa.company_b);
  assert exists(select 1 from elimination_fake_storage where id=qa.control_file and company_id=qa.company_b);
  assert (select attempts=1 and receipt='removed' from cali_phase4_elimination_qa.steps
    where job_id=qa.job and resource_id=qa.first_file);
  assert not has_schema_privilege('authenticated','cali_phase4_elimination_qa','USAGE');
  assert not has_function_privilege('service_role','cali_phase4_elimination_qa.claim(uuid,uuid)','EXECUTE');
end;
$$;
