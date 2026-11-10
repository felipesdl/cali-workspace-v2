-- FLOW-10. Até cinco anexos privados por mensagem, gravados na mesma transação.
begin;
set local lock_timeout='5s';

do $$
begin
  if not exists(select 1 from pg_attribute where
    attrelid='cali_session_guard.phase4_record_attachments'::regclass
    and attname='position' and not attisdropped) then
    alter table cali_session_guard.phase4_record_attachments
      add column position smallint not null default 1 check (position between 1 and 5),
      drop constraint phase4_record_attachments_pkey,
      add primary key (message_id,position);
  end if;
end;
$$;

alter table cali_session_guard.phase4_record_attachments
  drop constraint phase4_record_attachments_content_check,
  add constraint phase4_record_attachments_content_check
    check (octet_length(content) between 8 and 10485760);

create function cali_session_guard.phase4_zip_uint(p_bytes bytea,p_offset integer,p_width integer)
returns bigint language sql immutable strict set search_path='' as $$
  select sum(get_byte(p_bytes,p_offset+i)::bigint << (8*i))
  from generate_series(0,p_width-1) i;
$$;

-- Inspeção do diretório ZIP (PKWARE APPNOTE 4.3). Não extrai conteúdo.
create function cali_session_guard.phase4_office_package_matches(p_bytes bytea,p_extension text)
returns boolean language plpgsql immutable strict set search_path='' as $$
declare
  size integer:=octet_length(p_bytes);
  footer integer;
  directory_start integer;
  cursor_at integer;
  entries integer;
  name_size integer;
  next_at integer;
  local_at bigint;
  expanded bigint:=0;
  member text;
  names text[]:='{}';
  main_part text:=case p_extension when 'docx' then 'word/document.xml'
    when 'xlsx' then 'xl/workbook.xml' when 'pptx' then 'ppt/presentation.xml' end;
begin
  if size<22 or substring(p_bytes from 1 for 4)<>decode('504b0304','hex') then return false; end if;
  for candidate in reverse size-22..greatest(0,size-65557) loop
    if substring(p_bytes from candidate+1 for 4)=decode('504b0506','hex')
      and candidate+22+cali_session_guard.phase4_zip_uint(p_bytes,candidate+20,2)=size then
      footer:=candidate;
      exit;
    end if;
  end loop;
  if footer is null then return false; end if;
  entries:=cali_session_guard.phase4_zip_uint(p_bytes,footer+10,2);
  if entries not between 3 and 1024
    or cali_session_guard.phase4_zip_uint(p_bytes,footer+4,4)<>0
    or cali_session_guard.phase4_zip_uint(p_bytes,footer+8,2)<>entries
    or cali_session_guard.phase4_zip_uint(p_bytes,footer+16,4)>footer then return false; end if;
  directory_start:=cali_session_guard.phase4_zip_uint(p_bytes,footer+16,4);
  if directory_start+cali_session_guard.phase4_zip_uint(p_bytes,footer+12,4)<>footer then return false; end if;
  cursor_at:=directory_start;
  for member_number in 1..entries loop
    if cursor_at+46>footer or substring(p_bytes from cursor_at+1 for 4)<>decode('504b0102','hex') then
      return false;
    end if;
    name_size:=cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+28,2);
    next_at:=cursor_at+46+name_size+cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+30,2)
      +cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+32,2);
    local_at:=cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+42,4);
    if name_size not between 1 and 1024 or next_at>footer or local_at+30+name_size>directory_start
      or (get_byte(p_bytes,cursor_at+8)&1)<>0 or cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+10,2) not in (0,8)
      or cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+34,2)<>0 then return false; end if;
    if substring(p_bytes from local_at::integer+1 for 4)<>decode('504b0304','hex')
      or (get_byte(p_bytes,local_at::integer+6)&1)<>0
      or cali_session_guard.phase4_zip_uint(p_bytes,local_at::integer+26,2)<>name_size
      or substring(p_bytes from local_at::integer+31 for name_size)<>substring(p_bytes from cursor_at+47 for name_size)
      or local_at+30+name_size+cali_session_guard.phase4_zip_uint(p_bytes,local_at::integer+28,2)
        +cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+20,4)>directory_start then return false; end if;
    expanded:=expanded+cali_session_guard.phase4_zip_uint(p_bytes,cursor_at+24,4);
    member:=convert_from(substring(p_bytes from cursor_at+47 for name_size),'UTF8');
    if expanded>104857600 or member~'(^/|(^|/)\.\.(/|$)|[[:cntrl:]:])'
      or position(chr(92) in member)>0 or lower(member) like '%vbaproject%' or member=any(names) then return false; end if;
    names:=array_append(names,member);
    cursor_at:=next_at;
  end loop;
  return cursor_at=footer and names @> array['[Content_Types].xml','_rels/.rels',main_part];
