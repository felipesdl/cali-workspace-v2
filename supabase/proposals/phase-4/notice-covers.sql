-- FLOW-13. Capas de avisos publicados com o mesmo público do mural.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_notice_cover (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references cali_workspace.notices(id),
  mime_type text check (mime_type in ('image/png','image/jpeg')),
  content bytea check (octet_length(content) between 12 and 1048576),
  current boolean not null default true,
  saved_by uuid not null,
  saved_at timestamptz not null default clock_timestamp(),
  check ((mime_type is null)=(content is null))
);
create unique index if not exists phase4_notice_cover_current
  on cali_session_guard.phase4_notice_cover(notice_id) where current;
alter table cali_session_guard.phase4_notice_cover enable row level security;
revoke all on cali_session_guard.phase4_notice_cover from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_save_pilot_notice_cover(
  p_company_id uuid,p_notice_id uuid,p_request_id uuid,p_expected uuid,p_mime text,p_base64 text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  bytes bytea;
  previous uuid;
  saved uuid;
  signature bytea;
begin
  if p_request_id is null or (p_mime is null)<>(p_base64 is null) then
    raise exception using errcode='22023',message='Confira a capa do aviso.';
  end if;
  if p_mime is not null then
    if p_mime not in ('image/png','image/jpeg') or length(p_base64) not between 16 and 1398104 then
      raise exception using errcode='22023',message='Selecione um PNG ou JPEG de até 1 MiB.';
    end if;
    bytes:=decode(p_base64,'base64');
    if octet_length(bytes) not between 12 and 1048576
      or (p_mime='image/png' and substring(bytes from 1 for 8)<>decode('89504e470d0a1a0a','hex'))
      or (p_mime='image/jpeg' and substring(bytes from 1 for 3)<>decode('ffd8ff','hex')) then
      raise exception using errcode='22023',message='Imagem inválida.';
    end if;
  end if;
  signature:=sha256(convert_to(jsonb_build_array('notice-cover',p_notice_id,p_expected,p_mime,
    encode(sha256(bytes),'hex'))::text,'UTF8'));
  perform 1 from cali_workspace.notices n where n.id=p_notice_id and n.status='published' and n.audience='selected'
    and exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id=p_company_id)
    and not exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id<>p_company_id)
  for update;
  if not found then raise exception using errcode='42501',message='Aviso indisponível.'; end if;
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select id into previous from cali_session_guard.phase4_notice_cover where notice_id=p_notice_id and current;
  if previous is distinct from p_expected then
    raise exception using errcode='40001',message='A capa mudou. Atualize o mural.';
  end if;
  update cali_session_guard.phase4_notice_cover set current=false where id=previous;
  insert into cali_session_guard.phase4_notice_cover(notice_id,mime_type,content,saved_by)
    values(p_notice_id,p_mime,bytes,actor) returning id into saved;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'notice_cover_changed','notice',p_notice_id,jsonb_build_object('removed',p_mime is null));
  return saved;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_notice_cover(
  p_company_id uuid,p_notice_id uuid,p_cover_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.phase4_notice_interaction_actor(p_company_id,p_notice_id);
  payload jsonb;
begin
  if exists(select 1 from cali_workspace.profiles where id=actor and role::text='client')
    and cali_workspace.can_read_notice(p_notice_id) is distinct from true then
    raise exception using errcode='42501',message='Capa indisponível.';
  end if;
  select jsonb_build_object('mimeType',mime_type,'content',encode(content,'base64')) into payload
    from cali_session_guard.phase4_notice_cover
    where id=p_cover_id and notice_id=p_notice_id and current and content is not null;
  if payload is null then raise exception using errcode='42501',message='Capa indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

revoke all on function cali_workspace.v2_save_pilot_notice_cover(uuid,uuid,uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_notice_cover(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_pilot_notice_cover(uuid,uuid,uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_notice_cover(uuid,uuid,uuid) to authenticated;
-- Acrescenta só os metadados à projeção instalada, preservando os demais catálogos.
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_read_pilot_catalog(uuid,text,date,integer)'::regprocedure);
  previous text := 'jsonb_agg(to_jsonb(page) order by instant desc nulls last,day desc nulls last,id)';
  next text := $projection$jsonb_agg(to_jsonb(page)||case when p_module='notices' then jsonb_build_object(
    'noticeCoverEnabled',to_regprocedure('cali_workspace.v2_save_pilot_notice_cover(uuid,uuid,uuid,uuid,text,text)') is not null,
    'noticeCoverVersion',case when page.status='published' and
      to_regprocedure('cali_workspace.v2_read_pilot_notice_cover(uuid,uuid,uuid)') is not null then (
        select c.id from cali_session_guard.phase4_notice_cover c where c.notice_id=page.id and c.current
      ) end,
    'noticeHasCover',case when page.status='published' and
      to_regprocedure('cali_workspace.v2_read_pilot_notice_cover(uuid,uuid,uuid)') is not null then exists(
        select 1 from cali_session_guard.phase4_notice_cover c where c.notice_id=page.id and c.current and c.content is not null
      ) else false end
  ) else '{}'::jsonb end order by instant desc nulls last,day desc nulls last,id)$projection$;
begin
  if strpos(definition,next)>0 then return; end if;
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
    raise exception 'Projeção do catálogo de avisos mudou.';
  end if;
  execute replace(definition,previous,next);
end;
$$;
notify pgrst,'reload schema';
commit;
