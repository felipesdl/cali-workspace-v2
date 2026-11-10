-- Candidata exclusiva para cópia com a baseline local de publicação e recibos.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only'
     or current_user <> 'postgres'
     or current_database() !~ '^cali_session_cut_20261101_[0-9a-f]{8}$'
     or to_regprocedure('cali_private.has_current_terms()') is null
     or to_regprocedure('cali_session_guard.profile_requires_admission(uuid)') is null then
    raise exception 'Ensaio de aceite restrito à cópia com publicação local';
  end if;
end $$;

-- O mesmo gate de sessão vale para gravar o recibo pelo servidor.
-- A leitura pública do texto vigente independe de aceite.
create or replace function cali_private.session_is_live()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.user_id = (select auth.uid()) and s.id::text = (select auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > now())
      and (
        not cali_session_guard.profile_requires_admission(s.user_id)
        or cali_session_guard.session_is_live()
      )
  );
$$;

-- Os pontos públicos mantêm os contratos de consulta e aceite. O schema
-- privado não precisa de USAGE adicional para o papel da aplicação.
alter function cali_workspace.get_current_terms() security definer;
alter function cali_workspace.accept_current_terms(text,text) security definer;
revoke execute on function cali_private.get_current_terms(),
  cali_private.accept_current_terms(text,text) from anon, authenticated;

create function cali_session_guard.workspace_file_terms_are_current()
returns boolean language sql stable security definer set search_path = '' as $$
  select not cali_session_guard.profile_requires_admission((select auth.uid()))
    or (cali_session_guard.session_is_live() and cali_private.has_current_terms());
$$;

revoke all on function cali_session_guard.workspace_file_terms_are_current()
  from public, anon, authenticated, service_role;
grant execute on function cali_session_guard.workspace_file_terms_are_current() to authenticated;

-- Exigência adicional. As políticas existentes ainda precisam autorizar o objeto.
create policy v2_current_terms_for_workspace_files on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'cali-workspace-private'
    or (select cali_session_guard.workspace_file_terms_are_current())
  );

commit;