exception when character_not_in_repertoire or untranslatable_character then
  return false;
end;
$$;

create function cali_session_guard.phase4_decode_record_batch_file(p_name text,p_base64 text)
returns bytea language plpgsql immutable set search_path='' as $$
declare
  extension text:=lower(substring(p_name from '\.([^.]+)$'));
  bytes bytea;
begin
  if coalesce(length(p_name),0) not between 5 and 180
    or p_name ~ '[[:cntrl:]/]' or position(chr(92) in p_name)>0
    or coalesce(length(p_base64),0) not between 12 and 13981016 then
    raise exception using errcode='22023',message='Confira o nome e o limite de 10 MiB por arquivo.';
  end if;
  bytes:=decode(p_base64,'base64');
  if octet_length(bytes) not between 8 and 10485760 or (
    case extension
      when 'pdf' then substring(bytes from 1 for 5)=convert_to('%PDF-','UTF8')
      when 'png' then substring(bytes from 1 for 16)=decode('89504e470d0a1a0a0000000d49484452','hex')
      when 'webp' then substring(bytes from 1 for 4)=convert_to('RIFF','UTF8')
        and substring(bytes from 9 for 8) in (convert_to('WEBPVP8 ','UTF8'),convert_to('WEBPVP8L','UTF8'),convert_to('WEBPVP8X','UTF8'))
      when 'jpg' then substring(bytes from 1 for 3)=decode('ffd8ff','hex') and substring(bytes from octet_length(bytes)-1 for 2)=decode('ffd9','hex')
      when 'jpeg' then substring(bytes from 1 for 3)=decode('ffd8ff','hex') and substring(bytes from octet_length(bytes)-1 for 2)=decode('ffd9','hex')
      else extension in ('docx','xlsx','pptx') and cali_session_guard.phase4_office_package_matches(bytes,extension)
    end
  ) is not true then
    raise exception using errcode='22023',message='O conteúdo não corresponde ao formato do anexo.';
  end if;
  return bytes;
end;
$$;

