create table cali_workspace.notice_comments(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null,company_id uuid,
 author_user_id uuid not null,author_role text not null,body text not null,created_at timestamptz not null default now()
);
create table cali_workspace.notice_reactions(
 notice_id uuid not null,user_id uuid not null,company_id uuid,reaction text not null,
 created_at timestamptz not null default now(),primary key(notice_id,user_id)
);
alter table cali_workspace.notice_comments enable row level security;
grant select on cali_workspace.notice_comments to authenticated;
create policy fixture_notice_comments_read on cali_workspace.notice_comments
  for select to authenticated using (true);
\ir notice-interactions.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  directed uuid:=gen_random_uuid();
  general uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  target_comment uuid;
  moderation_request uuid:=gen_random_uuid();
  hidden_version uuid;
  payload jsonb;
begin
  insert into cali_workspace.notices(id,title,audience,status) values(general,'Aviso geral','all','published');
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_publish_pilot_notice(a,directed,'comunicado','Aviso dirigido','Texto','2026-11-07');
  perform cali_workspace.fixture_as('clientA');
  target_comment:=cali_workspace.v2_comment_pilot_notice(a,request,directed,'Comentário sintético');
  assert cali_workspace.v2_comment_pilot_notice(a,request,directed,'Comentário sintético')=target_comment;
  begin
    perform cali_workspace.v2_comment_pilot_notice(a,request,directed,'Outro texto');
    raise exception 'Reexecução com texto diferente aceita';
  exception when serialization_failure then null; end;
  perform cali_workspace.v2_react_pilot_notice(a,directed,null,'like');
  perform cali_workspace.v2_react_pilot_notice(a,directed,null,'like');
  perform cali_workspace.v2_react_pilot_notice(a,directed,'like','love');
  begin
    perform cali_workspace.v2_react_pilot_notice(a,directed,'like','clap');
    raise exception 'Reação obsoleta sobrescrita';
  exception when serialization_failure then null; end;
  payload:=cali_workspace.v2_read_pilot_notice_interactions(a,directed,1);
  assert payload->>'ownReaction'='love' and payload#>>'{totals,love}'='1';
  assert jsonb_array_length(payload->'comments')=1 and payload#>>'{comments,0,authorRole}'='client';
  perform cali_workspace.v2_react_pilot_notice(a,directed,'love',null);
  assert cali_workspace.v2_read_pilot_notice_interactions(a,directed,1)#>>'{totals,love}'='0';
  perform cali_workspace.v2_comment_pilot_notice(a,gen_random_uuid(),general,'Somente empresa A');
  perform cali_workspace.v2_react_pilot_notice(a,general,null,'like');
  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_read_pilot_notice_interactions(b,directed,1);
    raise exception 'B abriu conversa de aviso dirigido para A';
  exception when insufficient_privilege then null; end;
  payload:=cali_workspace.v2_read_pilot_notice_interactions(b,general,1);
  assert payload->'comments'='[]'::jsonb and payload#>>'{totals,like}'='0';
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_comment_pilot_notice(a,gen_random_uuid(),directed,'Sem MFA');
    raise exception 'Comentário Admin sem MFA aceito';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_comment_pilot_notice(a,gen_random_uuid(),directed,'Resposta Admin');
  assert jsonb_array_length(cali_workspace.v2_read_pilot_notice_interactions(a,directed,1)->'comments')=2;
  assert cali_workspace.v2_moderate_pilot_notice_comment(a,directed,target_comment,moderation_request,null,true,'Ocultar conteúdo')=target_comment;
  assert cali_workspace.v2_moderate_pilot_notice_comment(a,directed,target_comment,moderation_request,null,true,'Ocultar conteúdo')=target_comment;
  select (entry->>'moderationVersion')::uuid into hidden_version
    from jsonb_array_elements(cali_workspace.v2_read_pilot_notice_interactions(a,directed,1)->'comments') entry
    where entry->>'id'=target_comment::text and (entry->>'hidden')::boolean;
  assert hidden_version is not null;
  begin
    perform cali_workspace.v2_moderate_pilot_notice_comment(b,general,target_comment,gen_random_uuid(),hidden_version,false,'Outra empresa');
    raise exception 'Moderação cruzada';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_moderate_pilot_notice_comment(a,directed,target_comment,gen_random_uuid(),null,false,'Versão anterior');
    raise exception 'Moderação desatualizada';
  exception when serialization_failure then null; end;
  perform cali_workspace.fixture_as('clientA');
  assert cali_workspace.v2_read_pilot_notice_interactions(a,directed,1)::text not like '%Comentário sintético%';
  assert not exists(select 1 from cali_workspace.notice_comments c where c.id=target_comment);
  begin
    perform cali_workspace.v2_moderate_pilot_notice_comment(a,directed,target_comment,gen_random_uuid(),hidden_version,false,'Cliente alterando');
    raise exception 'Cliente moderou comentário';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_moderate_pilot_notice_comment(a,directed,target_comment,gen_random_uuid(),hidden_version,false,'Restaurar conteúdo')=target_comment;
  perform cali_workspace.fixture_as('clientA');
  assert exists(select 1 from cali_workspace.notice_comments c where c.id=target_comment);
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_react_pilot_notice(a,general,null,'clap');
  begin
    perform cali_workspace.v2_react_pilot_notice(b,general,null,'love');
    raise exception 'Reação de outro contexto alterada';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.v2_set_pilot_notice_state(a,directed,'published','archived');
  begin
    perform cali_workspace.v2_react_pilot_notice(a,directed,null,'like');
    raise exception 'Reação em aviso arquivado aceita';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select count(*) from cali_workspace.activity_log where entity_id=target_comment and event_type like 'notice_comment_%')=2;
  assert (select count(*) from cali_workspace.notifications where entity_id=directed)=1;
  assert not exists(select 1 from cali_workspace.notifications where entity_id=directed and email_required);
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_notice_interactions(uuid,uuid,integer)','execute');
end $$;
rollback;
\ir rollback-notice-interactions.sql
\echo Fase 4C: comentários e reações por empresa com reexecução, conflito e arquivo validado.
