-- CANDIDATA NÃO APLICADA. Fora de migrations e dos runners.
-- Requer catálogo revisado, teste em cópia isolada e autorização de aplicação.
-- Não altera auth.sessions, helpers/policies existentes, códigos ou funções RPC.
begin;
do $$
begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
    or current_user <> 'postgres'
    or not (select rolbypassrls or rolsuper from pg_roles where rolname=current_user) then
    raise exception 'Candidata bloqueada: revisão de catálogo/owner e autorização pendentes';
  end if;
  if to_regnamespace('cali_session_guard') is not null then
    raise exception 'Namespace já existe; reconciliar em vez de sobrescrever';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='cali_workspace' and c.relkind='r' and c.relrowsecurity
        and c.relname in ('profiles','companies','client_invites','terms_acceptances')) <> 4 then
    raise exception 'Recorte esperado de quatro tabelas com RLS não confere';
  end if;
  -- A existência das demais colunas/tipos é validada ao criar as funções/queries.
  perform s.id,s.user_id,s.created_at,s.not_after from auth.sessions s limit 0;
  perform p.id,p.role,p.company_id,p.active from cali_workspace.profiles p limit 0;
  perform c.id,c.status from cali_workspace.companies c limit 0;
end $$;

create schema cali_session_guard authorization postgres;
revoke all on schema cali_session_guard from public,anon,authenticated,service_role;
-- Uma linha técnica por identidade; não substitui histórico de produto/auditoria.
create table cali_session_guard.profile_cutoffs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revoked_before timestamptz not null
);
alter table cali_session_guard.profile_cutoffs enable row level security;
revoke all on cali_session_guard.profile_cutoffs from public,anon,authenticated,service_role;

create function cali_session_guard.session_is_live()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from auth.sessions s
    join cali_workspace.profiles p on p.id=s.user_id
    left join cali_workspace.companies c on c.id=p.company_id
    left join cali_session_guard.profile_cutoffs r on r.user_id=s.user_id
    where s.user_id=(select auth.uid())
      and s.id::text=(select auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after>statement_timestamp())
      and (r.revoked_before is null or s.created_at>r.revoked_before)
      and p.active is true
      and (p.role::text <> 'client' or c.status::text in ('active','paused'))
  );
$$;
revoke all on function cali_session_guard.session_is_live() from public,anon,authenticated,service_role;
grant usage on schema cali_session_guard to authenticated;
grant execute on function cali_session_guard.session_is_live() to authenticated;

-- Restritiva: permissivas existentes não podem liberar uma sessão cortada.
-- Não concede privilégios nem substitui predicados de ator/empresa/MFA/termos.
create policy v2_live_session on cali_workspace.profiles as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_live_session on cali_workspace.companies as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_live_session on cali_workspace.client_invites as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));
create policy v2_live_session on cali_workspace.terms_acceptances as restrictive for all to authenticated
  using ((select cali_session_guard.session_is_live()))
  with check ((select cali_session_guard.session_is_live()));

create function cali_session_guard.cut_profile_sessions()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.active is distinct from new.active or old.company_id is distinct from new.company_id
      or old.role is distinct from new.role then
    insert into cali_session_guard.profile_cutoffs(user_id,revoked_before)
      values (new.id,clock_timestamp())
      on conflict (user_id) do update set revoked_before=greatest(
        cali_session_guard.profile_cutoffs.revoked_before,excluded.revoked_before);
  end if;
  return new;
end; $$;
-- Também corta na reativação: sessões criadas durante o bloqueio não ressuscitam.
create trigger v2_profile_session_cut after update of active,company_id,role on cali_workspace.profiles
  for each row execute function cali_session_guard.cut_profile_sessions();

create function cali_session_guard.cut_company_sessions()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and
      (old.status::text in ('blocked','closed','archived')
       or new.status::text in ('blocked','closed','archived')) then
    insert into cali_session_guard.profile_cutoffs(user_id,revoked_before)
      select p.id,clock_timestamp() from cali_workspace.profiles p
      where p.company_id=new.id and p.role::text='client'
      on conflict (user_id) do update set revoked_before=greatest(
        cali_session_guard.profile_cutoffs.revoked_before,excluded.revoked_before);
  end if;
  return new;
end; $$;
create trigger v2_company_session_cut after update of status on cali_workspace.companies
  for each row execute function cali_session_guard.cut_company_sessions();
revoke all on function cali_session_guard.cut_profile_sessions(),cali_session_guard.cut_company_sessions()
  from public,anon,authenticated,service_role;
commit;
