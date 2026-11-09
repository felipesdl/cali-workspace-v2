-- Ensaio privado. A ativação aceita apenas buckets descartáveis de QA.
create schema cali_storage_fence_qa;
revoke all on schema cali_storage_fence_qa from public,anon,authenticated,service_role;

create table cali_storage_fence_qa.targets (
  bucket text not null,
  path text not null,
  object_id uuid not null,
  object_version text not null,
  primary key(bucket,path)
);

create function cali_storage_fence_qa.lock_path(p_bucket text,p_path text)
returns void language plpgsql set search_path=''
as $$
begin
  -- O gatilho pode receber uma linha já bloqueada pelo Storage. Recusar a
  -- disputa evita esperar em ordem inversa à reserva do plano.
  if current_setting('transaction_isolation')<>'read committed'
    or not pg_try_advisory_xact_lock(hashtextextended(jsonb_build_array(p_bucket,p_path)::text,98471))
  then
    raise exception using errcode='40001',message='Caminho do arquivo em conferência.';
  end if;
end;
$$;

create function cali_storage_fence_qa.guard_object()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  target cali_storage_fence_qa.targets;
  qa_bucket text:=tg_argv[0];
begin
  if tg_op in ('UPDATE','DELETE') and old.bucket_id=qa_bucket then
    perform cali_storage_fence_qa.lock_path(old.bucket_id,old.name);
    select * into target from cali_storage_fence_qa.targets t
    where t.bucket=old.bucket_id and t.path=old.name;
    if found and (tg_op<>'DELETE' or old.id is distinct from target.object_id
      or old.version is distinct from target.object_version) then
      raise exception using errcode='42501',message='Arquivo protegido por versão aprovada.';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.bucket_id=qa_bucket then
    perform cali_storage_fence_qa.lock_path(new.bucket_id,new.name);
    if exists(select 1 from cali_storage_fence_qa.targets t where t.bucket=new.bucket_id and t.path=new.name) then
      raise exception using errcode='42501',message='Caminho reservado para eliminação.';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create function cali_storage_fence_qa.attach(p_bucket text)
returns void language plpgsql set search_path=''
as $$
begin
  if p_bucket is null or p_bucket !~ '^qa-delete-version-[0-9a-f]{20}$'
    or not exists(select 1 from storage.buckets b where b.id=p_bucket and not b.public) then
    raise exception using errcode='22023',message='Bucket descartável privado obrigatório.';
  end if;
  execute format('create trigger cali_qa_elimination_insert before insert on storage.objects
    for each row when (new.bucket_id=%L) execute function cali_storage_fence_qa.guard_object(%L)',p_bucket,p_bucket);
  execute format('create trigger cali_qa_elimination_update before update on storage.objects
    for each row when (old.bucket_id=%L or new.bucket_id=%L)
    execute function cali_storage_fence_qa.guard_object(%L)',p_bucket,p_bucket,p_bucket);
  execute format('create trigger cali_qa_elimination_delete before delete on storage.objects
    for each row when (old.bucket_id=%L) execute function cali_storage_fence_qa.guard_object(%L)',p_bucket,p_bucket);
end;
$$;

create function cali_storage_fence_qa.arm(p_bucket text,p_path text,p_id uuid,p_version text)
returns boolean language plpgsql set search_path=''
as $$
begin
  if p_bucket is null or p_bucket !~ '^qa-delete-version-[0-9a-f]{20}$'
    or p_path is null or p_id is null or nullif(btrim(p_version),'') is null then
    raise exception using errcode='22023',message='Alvo de ensaio incompleto.';
  end if;
  -- A instalação e a reserva são serializadas com alterações no catálogo.
  lock table storage.objects in row exclusive mode;
  if (select count(*) from pg_trigger t where t.tgrelid='storage.objects'::regclass
    and t.tgfoid='cali_storage_fence_qa.guard_object()'::regprocedure and t.tgenabled in ('O','A')
    and t.tgargs=convert_to(p_bucket,'UTF8')||decode('00','hex'))<>3 then
    raise exception using errcode='42501',message='Trava de Storage incompleta.';
  end if;
  perform cali_storage_fence_qa.lock_path(p_bucket,p_path);
  if exists(select 1 from cali_storage_fence_qa.targets t where t.bucket=p_bucket and t.path=p_path) then
    return exists(select 1 from cali_storage_fence_qa.targets t where t.bucket=p_bucket and t.path=p_path
      and t.object_id=p_id and t.object_version=p_version);
  end if;
  perform 1 from storage.objects o where o.bucket_id=p_bucket and o.name=p_path
    and o.id=p_id and o.version=p_version for update;
  if not found then return false; end if;
  insert into cali_storage_fence_qa.targets(bucket,path,object_id,object_version)
  values(p_bucket,p_path,p_id,p_version);
  return true;
end;
$$;

revoke all on all tables in schema cali_storage_fence_qa from public,anon,authenticated,service_role;
revoke all on all functions in schema cali_storage_fence_qa from public,anon,authenticated,service_role;
