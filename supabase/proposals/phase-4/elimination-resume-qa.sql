-- FLOW-18. Candidata privada para ensaio. Sem integração com dados operacionais.
-- No staging, executar somente na transação de prova encerrada com rollback.
create schema cali_phase4_elimination_qa;
revoke all on schema cali_phase4_elimination_qa from public,anon,authenticated,service_role;

create table cali_phase4_elimination_qa.jobs (
  id uuid primary key,
  company_id uuid not null unique,
  dispositions jsonb not null,
  completed_at timestamptz
);

create table cali_phase4_elimination_qa.steps (
  job_id uuid not null references cali_phase4_elimination_qa.jobs(id),
  position integer not null check (position>0),
  kind text not null check (kind in ('external','storage','database')),
  external_scope text check (external_scope in ('drive','email','portal_mapa','backup_acervo')),
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
  check ((kind='external')=(external_scope is not null)),
  check ((lease_id is null)=(lease_until is null)),
  check (receipt is null or lease_id is not null)
);

-- O ensaio congela referências opacas; o inventário real deve ser reconciliado antes da execução.
create function cali_phase4_elimination_qa.prepare(
  p_job uuid,p_company uuid,p_dispositions jsonb,p_external jsonb,p_storage uuid[],p_database uuid
)
returns void language plpgsql set search_path=''
as $$
declare
  expected_dispositions constant jsonb := '{
    "operational_content":"remove",
    "exclusive_files":"remove",
    "client_identity":"deidentify_and_revoke",
    "company_record":"minimize",
    "billing":"preserve",
    "audit_and_privacy_requests":"preserve",
    "synthetic_assessments":"remove"
  }';
  external_scopes constant text[] := array['drive','email','portal_mapa','backup_acervo'];
begin
  if p_dispositions is distinct from expected_dispositions then
    raise exception using errcode='22023',message='Classificação incompleta ou diferente da revisão de ensaio.';
  end if;
  if jsonb_typeof(p_external) is distinct from 'object' then
    raise exception using errcode='22023',message='Destinos externos indisponíveis.';
  end if;
  if (select count(*) from jsonb_object_keys(p_external)) <> cardinality(external_scopes)
    or exists(select 1 from unnest(external_scopes) as scope(name)
      where jsonb_typeof(p_external->scope.name) is distinct from 'string')
    or p_database is null or p_storage is null
    or coalesce(array_ndims(p_storage),1)<>1 or cardinality(p_storage)>1000
    or array_position(p_storage,null::uuid) is not null then
    raise exception using errcode='22023',message='Manifesto de ensaio inválido.';
  end if;
  insert into cali_phase4_elimination_qa.jobs(id,company_id,dispositions)
  values(p_job,p_company,p_dispositions);
  insert into cali_phase4_elimination_qa.steps(job_id,position,kind,external_scope,resource_id)
  select p_job,idx::integer,'external',name,(p_external->>name)::uuid
  from unnest(external_scopes) with ordinality as destinations(name,idx)
  union all
  select p_job,cardinality(external_scopes)+idx::integer,'storage',null,resource
  from unnest(p_storage) with ordinality as objects(resource,idx)
  union all
  select p_job,1+cardinality(external_scopes)+cardinality(p_storage),'database',null,p_database;
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
