-- Liga um passo do plano fictício à trava de versão do bucket de ensaio.
create table cali_phase4_elimination_qa.storage_targets (
  job_id uuid not null,
  position integer not null,
  bucket text not null check (bucket ~ '^qa-delete-version-[0-9a-f]{20}$'),
  path text not null check (nullif(btrim(path),'') is not null),
  object_version text not null check (nullif(btrim(object_version),'') is not null),
  primary key(job_id,position),
  foreign key(job_id,position) references cali_phase4_elimination_qa.steps(job_id,position)
);

create function cali_phase4_elimination_qa.freeze_storage_target(
  p_job uuid,p_company uuid,p_position integer,p_bucket text,p_path text,p_version text
)
returns void language plpgsql set search_path=''
as $$
begin
  perform 1 from cali_phase4_elimination_qa.jobs j where j.id=p_job and j.company_id=p_company for update;
  if not found or exists(select 1 from cali_phase4_elimination_qa.steps s where s.job_id=p_job and s.attempts>0)
    or not exists(select 1 from cali_phase4_elimination_qa.steps s
      where s.job_id=p_job and s.position=p_position and s.kind='storage') then
    raise exception using errcode='42501',message='Alvo do plano de ensaio indisponível.';
  end if;
  insert into cali_phase4_elimination_qa.storage_targets values(p_job,p_position,p_bucket,p_path,p_version);
end;
$$;

-- O executor recebe somente o alvo congelado e autorizado pela reserva corrente.
create function cali_phase4_elimination_qa.arm_storage_step(
  p_job uuid,p_company uuid,p_position integer,p_lease uuid
)
returns jsonb language plpgsql set search_path=''
as $$
declare
  target record;
begin
  perform 1 from cali_phase4_elimination_qa.jobs j where j.id=p_job and j.company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Ensaio indisponível.'; end if;
  select t.bucket,t.path,t.object_version,s.resource_id into target
  from cali_phase4_elimination_qa.storage_targets t
  join cali_phase4_elimination_qa.steps s using(job_id,position)
  where s.job_id=p_job and s.position=p_position and s.kind='storage'
    and s.lease_id=p_lease and s.lease_until>clock_timestamp() and s.receipt is null;
  if not found then raise exception using errcode='40001',message='Reserva desatualizada.'; end if;
  if not cali_storage_fence_qa.arm(target.bucket,target.path,target.resource_id,target.object_version) then
    raise exception using errcode='40001',message='A versão do arquivo mudou.';
  end if;
  return jsonb_build_object('bucket',target.bucket,'path',target.path);
end;
$$;

-- O resultado depende da trava exata e da ausência do objeto no catálogo.
create function cali_phase4_elimination_qa.confirm_storage_step(
  p_job uuid,p_company uuid,p_position integer,p_lease uuid
)
returns void language plpgsql set search_path=''
as $$
declare
  target jsonb;
begin
  if exists(select 1 from cali_phase4_elimination_qa.steps s
    join cali_phase4_elimination_qa.jobs j on j.id=s.job_id
    where s.job_id=p_job and j.company_id=p_company and s.position=p_position
      and s.kind='storage' and s.lease_id=p_lease and s.receipt='removed') then return; end if;
  target:=cali_phase4_elimination_qa.arm_storage_step(p_job,p_company,p_position,p_lease);
  if exists(select 1 from storage.objects o where o.bucket_id=target->>'bucket' and o.name=target->>'path') then
    raise exception using errcode='40001',message='A remoção ainda não foi confirmada.';
  end if;
  perform cali_phase4_elimination_qa.record_result(p_job,p_company,p_position,p_lease,'removed',null);
end;
$$;

revoke all on table cali_phase4_elimination_qa.storage_targets from public,anon,authenticated,service_role;
revoke all on function cali_phase4_elimination_qa.freeze_storage_target(uuid,uuid,integer,text,text,text),
  cali_phase4_elimination_qa.arm_storage_step(uuid,uuid,integer,uuid),
  cali_phase4_elimination_qa.confirm_storage_step(uuid,uuid,integer,uuid)
  from public,anon,authenticated,service_role;
