-- Registro privado do piloto. O fluxo legado continua com seu próprio registro.
begin;
set local lock_timeout = '5s';

create table cali_session_guard.pilot_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references cali_session_guard.pilot_accounts(profile_id),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  delivery text not null default 'pending' check (delivery in ('pending', 'delivered', 'failed')),
  used_at timestamptz,
  check (expires_at > created_at)
);
create index pilot_codes_by_profile on cali_session_guard.pilot_codes (profile_id, created_at desc);
alter table cali_session_guard.pilot_codes enable row level security;
revoke all on cali_session_guard.pilot_codes from public, anon, authenticated, service_role;

create function cali_workspace.v2_issue_pilot_code(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  subject uuid;
  code_id uuid;
  now_at timestamptz;
begin
  select profile_id into subject from cali_session_guard.pilot_accounts
  where recipient_email = lower(btrim(p_email)) for update;
  if subject is null or not cali_session_guard.profile_login_eligible(subject) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  now_at := clock_timestamp();
  if exists (select 1 from cali_session_guard.pilot_codes
      where profile_id = subject and created_at > now_at - interval '2 minutes') then
    return jsonb_build_object('status', 'limited');
  end if;
  update cali_session_guard.pilot_codes set used_at = now_at
    where profile_id = subject and used_at is null;
  insert into cali_session_guard.pilot_codes (profile_id, code_hash, created_at, expires_at)
  values (subject, p_hash, now_at, now_at + interval '10 minutes') returning id into code_id;
  return jsonb_build_object('status', 'issued', 'id', code_id);
end;
$$;

create function cali_workspace.v2_deliver_pilot_code(p_id uuid, p_delivered boolean)
returns void language sql security definer set search_path = ''
as $$
  update cali_session_guard.pilot_codes
  set delivery = case when p_delivered then 'delivered' else 'failed' end,
      used_at = case when p_delivered then used_at else clock_timestamp() end
  where id = p_id and delivery = 'pending' and used_at is null;
$$;

create function cali_workspace.v2_consume_pilot_code(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  account cali_session_guard.pilot_accounts;
  item cali_session_guard.pilot_codes;
  authorization_id uuid;
begin
  select * into account from cali_session_guard.pilot_accounts
  where recipient_email = lower(btrim(p_email)) for update;
  if not found or not cali_session_guard.profile_login_eligible(account.profile_id) then
    return null;
  end if;
  select * into item from cali_session_guard.pilot_codes
  where profile_id = account.profile_id and used_at is null
  order by created_at desc limit 1 for update;
  if item.id is null or item.delivery <> 'delivered'
    or item.expires_at <= clock_timestamp() or item.attempts >= 5 then
    return null;
  end if;
  update cali_session_guard.pilot_codes set attempts = attempts + 1 where id = item.id;
  if item.code_hash is distinct from p_hash then return null; end if;

  authorization_id := cali_session_guard.authorize_code(account.profile_id, item.created_at);
  if authorization_id is null then return null; end if;
  update cali_session_guard.pilot_codes set used_at = clock_timestamp() where id = item.id;
  return jsonb_build_object('email', account.recipient_email, 'role', 'client',
    'userId', account.profile_id, 'authorizationId', authorization_id);
end;
$$;

revoke all on function cali_workspace.v2_issue_pilot_code(text,text),
  cali_workspace.v2_deliver_pilot_code(uuid,boolean), cali_workspace.v2_consume_pilot_code(text,text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_issue_pilot_code(text,text),
  cali_workspace.v2_deliver_pilot_code(uuid,boolean), cali_workspace.v2_consume_pilot_code(text,text)
  to service_role;
notify pgrst, 'reload schema';
commit;
