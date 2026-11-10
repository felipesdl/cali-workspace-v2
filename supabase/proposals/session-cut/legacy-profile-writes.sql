-- Candidata para sobrecargas legadas que escrevem perfis como SECURITY DEFINER.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only'
     or current_user <> 'postgres'
     or to_regprocedure('cali_session_guard.session_is_live()') is null then
    raise exception 'Revisão isolada do corte obrigatória';
  end if;
end $$;

create function cali_session_guard.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- O papel do JWT é o do chamador da API. current_user dentro de uma
  -- RPC SECURITY DEFINER é o dono da função e não identifica esse chamador.
  if (select auth.jwt()->>'role') = 'authenticated'
    and not cali_session_guard.session_is_live() then
    raise exception using errcode = '42501', message = 'Sessão indisponível.';
  end if;
  return new;
end;
$$;

revoke all on function cali_session_guard.guard_profile_update()
  from public, anon, authenticated, service_role;
create trigger v2_guard_profile_update before update on cali_workspace.profiles
  for each row execute function cali_session_guard.guard_profile_update();
commit;
