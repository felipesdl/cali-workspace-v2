-- FLOW-10. Recebe um anexo por chamada e publica o lote em uma única transação.
begin;
set local lock_timeout='5s';

create table cali_session_guard.phase4_record_attachment_staging (
  actor_id uuid not null,
  company_id uuid not null,
  request_id uuid not null,
  record_id uuid not null,
  position smallint not null check(position between 1 and 5),
  file_name text not null,
  content bytea not null,
  checksum text not null,
  updated_at timestamptz not null,
  primary key(actor_id,position)
);
create index phase4_record_attachment_staging_age
  on cali_session_guard.phase4_record_attachment_staging(updated_at);

create function cali_workspace.v2_stage_pilot_record_attachment(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_position integer,p_file_name text,p_base64 text
)
returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_pilot_team_actor(p_company_id);
  role_name text:=(select role::text from cali_workspace.profiles where id=actor);
  content_bytes bytea;
begin
  if p_request_id is null or p_record_id is null or p_position is null or p_position not between 1 and 5 then
    raise exception using errcode='22023',message='Confira os anexos.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-record-staging:'||actor::text,0));
  if exists(select 1 from cali_session_guard.phase4_operation_receipts r
    where r.actor_id=actor and r.company_id=p_company_id and r.request_id=p_request_id) then
    return;
  end if;
  if not exists(select 1 from cali_workspace.account_records r
    where r.company_id=p_company_id and r.id=p_record_id and r.workflow_status not in ('completed','cancelled')
      and (role_name='admin' or (r.visibility='client' and r.workflow_status<>'standby'))) then
    raise exception using errcode='42501',message='Ocorrência indisponível.';
  end if;
  content_bytes:=cali_session_guard.phase4_decode_record_batch_file(p_file_name,p_base64);
  delete from cali_session_guard.phase4_record_attachment_staging s
  where s.actor_id=actor and (s.company_id<>p_company_id or s.request_id<>p_request_id
    or s.record_id<>p_record_id or s.updated_at<clock_timestamp()-interval '1 hour');
  -- Limpeza limitada. Linhas em uso por outra transação ficam para a próxima chamada.
  delete from cali_session_guard.phase4_record_attachment_staging s
  where (s.actor_id,s.position) in (
    select t.actor_id,t.position from cali_session_guard.phase4_record_attachment_staging t
    where t.updated_at<clock_timestamp()-interval '1 hour' order by t.updated_at limit 25 for update skip locked
  );
  insert into cali_session_guard.phase4_record_attachment_staging
  values(actor,p_company_id,p_request_id,p_record_id,p_position,p_file_name,content_bytes,
    encode(sha256(content_bytes),'hex'),clock_timestamp())
  on conflict(actor_id,position) do update set file_name=excluded.file_name,content=excluded.content,
    checksum=excluded.checksum,updated_at=excluded.updated_at;
end;
$$;

create function cali_workspace.v2_post_pilot_staged_record_batch(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_body text,p_internal boolean,p_manifest jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_pilot_team_actor(p_company_id);
  actual_manifest jsonb;
  signature bytea;
  saved uuid;
begin
  if p_request_id is null or p_record_id is null or jsonb_typeof(p_manifest) is distinct from 'array'
    or octet_length(p_manifest::text)>6000 then
    raise exception using errcode='22023',message='Confira os anexos.';
  end if;
  if jsonb_array_length(p_manifest) not between 1 and 5 then
    raise exception using errcode='22023',message='Selecione até cinco anexos.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-record-staging:'||actor::text,0));
  signature:=sha256(convert_to(jsonb_build_array('staged-record-batch',p_record_id,btrim(p_body),
    coalesce(p_internal,false),p_manifest)::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select jsonb_agg(jsonb_build_object('fileName',s.file_name,'sha256',s.checksum) order by s.position)
    into actual_manifest from (
      select t.position,t.file_name,t.checksum from cali_session_guard.phase4_record_attachment_staging t
      where t.actor_id=actor and t.company_id=p_company_id and t.request_id=p_request_id and t.record_id=p_record_id
        and t.position<=jsonb_array_length(p_manifest) and t.updated_at>=clock_timestamp()-interval '1 hour'
      for update
    ) s;
  if actual_manifest is distinct from p_manifest then
    raise exception using errcode='40001',message='O envio dos anexos está incompleto. Tente novamente.';
  end if;

  saved:=cali_workspace.v2_pilot_record_action(p_company_id,gen_random_uuid(),p_record_id,'message',
    p_body=>p_body,p_internal=>p_internal);
  insert into cali_session_guard.phase4_record_attachments(message_id,position,file_name,content)
    select saved,s.position,s.file_name,s.content from cali_session_guard.phase4_record_attachment_staging s
    where s.actor_id=actor and s.position<=jsonb_array_length(p_manifest);
  delete from cali_session_guard.phase4_record_attachment_staging s where s.actor_id=actor;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return saved;
end;
$$;

revoke all on table cali_session_guard.phase4_record_attachment_staging from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_stage_pilot_record_attachment(uuid,uuid,uuid,integer,text,text),
  cali_workspace.v2_post_pilot_staged_record_batch(uuid,uuid,uuid,text,boolean,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_stage_pilot_record_attachment(uuid,uuid,uuid,integer,text,text),
  cali_workspace.v2_post_pilot_staged_record_batch(uuid,uuid,uuid,text,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