create function cali_workspace.v2_post_pilot_record_batch(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_body text,p_internal boolean,p_files jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_pilot_team_actor(p_company_id);
  item jsonb;
  name text;
  content bytea;
  names text[]:='{}';
  contents bytea[]:='{}';
  checksums text[]:='{}';
  signature bytea;
  saved uuid;
  total_bytes integer:=0;
begin
  if jsonb_typeof(p_files) is distinct from 'array' then
    raise exception using errcode='22023',message='Confira os anexos.';
  end if;
  if jsonb_array_length(p_files) not between 1 and 5 then
    raise exception using errcode='22023',message='Selecione até cinco anexos.';
  end if;
  -- Até quatro bytes adicionais por anexo por causa do preenchimento Base64.
  if (select sum(octet_length(value->>'base64')) from jsonb_array_elements(p_files))>13981032 then
    raise exception using errcode='22023',message='A mensagem pode ter até 10 MiB em anexos.';
  end if;
  for item in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(item->'fileName') is distinct from 'string' or jsonb_typeof(item->'base64') is distinct from 'string' then
      raise exception using errcode='22023',message='Confira os anexos.';
    end if;
    name:=item->>'fileName';
    content:=cali_session_guard.phase4_decode_record_batch_file(name,item->>'base64');
    total_bytes:=total_bytes+octet_length(content);
    if total_bytes>10485760 then
      raise exception using errcode='22023',message='A mensagem pode ter até 10 MiB em anexos.';
    end if;
    names:=array_append(names,name);
    contents:=array_append(contents,content);
    checksums:=array_append(checksums,encode(sha256(content),'hex'));
  end loop;
  signature:=sha256(convert_to(jsonb_build_array('record-batch',p_record_id,btrim(p_body),coalesce(p_internal,false),
    names,checksums)::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  saved:=cali_workspace.v2_pilot_record_action(p_company_id,gen_random_uuid(),p_record_id,'message',
    p_body=>p_body,p_internal=>p_internal);
  insert into cali_session_guard.phase4_record_attachments(message_id,position,file_name,content)
    select saved,i,names[i],contents[i] from generate_subscripts(names,1) i;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return saved;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_record_attachment(p_company_id uuid,p_record_id uuid,p_message_id uuid,p_position integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  payload jsonb;
begin
  select jsonb_build_object('id',a.message_id,'position',a.position,'fileName',a.file_name,
    'content',encode(a.content,'base64'),'sha256',encode(sha256(a.content),'hex')) into payload
  from cali_session_guard.phase4_record_attachments a
  join cali_workspace.account_record_messages m on m.id=a.message_id
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and a.position=p_position and a.withdrawn_at is null and m.deleted_at is null
    and (admin or (r.visibility='client' and m.visibility='client'))
  for share of r,m,a;
  if not found then
    raise exception using errcode='42501',message='Anexo indisponível para este acesso.';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

create or replace function cali_workspace.v2_withdraw_pilot_record_attachment(
  p_company_id uuid,p_record_id uuid,p_message_id uuid,p_position integer,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  reason text := btrim(p_reason);
begin
  if coalesce(length(reason),0) not between 3 and 1000 then
    raise exception using errcode='22023',message='Informe o motivo da retirada.';
  end if;
  perform 1 from cali_workspace.account_record_messages m
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and m.author_role='admin' and m.deleted_at is null
  for share of r,m;
  if not found then raise exception using errcode='42501',message='Anexo indisponível.'; end if;
  update cali_session_guard.phase4_record_attachments set withdrawn_at=clock_timestamp(),withdrawn_by=actor
  where message_id=p_message_id and position=p_position and withdrawn_at is null;
  if found then
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'record_attachment_withdrawn','account_record',p_record_id,
      jsonb_build_object('message_id',p_message_id,'position',p_position,'reason',reason));
  elsif not exists(select 1 from cali_session_guard.phase4_record_attachments where message_id=p_message_id and position=p_position) then
    raise exception using errcode='42501',message='Anexo indisponível.';
  end if;
  return p_message_id;
end;
$$;


revoke all on function cali_session_guard.phase4_zip_uint(bytea,integer,integer),
  cali_session_guard.phase4_office_package_matches(bytea,text),
  cali_session_guard.phase4_decode_record_batch_file(text,text),
  cali_workspace.v2_post_pilot_record_batch(uuid,uuid,uuid,text,boolean,jsonb),
  cali_workspace.v2_read_pilot_record_attachment(uuid,uuid,uuid,integer),
  cali_workspace.v2_withdraw_pilot_record_attachment(uuid,uuid,uuid,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_post_pilot_record_batch(uuid,uuid,uuid,text,boolean,jsonb),
  cali_workspace.v2_read_pilot_record_attachment(uuid,uuid,uuid,integer),
  cali_workspace.v2_withdraw_pilot_record_attachment(uuid,uuid,uuid,integer,text) to authenticated;
-- Mantém os contratos antigos na primeira posição e projeta o lote no leitor.
create or replace function cali_workspace.v2_read_pilot_record(p_company_id uuid,p_record_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  attachments_enabled boolean := to_regprocedure(
    'cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text)'
  ) is not null;
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página inválida.';
  end if;
  return (
    select jsonb_build_object('id',r.id,'title',r.title,'status',r.workflow_status,'visibility',r.visibility,
      'attachmentsEnabled',attachments_enabled,
      'attachmentBatchesEnabled',to_regprocedure('cali_workspace.v2_post_pilot_record_batch(uuid,uuid,uuid,text,boolean,jsonb)') is not null,
      'stagedBatchesEnabled',to_regprocedure(
        'cali_workspace.v2_stage_pilot_record_attachment(uuid,uuid,uuid,integer,text,text)') is not null
        and to_regprocedure('cali_workspace.v2_post_pilot_staged_record_batch(uuid,uuid,uuid,text,boolean,jsonb)') is not null,
      'imageAttachmentsEnabled',to_regprocedure(
        'cali_workspace.v2_post_pilot_record_image(uuid,uuid,uuid,text,boolean,text,text)') is not null,
      'feedback',(select jsonb_build_object('score',f.score,'comment',f.comment)
        from cali_workspace.account_record_feedback f where f.company_id=p_company_id and f.record_id=r.id and f.user_id=actor),
      'reopen',(select jsonb_build_object('id',q.id,'status',q.status,
        'reason',case when admin or q.requested_by=actor then q.reason end,
        'note',q.decision_note)
        from cali_workspace.account_record_reopen_requests q where q.company_id=p_company_id and q.record_id=r.id
        order by (q.status='pending') desc,q.requested_at desc,q.id desc limit 1),
      'messages',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from (
        select m.id,m.body,m.author_role,m.visibility,m.created_at,
          case when attachments_enabled and a.message_id is not null then
            jsonb_build_object('fileName',a.file_name,'canWithdraw',admin and m.author_role='admin') end as attachment,
          case when attachments_enabled then (
            select coalesce(jsonb_agg(jsonb_build_object('position',f.position,'fileName',f.file_name,
              'canWithdraw',admin and m.author_role='admin') order by f.position),'[]'::jsonb)
            from cali_session_guard.phase4_record_attachments f
            where f.message_id=m.id and f.withdrawn_at is null
          ) end as attachments
        from cali_workspace.account_record_messages m
        left join cali_session_guard.phase4_record_attachments a on a.message_id=m.id and a.position=1 and a.withdrawn_at is null
        where m.record_id=r.id and m.company_id=p_company_id
          and m.deleted_at is null and (admin or m.visibility='client')
        order by m.created_at desc,m.id desc limit 25 offset (p_page-1)*25
      ) page),'[]'::jsonb))
    from cali_workspace.account_records r where r.id=p_record_id and r.company_id=p_company_id
      and (admin or r.visibility='client')
  );
end;
$$;

create or replace function cali_workspace.v2_read_pilot_record_pdf(p_company_id uuid,p_record_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  payload jsonb;
begin
  select jsonb_build_object('id',a.message_id,'fileName',a.file_name,
    'content',encode(a.content,'base64'),'sha256',encode(sha256(a.content),'hex')) into payload
  from cali_session_guard.phase4_record_attachments a
  join cali_workspace.account_record_messages m on m.id=a.message_id
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and a.position=1 and a.withdrawn_at is null and m.deleted_at is null
    and (admin or (r.visibility='client' and m.visibility='client'))
  for share of r,m,a;
  if not found then
    raise exception using errcode='42501',message='Anexo indisponível para este acesso.';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

create or replace function cali_workspace.v2_withdraw_pilot_record_pdf(
  p_company_id uuid,p_record_id uuid,p_message_id uuid,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  reason text := btrim(p_reason);
begin
  if coalesce(length(reason),0) not between 3 and 1000 then
    raise exception using errcode='22023',message='Informe o motivo da retirada.';
  end if;
  perform 1 from cali_workspace.account_record_messages m
  join cali_workspace.account_records r on r.id=m.record_id and r.company_id=m.company_id
  where r.company_id=p_company_id and r.id=p_record_id and m.id=p_message_id
    and m.author_role='admin' and m.deleted_at is null
  for share of r,m;
  if not found then raise exception using errcode='42501',message='Anexo indisponível.'; end if;
  update cali_session_guard.phase4_record_attachments set withdrawn_at=clock_timestamp(),withdrawn_by=actor
  where message_id=p_message_id and position=1 and withdrawn_at is null;
  if found then
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'record_attachment_withdrawn','account_record',p_record_id,
      jsonb_build_object('message_id',p_message_id,'reason',reason));
  elsif not exists(select 1 from cali_session_guard.phase4_record_attachments where message_id=p_message_id and position=1) then
    raise exception using errcode='42501',message='Anexo indisponível.';
  end if;
  return p_message_id;
end;
$$;

notify pgrst,'reload schema';
commit;
