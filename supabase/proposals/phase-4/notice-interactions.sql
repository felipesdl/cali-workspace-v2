-- FLOW-13. Comentários e reações ficam na empresa selecionada mesmo em avisos gerais.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_notice_comment_moderation (
  comment_id uuid primary key references cali_workspace.notice_comments(id) on delete cascade,
  hidden boolean not null,
  version uuid not null default gen_random_uuid()
);
alter table cali_session_guard.phase4_notice_comment_moderation enable row level security;
revoke all on cali_session_guard.phase4_notice_comment_moderation from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_notice_comment_visible(p_comment_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select not exists(select 1 from cali_session_guard.phase4_notice_comment_moderation m
    where m.comment_id=p_comment_id and m.hidden) or coalesce(cali_workspace.is_admin(),false);
$$;
revoke all on function cali_session_guard.phase4_notice_comment_visible(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_session_guard.phase4_notice_comment_visible(uuid) to anon,authenticated;
drop policy if exists phase4_notice_comment_visibility on cali_workspace.notice_comments;
create policy phase4_notice_comment_visibility on cali_workspace.notice_comments
  as restrictive for select to anon,authenticated
  using (cali_session_guard.phase4_notice_comment_visible(id));

create or replace function cali_session_guard.phase4_notice_interaction_actor(p_company_id uuid,p_notice_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
begin
  if not exists(select 1 from cali_workspace.profiles where id=actor and active and role::text in ('admin','client')) then
    raise exception using errcode='42501',message='Aviso indisponível.';
  end if;
  perform 1 from cali_workspace.notices n
  where n.id=p_notice_id and n.status='published' and (
    n.audience='all' or (n.audience='selected' and exists(
      select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id=p_company_id))
  ) for share;
  if not found then raise exception using errcode='42501',message='Aviso indisponível.'; end if;
  return actor;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_notice_interactions(p_company_id uuid,p_notice_id uuid,p_page integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.phase4_notice_interaction_actor(p_company_id,p_notice_id);
  is_admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return jsonb_build_object(
    'canModerate',is_admin and to_regprocedure('cali_workspace.v2_moderate_pilot_notice_comment(uuid,uuid,uuid,uuid,uuid,boolean,text)') is not null,
    'comments',coalesce((select jsonb_agg(to_jsonb(page) order by "createdAt" desc,id desc) from (
      select c.id,c.body,c.author_role as "authorRole",c.created_at as "createdAt",
        coalesce(m.hidden,false) as hidden,case when is_admin then m.version end as "moderationVersion"
      from cali_workspace.notice_comments c
      left join cali_session_guard.phase4_notice_comment_moderation m on m.comment_id=c.id
      where c.company_id=p_company_id and c.notice_id=p_notice_id and (is_admin or not coalesce(m.hidden,false))
      order by c.created_at desc,c.id desc limit 25 offset (p_page-1)*25
    ) page),'[]'::jsonb),
    'ownReaction',(select r.reaction from cali_workspace.notice_reactions r
      where r.notice_id=p_notice_id and r.user_id=actor and r.company_id=p_company_id),
    'totals',(select jsonb_build_object('like',count(*) filter(where r.reaction='like'),
      'love',count(*) filter(where r.reaction='love'),'clap',count(*) filter(where r.reaction='clap'))
      from cali_workspace.notice_reactions r where r.notice_id=p_notice_id and r.company_id=p_company_id)
  );
end;
$$;

create or replace function cali_workspace.v2_comment_pilot_notice(p_company_id uuid,p_request_id uuid,p_notice_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.phase4_notice_interaction_actor(p_company_id,p_notice_id);
  role_name text := (select p.role::text from cali_workspace.profiles p where p.id=actor);
  body text := btrim(p_body);
  signature bytea;
  saved uuid;
begin
  if coalesce(length(body),0) not between 1 and 2000 then
    raise exception using errcode='22023',message='Informe o comentário.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('notice-comment',p_notice_id,body)::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  insert into cali_workspace.notice_comments(notice_id,company_id,author_user_id,author_role,body)
  values(p_notice_id,p_company_id,actor,role_name,body) returning id into saved;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,saved);
  return saved;
end;
$$;

create or replace function cali_workspace.v2_react_pilot_notice(p_company_id uuid,p_notice_id uuid,p_expected text,p_reaction text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.phase4_notice_interaction_actor(p_company_id,p_notice_id);
  previous cali_workspace.notice_reactions%rowtype;
begin
  if (p_reaction is not null and p_reaction not in ('like','love','clap'))
    or (p_expected is not null and p_expected not in ('like','love','clap')) then
    raise exception using errcode='22023',message='Reação inválida.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-notice-reaction:'||p_notice_id::text||':'||actor::text,0));
  select * into previous from cali_workspace.notice_reactions r
  where r.notice_id=p_notice_id and r.user_id=actor for update;
  if found and previous.company_id is distinct from p_company_id then
    raise exception using errcode='42501',message='Já existe reação em outro contexto.';
  end if;
  if previous.reaction is not distinct from p_reaction then return p_notice_id; end if;
  if previous.reaction is distinct from p_expected then
    raise exception using errcode='40001',message='A reação mudou.';
  end if;
  if p_reaction is null then
    delete from cali_workspace.notice_reactions r where r.notice_id=p_notice_id and r.user_id=actor and r.company_id=p_company_id;
  elsif previous.notice_id is null then
    insert into cali_workspace.notice_reactions(notice_id,user_id,company_id,reaction)
    values(p_notice_id,actor,p_company_id,p_reaction);
  else
    update cali_workspace.notice_reactions r set reaction=p_reaction
    where r.notice_id=p_notice_id and r.user_id=actor and r.company_id=p_company_id;
  end if;
  return p_notice_id;
end;
$$;

create or replace function cali_workspace.v2_moderate_pilot_notice_comment(
  p_company_id uuid,p_notice_id uuid,p_comment_id uuid,p_request_id uuid,p_expected uuid,p_hidden boolean,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  previous cali_session_guard.phase4_notice_comment_moderation%rowtype;
  reason text := btrim(p_reason);
  signature bytea;
  saved uuid;
begin
  perform cali_session_guard.phase4_notice_interaction_actor(p_company_id,p_notice_id);
  if p_request_id is null or p_comment_id is null or p_hidden is null
    or coalesce(length(reason),0) not between 5 and 1000 then
    raise exception using errcode='22023',message='Informe o motivo da moderação.';
  end if;
  perform 1 from cali_workspace.notice_comments c
    where c.id=p_comment_id and c.company_id=p_company_id and c.notice_id=p_notice_id for update;
  if not found then raise exception using errcode='42501',message='Comentário indisponível.'; end if;
  signature:=sha256(convert_to(jsonb_build_array('notice-moderation',p_notice_id,p_comment_id,p_expected,p_hidden,reason)::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select * into previous from cali_session_guard.phase4_notice_comment_moderation where comment_id=p_comment_id;
  if previous.version is distinct from p_expected or coalesce(previous.hidden,false)=p_hidden then
    raise exception using errcode='40001',message='A moderação do comentário mudou.';
  end if;
  insert into cali_session_guard.phase4_notice_comment_moderation(comment_id,hidden)
    values(p_comment_id,p_hidden)
    on conflict(comment_id) do update set hidden=excluded.hidden,version=gen_random_uuid();
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,case when p_hidden then 'notice_comment_hidden' else 'notice_comment_restored' end,
      'notice_comment',p_comment_id,jsonb_build_object('noticeId',p_notice_id,'reason',reason));
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_comment_id);
  return p_comment_id;
end;
$$;

revoke all on function cali_workspace.v2_moderate_pilot_notice_comment(uuid,uuid,uuid,uuid,uuid,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_moderate_pilot_notice_comment(uuid,uuid,uuid,uuid,uuid,boolean,text)
  to authenticated;
revoke all on function cali_session_guard.phase4_notice_interaction_actor(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_read_pilot_notice_interactions(uuid,uuid,integer),
  cali_workspace.v2_comment_pilot_notice(uuid,uuid,uuid,text),
  cali_workspace.v2_react_pilot_notice(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_notice_interactions(uuid,uuid,integer),
  cali_workspace.v2_comment_pilot_notice(uuid,uuid,uuid,text),
  cali_workspace.v2_react_pilot_notice(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
