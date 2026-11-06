-- FLOW-11: PDFs novos do piloto. Bytes e metadados são gravados na mesma transação.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.phase4_documents (
  id uuid primary key,
  company_id uuid not null,
  title text not null,
  created_at timestamptz not null default clock_timestamp(),
  published_revision uuid
);
create table if not exists cali_session_guard.phase4_document_revisions (
  id uuid primary key,
  document_id uuid not null references cali_session_guard.phase4_documents(id),
  number integer not null check (number > 0),
  file_name text not null,
  content bytea not null check (octet_length(content) between 8 and 2097152),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default clock_timestamp(),
  unique (document_id,number),
  unique (document_id,id)
);
alter table cali_session_guard.phase4_documents
  drop constraint if exists phase4_published_revision_belongs_to_document;
alter table cali_session_guard.phase4_documents
  add constraint phase4_published_revision_belongs_to_document
  foreign key (id,published_revision) references cali_session_guard.phase4_document_revisions(document_id,id);
create table if not exists cali_session_guard.phase4_document_acknowledgments (
  revision_id uuid not null references cali_session_guard.phase4_document_revisions(id),
  actor_id uuid not null,
  acknowledged_at timestamptz not null default clock_timestamp(),
  primary key (revision_id,actor_id)
);
alter table cali_session_guard.phase4_documents enable row level security;
alter table cali_session_guard.phase4_document_revisions enable row level security;
alter table cali_session_guard.phase4_document_acknowledgments enable row level security;
revoke all on cali_session_guard.phase4_documents,cali_session_guard.phase4_document_revisions,
  cali_session_guard.phase4_document_acknowledgments from public,anon,authenticated,service_role;

create function cali_workspace.v2_add_pilot_document_revision(
  p_company_id uuid,p_document_id uuid,p_revision_id uuid,p_expected_latest uuid,
  p_title text,p_file_name text,p_pdf_base64 text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  existing cali_session_guard.phase4_documents%rowtype;
  latest uuid;
  next_number integer;
  bytes bytea;
begin
  if p_document_id is null or p_revision_id is null
    or coalesce(length(btrim(p_title)),0) not between 1 and 180
    or coalesce(length(p_file_name),0) not between 5 and 180
    or lower(right(p_file_name,4)) <> '.pdf' or p_file_name ~ '[[:cntrl:]/]' or position(chr(92) in p_file_name)>0
    or coalesce(length(p_pdf_base64),0) not between 12 and 2796204 then
    raise exception using errcode='22023',message='Informe um PDF de até 2 MiB.';
  end if;
  bytes := decode(p_pdf_base64,'base64');
  if octet_length(bytes) not between 8 and 2097152 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
    raise exception using errcode='22023',message='O conteúdo não começa com um cabeçalho PDF válido.';
  end if;

  if p_expected_latest is null then
    insert into cali_session_guard.phase4_documents(id,company_id,title)
    values(p_document_id,p_company_id,btrim(p_title)) on conflict(id) do nothing;
  end if;
  select * into existing from cali_session_guard.phase4_documents d
  where d.id=p_document_id and d.company_id=p_company_id for update;
  if not found then raise exception using errcode='42501',message='Documento indisponível.'; end if;

  if existing.title=btrim(p_title) and exists(
    select 1 from cali_session_guard.phase4_document_revisions v
    where v.document_id=p_document_id and v.id=p_revision_id and v.uploaded_by=actor
      and v.file_name=p_file_name and v.content=bytes
  ) then return p_revision_id; end if;

  select v.id,v.number+1 into latest,next_number from cali_session_guard.phase4_document_revisions v
  where v.document_id=p_document_id order by v.number desc limit 1;
  if latest is distinct from p_expected_latest or existing.title<>btrim(p_title) then
    raise exception using errcode='40001',message='O documento mudou. Recarregue as versões.';
  end if;
  insert into cali_session_guard.phase4_document_revisions(id,document_id,number,file_name,content,uploaded_by)
  values(p_revision_id,p_document_id,coalesce(next_number,1),p_file_name,bytes,actor);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'document_revision_added','document',p_document_id,jsonb_build_object('revisionId',p_revision_id));
  return p_revision_id;
end;
$$;

