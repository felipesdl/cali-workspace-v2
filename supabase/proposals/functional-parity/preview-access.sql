-- Contrato do acesso sintético em projeto separado, sobre a admissão V2 reconciliada.
begin;
set local lock_timeout='5s';

create table cali_session_guard.preview_access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  delivered boolean,
  used_at timestamptz
);
create index preview_access_codes_user_time on cali_session_guard.preview_access_codes(user_id,created_at desc);
alter table cali_session_guard.preview_access_codes enable row level security;
revoke all on cali_session_guard.preview_access_codes from public,anon,authenticated,service_role;

-- Partner tem allowlist independente. A linha só pode apontar para convite administrativo ativo.
create table cali_session_guard.preview_partner_recipients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recipient_email text not null unique,
  invite_id uuid not null unique references cali_session_guard.phase4_staff_invites(id) on delete cascade,
  check (recipient_email=lower(btrim(recipient_email)))
);
alter table cali_session_guard.preview_partner_recipients enable row level security;
revoke all on cali_session_guard.preview_partner_recipients from public,anon,authenticated,service_role;

create function cali_workspace.v2_preview_access_code(
  p_action text,p_email text default null,p_hash text default null,
  p_id uuid default null,p_delivered boolean default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  email_address text:=lower(btrim(p_email));
  actor cali_workspace.profiles;
  item cali_session_guard.preview_access_codes;
  proof_id uuid;
  now_at timestamptz;
begin
  if p_action='delivery' then
    update cali_session_guard.preview_access_codes set delivered=p_delivered,
      used_at=case when not p_delivered then clock_timestamp() end
    where id=p_id and p_delivered is not null and delivered is null and used_at is null;
    return null;
  end if;
  if p_action is null or p_action not in ('issue','consume') or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='Operação inválida.';
  end if;
  select p.* into actor from cali_workspace.profiles p join auth.users u on u.id=p.id
    where lower(p.email)=email_address and lower(u.email)=email_address and u.email_confirmed_at is not null
      and p.active and p.role in ('admin','client');
  if actor.id is null then
    select u.id,'partner' into actor.id,actor.role from auth.users u
      join cali_session_guard.preview_partner_recipients r on r.user_id=u.id and r.recipient_email=email_address
      join cali_session_guard.phase4_staff_invites i on i.id=r.invite_id and i.target_user_id=u.id
      where lower(u.email)=email_address and u.email_confirmed_at is not null
        and i.revoked_at is null and (i.accepted_at is not null or i.expires_at>clock_timestamp())
        and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,u.id);
  end if;
  if actor.id is null or cali_session_guard.profile_login_eligible(actor.id) is distinct from true then
    return case when p_action='issue' then '{"status":"unavailable"}'::jsonb else null end;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text,20261111));
  now_at:=clock_timestamp();
  select * into item from cali_session_guard.preview_access_codes
    where user_id=actor.id order by created_at desc limit 1 for update;
  if p_action='issue' then
    if item.created_at>now_at-interval '2 minutes' then return '{"status":"limited"}'::jsonb; end if;
    update cali_session_guard.preview_access_codes set used_at=now_at where user_id=actor.id and used_at is null;
    insert into cali_session_guard.preview_access_codes(user_id,code_hash,created_at,expires_at)
      values(actor.id,p_hash,now_at,now_at+interval '10 minutes') returning * into item;
    return jsonb_build_object('status','issued','id',item.id);
  end if;
  if item.id is null or item.delivered is distinct from true or item.used_at is not null
    or item.expires_at<=now_at or item.attempts>=5 then return null; end if;
  update cali_session_guard.preview_access_codes set attempts=attempts+1 where id=item.id;
  if item.code_hash<>p_hash then return null; end if;
  proof_id:=cali_session_guard.authorize_code(actor.id,item.created_at);
  if proof_id is null then return null; end if;
  update cali_session_guard.preview_access_codes set used_at=now_at where id=item.id;
  return jsonb_build_object('email',email_address,'role',actor.role,
    'userId',actor.id,'authorizationId',proof_id);
end $$;
revoke all on function cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean) to service_role;
notify pgrst,'reload schema';
commit;
