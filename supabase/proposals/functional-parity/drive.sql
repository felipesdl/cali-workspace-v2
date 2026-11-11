begin;
set local lock_timeout='5s';
create table cali_session_guard.drive_copies (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null,
  file_id uuid not null, source_version text not null, provider_id text,
  lease uuid not null, lease_until timestamptz not null, status text not null
    check(status in ('processing','synced','failed')), external_url text,
  unique(connection_id,file_id,source_version)
);
alter table cali_session_guard.drive_copies enable row level security;
revoke all on cali_session_guard.drive_copies from public,anon,authenticated,service_role;

create function cali_workspace.v2_drive_copy(p_action text,p_file uuid,p_connection uuid,p_account text,
  p_lease uuid default null,p_provider text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  company uuid; f cali_workspace.files; c cali_workspace.drive_connections;
  job cali_session_guard.drive_copies; version text;
begin
  if auth.uid() is null or (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true' then
    raise exception using errcode='42501',message='Sessão indisponível.';
  end if;
  select p.company_id into company from cali_workspace.profiles p
    where p.id=auth.uid() and p.role='client' and p.active;
  select * into c from cali_workspace.drive_connections where id=p_connection
    and company_id=company and owner_type='client' and status='connected'
    and google_account_id=p_account for update;
  if not found then raise exception using errcode='42501',message='Conexão indisponível.'; end if;
  select * into f from cali_workspace.files where id=p_file and company_id=company
    and status='published' and client_visible and storage_path is not null for share;
  if not found then raise exception using errcode='42501',message='Arquivo indisponível.'; end if;
  version:=encode(sha256(convert_to(jsonb_build_array(c.google_account_id,f.storage_path,f.updated_at,(select o.updated_at from storage.objects o where o.bucket_id='cali-workspace-private' and o.name=f.storage_path))::text,'UTF8')),'hex');
  if p_action='claim' then
    select * into job from cali_session_guard.drive_copies where connection_id=c.id and file_id=f.id and source_version=version for update;
    if found and job.status='synced' then
      return jsonb_build_object('done',true,'url',job.external_url);
    end if;
    if found and job.status='processing' and job.lease_until>now() then
      raise exception using errcode='55000',message='Cópia em andamento. Aguarde antes de tentar novamente.';
    end if;
    insert into cali_session_guard.drive_copies(connection_id,file_id,source_version,lease,lease_until,status)
      values(c.id,f.id,version,gen_random_uuid(),now()+interval '2 minutes','processing')
      on conflict(connection_id,file_id,source_version) do update set lease=gen_random_uuid(),
        lease_until=now()+interval '2 minutes',status='processing' returning * into job;
  else
    select * into job from cali_session_guard.drive_copies where connection_id=c.id and file_id=f.id
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
    'providerId',job.provider_id,'path',f.storage_path,'name',coalesce(f.original_filename,f.title),
    'fileType',f.file_type,'deliverable',f.deliverable_id);
end $$;
revoke all on function cali_workspace.v2_drive_copy(text,uuid,uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_drive_copy(text,uuid,uuid,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
