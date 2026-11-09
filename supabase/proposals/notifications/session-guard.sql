-- FLOW-14. CALI MAPA. Executar após reconciliar o catálogo de notificações.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('cali_session_guard.session_is_live()') is null
     or not exists (
       select 1 from pg_catalog.pg_class
       where oid = to_regclass('cali_workspace.notifications') and relrowsecurity
     )
     or (select md5(prosrc) from pg_catalog.pg_proc
         where oid = to_regprocedure('cali_workspace.mark_notification_read(uuid)'))
        is distinct from '2b1efd3e3683bcd4e389f25c1ceae4e6'
     or (select md5(prosrc) from pg_catalog.pg_proc
         where oid = to_regprocedure('cali_workspace.mark_all_notifications_read()'))
        is distinct from '9995db8a85c68e4728592d2cc4f2ee97' then
    raise exception 'Contrato de notificações divergente do catálogo revisado.';
  end if;
end;
$$;

-- O helper compartilhado aplica o corte do piloto. Fora do piloto ele
-- não verifica Auth, então a existência da sessão é exigida separadamente.
create function cali_session_guard.notification_session_is_live()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.user_id = (select auth.uid())
      and s.id::text = (select auth.jwt() ->> 'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
  ) and cali_session_guard.session_is_live() is true;
$$;

revoke all on function cali_session_guard.notification_session_is_live()
  from public, anon, authenticated, service_role;
grant execute on function cali_session_guard.notification_session_is_live() to authenticated;

create policy v2_notification_live_select on cali_workspace.notifications
  as restrictive for select to authenticated
  using ((select cali_session_guard.notification_session_is_live()));

create policy v2_notification_live_update on cali_workspace.notifications
  as restrictive for update to authenticated
  using ((select cali_session_guard.notification_session_is_live()))
  with check ((select cali_session_guard.notification_session_is_live()));

-- As funções mantêm assinatura, ACL e vínculo com o destinatário.
-- O no-op sem destinatário preserva chamadas internas sem sujeito.
create or replace function cali_workspace.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  recipient uuid := auth.uid();
begin
  if recipient is null then return; end if;
  if not cali_session_guard.notification_session_is_live() then
    raise exception using errcode = '42501', message = 'Sessão indisponível.';
  end if;
  update cali_workspace.notifications
     set read_at = coalesce(read_at, now())
   where id = p_notification_id
     and user_id = recipient;
end;
$$;

create or replace function cali_workspace.mark_all_notifications_read()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  recipient uuid := auth.uid();
begin
  if recipient is null then return; end if;
  if not cali_session_guard.notification_session_is_live() then
    raise exception using errcode = '42501', message = 'Sessão indisponível.';
  end if;
  update cali_workspace.notifications
     set read_at = coalesce(read_at, now())
   where user_id = recipient
     and read_at is null;
end;
$$;

commit;
