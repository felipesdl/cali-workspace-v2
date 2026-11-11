begin;
set local lock_timeout='5s';
create table if not exists cali_session_guard.drive_copies (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null,
  file_id uuid not null, source_version text not null, provider_id text,
  lease uuid not null, lease_until timestamptz not null, status text not null
    check(status in ('processing','synced','failed')), external_url text,
  unique(connection_id,file_id,source_version)
);
alter table cali_session_guard.drive_copies enable row level security;
revoke all on cali_session_guard.drive_copies from public,anon,authenticated,service_role;

create function cali_session_guard.drive_sources(p_company uuid)
returns table(id uuid,title text,delivery_id uuid,source text,version text,path text,revision_id uuid,file_name text)
language sql stable set search_path='' as $$
  select d.id,d.title,d.delivery_id,'document',encode(sha256(convert_to('document:'||r.id::text,'UTF8')),'hex'),
    null::text,r.id,r.file_name
  from cali_session_guard.phase4_documents d
  join cali_session_guard.phase4_document_revisions r on r.document_id=d.id and r.id=d.published_revision
  where d.company_id=p_company and (d.delivery_id is null or
    cali_session_guard.phase4_delivery_pdf_visible(p_company,d.delivery_id))
  union all
  select f.id,f.title,f.deliverable_id,'legacy',
    encode(sha256(convert_to(jsonb_build_array('legacy',f.storage_path,f.updated_at,o.updated_at)::text,'UTF8')),'hex'),
    f.storage_path,null::uuid,coalesce(f.original_filename,f.title)
  from cali_workspace.files f
  join storage.objects o on o.bucket_id='cali-workspace-private' and o.name=f.storage_path
  where f.company_id=p_company and f.status='published' and f.client_visible
    and (f.deliverable_id is null or cali_workspace.client_can_view_deliverable(f.deliverable_id))
    and not exists(select 1 from cali_session_guard.phase4_documents d where d.id=f.id);
$$;
revoke all on function cali_session_guard.drive_sources(uuid) from public,anon,authenticated,service_role;

create function cali_workspace.v2_list_drive_sources(p_page integer,p_delivery uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare company uuid;
begin
  if auth.uid() is null or (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true' then
    raise exception using errcode='42501',message='Sessão indisponível.';
  end if;
  select p.company_id into company from cali_workspace.profiles p
    where p.id=auth.uid() and p.role='client' and p.active;
  if company is null or p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='42501',message='Acervo indisponível.';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(row) order by row.title,row.id),'[]'::jsonb) from (
    select s.id,s.title,s.delivery_id as "deliveryId",d.title as "deliveryTitle",s.source
    from cali_session_guard.drive_sources(company) s
    left join cali_workspace.deliverables d on d.id=s.delivery_id and d.company_id=company
    where p_delivery is null or s.delivery_id=p_delivery
    order by s.title,s.id limit 100 offset (p_page-1)*100
  ) row);
end $$;

create function cali_workspace.v2_read_drive_source(p_file uuid,p_source text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare company uuid; result jsonb;
begin
  if auth.uid() is null or (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true' then
    raise exception using errcode='42501',message='Sessão indisponível.';
  end if;
  select p.company_id into company from cali_workspace.profiles p
    where p.id=auth.uid() and p.role='client' and p.active;
  select jsonb_build_object('version',s.version,'path',s.path,'revisionId',s.revision_id,
    'name',s.file_name,'deliveryId',s.delivery_id) into result
    from cali_session_guard.drive_sources(company) s where s.id=p_file and s.source=p_source;
  if result is null then raise exception using errcode='42501',message='Arquivo indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return result;
end $$;
revoke all on function cali_workspace.v2_list_drive_sources(integer,uuid),
  cali_workspace.v2_read_drive_source(uuid,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_drive_sources(integer,uuid),
  cali_workspace.v2_read_drive_source(uuid,text) to authenticated;

drop function if exists cali_workspace.v2_drive_copy(text,uuid,uuid,text,uuid,text);
create function cali_workspace.v2_drive_copy(p_actor uuid,p_action text,p_file uuid,p_connection uuid,
  p_account text,p_version text,
  p_lease uuid default null,p_provider text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  company uuid; c cali_workspace.drive_connections;
  job cali_session_guard.drive_copies; version text;
begin
  if p_file is null or p_version is null or p_version !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='Versão indisponível.';
  end if;
  select p.company_id into company from cali_workspace.profiles p
    where p.id=p_actor and p.role='client' and p.active;
  select * into c from cali_workspace.drive_connections where id=p_connection
    and company_id=company and owner_type='client' and status='connected'
    and google_account_id=p_account for update;
  if not found then raise exception using errcode='42501',message='Conexão indisponível.'; end if;
  version:=encode(sha256(convert_to(jsonb_build_array(c.google_account_id,p_version)::text,'UTF8')),'hex');
  if p_action='claim' then
    select * into job from cali_session_guard.drive_copies where connection_id=c.id and file_id=p_file and source_version=version for update;
    if found and job.status='synced' then
      return jsonb_build_object('done',true,'url',job.external_url);
    end if;
    if found and job.status='processing' and job.lease_until>now() then
      raise exception using errcode='55000',message='Cópia em andamento. Aguarde antes de tentar novamente.';
    end if;
    insert into cali_session_guard.drive_copies(connection_id,file_id,source_version,lease,lease_until,status)
      values(c.id,p_file,version,gen_random_uuid(),now()+interval '2 minutes','processing')
      on conflict(connection_id,file_id,source_version) do update set lease=gen_random_uuid(),
        lease_until=now()+interval '2 minutes',status='processing' returning * into job;
  else
    select * into job from cali_session_guard.drive_copies where connection_id=c.id and file_id=p_file
      and source_version=version and lease=p_lease and status='processing' for update;
    if not found or job.lease_until<now() then raise exception using errcode='40001',message='Cópia expirou ou a versão mudou.'; end if;
    if p_action='reserve' then
      if p_provider is null or p_provider !~ '^[a-zA-Z0-9_-]{10,200}$'
        or (job.provider_id is not null and job.provider_id<>p_provider) then
        raise exception using errcode='22023',message='Identificador de cópia inválido.';
      end if;
      update cali_session_guard.drive_copies set provider_id=p_provider where id=job.id returning * into job;
    elsif p_action='complete' and job.provider_id is not null then
      update cali_session_guard.drive_copies set status='synced',external_url='https://drive.google.com/file/d/'||provider_id||'/view'
        where id=job.id returning * into job;
    elsif p_action='fail' then
      update cali_session_guard.drive_copies set status='failed' where id=job.id;
    else raise exception using errcode='22023',message='Operação inválida.';
    end if;
  end if;
  return jsonb_build_object('done',job.status='synced','url',job.external_url,'lease',job.lease,
    'providerId',job.provider_id);
end $$;
revoke all on function cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
