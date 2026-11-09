-- FLOW-18. Candidata privada para ensaio. Sem integração com dados operacionais.
-- No staging, executar somente na transação de prova encerrada com rollback.
create schema cali_phase4_elimination_qa;
revoke all on schema cali_phase4_elimination_qa from public,anon,authenticated,service_role;

create table cali_phase4_elimination_qa.jobs (
  id uuid primary key,
  company_id uuid not null unique,
  completed_at timestamptz
);

create table cali_phase4_elimination_qa.steps (
  job_id uuid not null references cali_phase4_elimination_qa.jobs(id),
  position integer not null check (position>0),
  kind text not null check (kind in ('external','storage','database')),
  resource_id uuid not null,
  lease_id uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts>=0),
  last_failure text check (last_failure in ('transport_unavailable','database_failed')),
  receipt text check (
    (kind='external' and receipt in ('handled','not_applicable'))
    or (kind='storage' and receipt in ('removed','already_absent'))
    or (kind='database' and receipt='committed')
  ),
  primary key (job_id,position),
  unique (job_id,kind,resource_id),
  check ((lease_id is null)=(lease_until is null)),
  check (receipt is null or lease_id is not null)
);

-- O ensaio congela referências opacas; o inventário real deve ser reconciliado antes da execução.
create function cali_phase4_elimination_qa.prepare(
  p_job uuid,p_company uuid,p_external uuid,p_storage uuid[],p_database uuid
)
returns void language plpgsql set search_path=''
as $$
begin
  if p_external is null or p_database is null or p_storage is null
    or coalesce(array_ndims(p_storage),1)<>1 or cardinality(p_storage)>1000
    or array_position(p_storage,null::uuid) is not null then
    raise exception using errcode='22023',message='Manifesto de ensaio inválido.';
  end if;
  insert into cali_phase4_elimination_qa.jobs(id,company_id) values(p_job,p_company);
  insert into cali_phase4_elimination_qa.steps(job_id,position,kind,resource_id)
  select p_job,1,'external',p_external
  union all
  select p_job,1+idx::integer,'storage',resource
  from unnest(p_storage) with ordinality as objects(resource,idx)
  union all
  select p_job,2+cardinality(p_storage),'database',p_database;
end;
$$;

create function cali_phase4_elimination_qa.claim(p_job uuid,p_company uuid)
returns cali_phase4_elimination_qa.steps language plpgsql set search_path=''
as $$
declare
  step cali_phase4_elimination_qa.steps;
begin
  perform 1 from cali_phase4_elimination_qa.jobs j where j.id=p_job and j.company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Ensaio indisponível.'; end if;
  select * into step from cali_phase4_elimination_qa.steps s
  where s.job_id=p_job and s.receipt is null order by s.position limit 1;
  if not found or step.lease_until>clock_timestamp() then return null; end if;
  update cali_phase4_elimination_qa.steps s
  set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',attempts=s.attempts+1
  where s.job_id=p_job and s.position=step.position returning * into step;
  return step;
end;
$$;

create function cali_phase4_elimination_qa.record_result(
  p_job uuid,p_company uuid,p_position integer,p_lease uuid,p_receipt text,p_failure text
)
returns void language plpgsql set search_path=''
as $$
declare
  step cali_phase4_elimination_qa.steps;
begin
  if (p_receipt is null)=(p_failure is null) or p_lease is null then
    raise exception using errcode='22023',message='Informe recibo ou falha.';
  end if;
  perform 1 from cali_phase4_elimination_qa.jobs j where j.id=p_job and j.company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Ensaio indisponível.'; end if;
  select * into step from cali_phase4_elimination_qa.steps s where s.job_id=p_job and s.position=p_position;
  if not found or step.lease_id is distinct from p_lease then
    raise exception using errcode='40001',message='Reserva desatualizada.';
  end if;
  -- Uma resposta perdida após confirmar o recibo não muda o histórico.
  if step.receipt is not null and step.receipt=p_receipt then return; end if;
  if step.receipt is not null or step.lease_until<=clock_timestamp() then
    raise exception using errcode='40001',message='Reserva desatualizada.';
  end if;
  if p_failure is not null then
    update cali_phase4_elimination_qa.steps s set lease_id=null,lease_until=null,last_failure=p_failure
    where s.job_id=p_job and s.position=p_position;
    return;
  end if;
  update cali_phase4_elimination_qa.steps s set receipt=p_receipt
  where s.job_id=p_job and s.position=p_position;
  if not exists(select 1 from cali_phase4_elimination_qa.steps s where s.job_id=p_job and s.receipt is null) then
    update cali_phase4_elimination_qa.jobs j set completed_at=clock_timestamp() where j.id=p_job;
  end if;
end;
$$;

revoke all on all tables in schema cali_phase4_elimination_qa from public,anon,authenticated,service_role;
revoke all on all functions in schema cali_phase4_elimination_qa from public,anon,authenticated,service_role;
