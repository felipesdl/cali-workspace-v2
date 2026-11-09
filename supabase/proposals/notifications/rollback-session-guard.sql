-- Restaura os corpos e search_path anteriores. Conserva as leituras registradas.
begin;
set local lock_timeout = '5s';

drop policy if exists v2_notification_live_select on cali_workspace.notifications;
drop policy if exists v2_notification_live_update on cali_workspace.notifications;

create or replace function cali_workspace.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = cali_workspace, public
as $$
begin
  update cali_workspace.notifications
     set read_at = coalesce(read_at, now())
   where id = p_notification_id
     and user_id = auth.uid();
end;
$$;

create or replace function cali_workspace.mark_all_notifications_read()
returns void
language plpgsql security definer set search_path = cali_workspace, public
as $$
begin
  update cali_workspace.notifications
     set read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and read_at is null;
end;
$$;

drop function if exists cali_session_guard.notification_session_is_live();

commit;