create function cali_workspace.v2_set_pilot_document_publication(
  p_company_id uuid,p_document_id uuid,p_expected_published uuid,p_next_revision uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  published uuid;
  latest uuid;
begin
  select d.published_revision into published from cali_session_guard.phase4_documents d
  where d.id=p_document_id and d.company_id=p_company_id for update;
  if not found then raise exception using errcode='42501',message='Documento indisponível.'; end if;
  if published is not distinct from p_next_revision then return p_document_id; end if;
  if published is distinct from p_expected_published then
    raise exception using errcode='40001',message='A publicação mudou. Recarregue o documento.';
  end if;
  if p_next_revision is not null then
    select v.id into latest from cali_session_guard.phase4_document_revisions v
    where v.document_id=p_document_id order by v.number desc limit 1;
    if latest is distinct from p_next_revision then
      raise exception using errcode='40001',message='Somente a revisão mais recente pode ser publicada.';
    end if;
  end if;
  update cali_session_guard.phase4_documents set published_revision=p_next_revision where id=p_document_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,case when p_next_revision is null then 'document_withdrawn' else 'document_published' end,
    'document',p_document_id,jsonb_build_object('previousRevisionId',published,'revisionId',p_next_revision));
  return p_document_id;
end;
$$;

create function cali_workspace.v2_list_pilot_documents(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id),'[]'::jsonb)
    from (
      select d.id,d.title,d.created_at,d.published_revision as "publishedRevision",
        v.id as "revisionId",v.number,v.file_name as "fileName",
        exists(select 1 from cali_session_guard.phase4_document_acknowledgments a
          where a.revision_id=v.id and a.actor_id=actor) as acknowledged
      from cali_session_guard.phase4_documents d
      join lateral (
        select r.id,r.number,r.file_name from cali_session_guard.phase4_document_revisions r
        where r.document_id=d.id and (admin or r.id=d.published_revision)
        order by r.number desc limit 1
      ) v on true
      where d.company_id=p_company_id
      order by d.created_at desc,d.id limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

create function cali_workspace.v2_list_pilot_document_history(p_company_id uuid,p_document_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by number desc),'[]'::jsonb) from (
      select v.id,v.number,v.file_name as "fileName"
      from cali_session_guard.phase4_documents d join cali_session_guard.phase4_document_revisions v on v.document_id=d.id
      where d.company_id=p_company_id and d.id=p_document_id
      order by v.number desc limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

create function cali_workspace.v2_read_pilot_document_pdf(p_company_id uuid,p_document_id uuid,p_revision_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  file_payload jsonb;
begin
  select jsonb_build_object('id',v.id,'fileName',v.file_name,'content',encode(v.content,'base64'),
    'sha256',encode(sha256(v.content),'hex')) into file_payload
  from cali_session_guard.phase4_documents d join cali_session_guard.phase4_document_revisions v on v.document_id=d.id
  where d.id=p_document_id and d.company_id=p_company_id and v.id=p_revision_id
    and (admin or d.published_revision=v.id) for share of d;
  if not found then raise exception using errcode='42501',message='Versão indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return file_payload;
end;
$$;

create function cali_workspace.v2_ack_pilot_document(p_company_id uuid,p_document_id uuid,p_revision_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
begin
  perform 1 from cali_session_guard.phase4_documents d where d.id=p_document_id and d.company_id=p_company_id
    and d.published_revision=p_revision_id for share;
  if not found then raise exception using errcode='42501',message='Versão indisponível.'; end if;
  insert into cali_session_guard.phase4_document_acknowledgments(revision_id,actor_id)
  values(p_revision_id,actor) on conflict do nothing;
  return p_revision_id;
end;
$$;

revoke all on function cali_workspace.v2_add_pilot_document_revision(uuid,uuid,uuid,uuid,text,text,text),
  cali_workspace.v2_set_pilot_document_publication(uuid,uuid,uuid,uuid),
  cali_workspace.v2_list_pilot_documents(uuid,integer),
  cali_workspace.v2_list_pilot_document_history(uuid,uuid,integer),
  cali_workspace.v2_read_pilot_document_pdf(uuid,uuid,uuid),
  cali_workspace.v2_ack_pilot_document(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_add_pilot_document_revision(uuid,uuid,uuid,uuid,text,text,text),
  cali_workspace.v2_set_pilot_document_publication(uuid,uuid,uuid,uuid),
  cali_workspace.v2_list_pilot_documents(uuid,integer),
  cali_workspace.v2_list_pilot_document_history(uuid,uuid,integer),
  cali_workspace.v2_read_pilot_document_pdf(uuid,uuid,uuid),
  cali_workspace.v2_ack_pilot_document(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
