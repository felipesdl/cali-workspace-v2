-- FLOW-14. Projeção própria para a V2, protegida por sessão e aceite vigente.
begin;
set local lock_timeout = '5s';

create function cali_session_guard.require_notification_recipient()
returns table (recipient_id uuid, scoped_company_id uuid)
language plpgsql stable set search_path = ''
as $$
declare
  recipient uuid := auth.uid();
begin
  if recipient is null
     or not cali_session_guard.notification_session_is_live()
     or (cali_workspace.v2_read_terms_state() ->> 'accepted') is distinct from 'true' then
    raise exception using errcode = '42501', message = 'Acesso às notificações indisponível.';
  end if;
  return query
    select p.id, case when p.role::text = 'client' then p.company_id end
    from cali_workspace.profiles p
    where p.id = recipient and p.active
      and (p.role::text = 'admin' or (p.role::text = 'client' and p.company_id is not null));
  if not found then
    raise exception using errcode = '42501', message = 'Acesso às notificações indisponível.';
  end if;
end;
$$;
revoke all on function cali_session_guard.require_notification_recipient()
  from public, anon, authenticated, service_role;

create function cali_workspace.v2_list_my_notifications()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  scope record;
begin
  select * into strict scope from cali_session_guard.require_notification_recipient();
  return jsonb_build_object(
    'unread', (
      select count(*) from cali_workspace.notifications
      where user_id = scope.recipient_id and read_at is null
        and (scope.scoped_company_id is null or company_id is null or company_id = scope.scoped_company_id)
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'title', n.title, 'body', n.body, 'createdAt', n.created_at, 'readAt', n.read_at,
        'companyId', n.company_id, 'entityType', n.entity_type, 'entityId', n.entity_id
      ) order by n.created_at desc, n.id desc)
      from (
        select id, title, body, created_at, read_at, company_id, entity_type, entity_id
        from cali_workspace.notifications
        where user_id = scope.recipient_id
          and (scope.scoped_company_id is null or company_id is null or company_id = scope.scoped_company_id)
        order by created_at desc, id desc
        limit 25
      ) n
    ), '[]'::jsonb)
  );
end;
$$;

-- ID nulo representa a ação explícita de marcar todas as próprias.
create function cali_workspace.v2_mark_my_notifications_read(p_notification_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  scope record;
  changed integer;
begin
  select * into strict scope from cali_session_guard.require_notification_recipient();
  update cali_workspace.notifications
     set read_at = statement_timestamp()
   where user_id = scope.recipient_id
     and (scope.scoped_company_id is null or company_id is null or company_id = scope.scoped_company_id)
     and read_at is null
     and (p_notification_id is null or id = p_notification_id);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function cali_workspace.v2_list_my_notifications(),
  cali_workspace.v2_mark_my_notifications_read(uuid) from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_list_my_notifications(),
  cali_workspace.v2_mark_my_notifications_read(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
