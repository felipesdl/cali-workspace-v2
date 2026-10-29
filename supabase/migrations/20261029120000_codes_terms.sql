-- Nova implementação local V2; não reproduz DDL ausente do oficial.
create table cali_workspace.legal_versions (
  version text primary key check (length(version) between 1 and 40),
  title text not null check (length(btrim(title)) > 0),
  content text not null check (length(btrim(content)) > 0),
  content_hash text not null,
  created_at timestamptz not null default clock_timestamp()
);
create function cali_private.set_legal_hash()
returns trigger language plpgsql security invoker set search_path = '' as $$ begin
  new.content_hash := encode(sha256(convert_to(new.content, 'UTF8')), 'hex'); return new;
end; $$;
create trigger legal_hash before insert on cali_workspace.legal_versions
  for each row execute function cali_private.set_legal_hash();
create table cali_private.current_legal_version (
  singleton boolean primary key default true check (singleton),
  version text not null references cali_workspace.legal_versions(version) on delete restrict
);
create table cali_workspace.terms_acceptances (
  user_id uuid not null references auth.users(id) on delete restrict,
  version text not null references cali_workspace.legal_versions(version) on delete restrict,
  content_hash text not null,
  accepted_at timestamptz not null default clock_timestamp(),
  primary key (user_id, version)
);
create function cali_private.prevent_legal_rewrite()
returns trigger language plpgsql security invoker set search_path = '' as $$ begin
  raise exception using errcode = '55000', message = 'Versão/aceite jurídico é imutável.';
end; $$;
create trigger legal_versions_immutable before update or delete on cali_workspace.legal_versions
  for each row execute function cali_private.prevent_legal_rewrite();
create trigger terms_acceptances_immutable before update or delete on cali_workspace.terms_acceptances
  for each row execute function cali_private.prevent_legal_rewrite();

create function cali_private.eligible_profile(subject uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cali_workspace.profiles p
    left join cali_workspace.companies c on c.id = p.company_id
    where p.id = subject and p.active and (p.role = 'admin' or
      (p.role = 'client' and c.status in ('active','paused') and exists (
        select 1 from cali_workspace.workspace_adhesions a where a.company_id = c.id))));
$$;
create function cali_private.session_is_live()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s where s.user_id = (select auth.uid())
    and s.id::text = (select auth.jwt()->>'session_id')
    and (s.not_after is null or s.not_after > now()));
$$;
create function cali_private.admin_mfa_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select cali_private.session_is_live()
    and coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (select 1 from cali_workspace.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin')
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified' and f.factor_type = 'totp');
$$;
create function cali_private.has_current_terms()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from cali_private.current_legal_version c
    join cali_workspace.legal_versions v on v.version = c.version
    join cali_workspace.terms_acceptances a on a.version = v.version and a.content_hash = v.content_hash
    where a.user_id = (select auth.uid()));
$$;
create or replace function cali_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select cali_private.admin_mfa_ready() and cali_private.has_current_terms();
$$;
create function cali_private.get_current_terms()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', v.version, 'contentHash', v.content_hash, 'title', v.title, 'content', v.content)
  from cali_workspace.legal_versions v join cali_private.current_legal_version c using(version);
$$;
create function cali_workspace.get_current_terms()
returns jsonb language sql security invoker set search_path = '' as $$ select cali_private.get_current_terms(); $$;

create function cali_private.accept_current_terms("version" text, "contentHash" text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare legal cali_workspace.legal_versions; receipt cali_workspace.terms_acceptances;
begin
  if not cali_private.session_is_live() or not cali_private.eligible_profile(auth.uid()) then
    raise exception using errcode = '42501', message = 'Acesso indisponível.';
  end if;
  if exists (select 1 from cali_workspace.profiles p where p.id = auth.uid() and p.role = 'admin')
    and not cali_private.admin_mfa_ready() then
    raise exception using errcode = '42501', message = 'MFA obrigatório.';
  end if;
  -- Serializa aceite com a publicação de nova versão; conteúdo antigo nunca autoriza o novo.
  perform 1 from cali_private.current_legal_version where singleton for share;
  select v.* into legal from cali_workspace.legal_versions v
    join cali_private.current_legal_version c using(version);
  if legal.version is null or legal.version is distinct from "version" or legal.content_hash is distinct from "contentHash" then
    raise exception using errcode = '22023', message = 'Versão apresentada não é a versão corrente.';
  end if;
  insert into cali_workspace.terms_acceptances(user_id, version, content_hash)
    values (auth.uid(), legal.version, legal.content_hash) on conflict do nothing;
  select * into receipt from cali_workspace.terms_acceptances a where a.user_id = auth.uid() and a.version = legal.version;
  return jsonb_build_object('user_id', receipt.user_id, 'version', receipt.version, 'accepted_at', receipt.accepted_at);
end; $$;
create function cali_workspace.accept_current_terms("version" text, "contentHash" text)
returns jsonb language sql security invoker set search_path = '' as $$
  select cali_private.accept_current_terms("version", "contentHash");
$$;
create function cali_private.workspace_access_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p cali_workspace.profiles; company_status text; state text; legal jsonb; accepted boolean;
begin
  if not cali_private.session_is_live() then
    return jsonb_build_object('status','signed_out','profile',null,'companyStatus',null,'terms',null,'termsAccepted',false);
  end if;
  select * into p from cali_workspace.profiles where id = auth.uid();
  select status into company_status from cali_workspace.companies where id = p.company_id;
  legal := cali_private.get_current_terms(); accepted := cali_private.has_current_terms();
  state := case
    when not cali_private.eligible_profile(auth.uid()) then 'blocked'
    when p.role = 'admin' and not cali_private.admin_mfa_ready() then 'mfa_required'
    when legal is null then 'terms_unavailable'
    when not accepted then 'terms_required'
    else 'ready' end;
  return jsonb_build_object('status',state,
    'profile',case when p.id is null then null else jsonb_build_object('id',p.id,'company_id',p.company_id,'role',p.role,'active',p.active) end,
    'companyStatus',company_status,'terms',legal,'termsAccepted',accepted);
end; $$;
create function cali_workspace.workspace_access_state()
returns jsonb language sql security invoker set search_path = '' as $$ select cali_private.workspace_access_state(); $$;

alter table cali_workspace.legal_versions enable row level security;
alter table cali_workspace.terms_acceptances enable row level security;
create policy terms_self_read on cali_workspace.terms_acceptances for select to authenticated using (user_id = (select auth.uid()) and cali_private.session_is_live());
alter policy profiles_self_read on cali_workspace.profiles using (id = (select auth.uid()) and cali_private.session_is_live());
create function cali_private.own_profile_is_eligible()
returns boolean language sql stable security definer set search_path = '' as $$ select cali_private.eligible_profile(auth.uid()); $$;
create policy companies_client_read on cali_workspace.companies for select to authenticated using (
  cali_private.session_is_live() and cali_private.has_current_terms() and cali_private.own_profile_is_eligible()
  and exists (select 1 from cali_workspace.profiles p where p.id = (select auth.uid()) and p.company_id = companies.id and p.role = 'client')
);

create table cali_private.workspace_access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  delivery text not null default 'pending' check (delivery in ('pending','delivered','failed')),
  used_at timestamptz,
  check (expires_at > created_at)
);
create index workspace_codes_email_date on cali_private.workspace_access_codes(email, created_at desc);

create function cali_private.issue_workspace_code(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare subject uuid; code_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 29120000));
  select u.id into subject from auth.users u where lower(u.email) = lower(btrim(p_email));
  if subject is null or not cali_private.eligible_profile(subject) then return jsonb_build_object('status','unavailable'); end if;
  if exists (select 1 from cali_private.workspace_access_codes where email = lower(btrim(p_email)) and created_at > clock_timestamp() - interval '2 minutes') then
    return jsonb_build_object('status','limited');
  end if;
  update cali_private.workspace_access_codes set used_at = clock_timestamp() where email = lower(btrim(p_email)) and used_at is null;
  insert into cali_private.workspace_access_codes(user_id,email,code_hash,expires_at)
    values(subject,lower(btrim(p_email)),p_hash,clock_timestamp() + interval '10 minutes') returning id into code_id;
  return jsonb_build_object('status','issued','id',code_id);
end; $$;
create function cali_private.deliver_workspace_code(p_id uuid, p_delivered boolean)
returns void language sql security definer set search_path = '' as $$
  update cali_private.workspace_access_codes set delivery = case when p_delivered then 'delivered' else 'failed' end,
    used_at = case when p_delivered then used_at else clock_timestamp() end
  where id = p_id and delivery = 'pending';
$$;
create function cali_private.consume_workspace_code(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item cali_private.workspace_access_codes; profile_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 29120000));
  select * into item from cali_private.workspace_access_codes where email = lower(btrim(p_email)) and used_at is null order by created_at desc limit 1 for update;
  if item.id is null or item.delivery <> 'delivered' or item.expires_at <= clock_timestamp() or item.attempts >= 5 then return null; end if;
  update cali_private.workspace_access_codes set attempts = attempts + 1 where id = item.id;
  if item.code_hash <> p_hash or not cali_private.eligible_profile(item.user_id) then return null; end if;
  update cali_private.workspace_access_codes set used_at = clock_timestamp() where id = item.id;
  select role into profile_role from cali_workspace.profiles where id = item.user_id;
  return jsonb_build_object('email',item.email,'role',profile_role);
end; $$;
create function cali_workspace.issue_workspace_code(p_email text,p_hash text) returns jsonb language sql security invoker set search_path = '' as $$ select cali_private.issue_workspace_code(p_email,p_hash); $$;
create function cali_workspace.deliver_workspace_code(p_id uuid,p_delivered boolean) returns void language sql security invoker set search_path = '' as $$ select cali_private.deliver_workspace_code(p_id,p_delivered); $$;
create function cali_workspace.consume_workspace_code(p_email text,p_hash text) returns jsonb language sql security invoker set search_path = '' as $$ select cali_private.consume_workspace_code(p_email,p_hash); $$;

revoke all on cali_workspace.legal_versions,cali_workspace.terms_acceptances,cali_private.current_legal_version,cali_private.workspace_access_codes from public,anon,authenticated,service_role;
revoke all on function cali_private.own_profile_is_eligible(),cali_private.eligible_profile(uuid),cali_private.session_is_live(),cali_private.admin_mfa_ready(),cali_private.has_current_terms(),cali_private.get_current_terms(),cali_private.accept_current_terms(text,text),cali_private.workspace_access_state(),cali_private.issue_workspace_code(text,text),cali_private.deliver_workspace_code(uuid,boolean),cali_private.consume_workspace_code(text,text),cali_workspace.get_current_terms(),cali_workspace.accept_current_terms(text,text),cali_workspace.workspace_access_state(),cali_workspace.issue_workspace_code(text,text),cali_workspace.deliver_workspace_code(uuid,boolean),cali_workspace.consume_workspace_code(text,text) from public,anon,authenticated,service_role;
grant usage on schema cali_workspace,cali_private to service_role,anon;
grant select on cali_workspace.terms_acceptances to authenticated;
grant execute on function cali_private.get_current_terms(),cali_workspace.get_current_terms() to anon,authenticated;
grant execute on function cali_private.own_profile_is_eligible(),cali_private.session_is_live(),cali_private.has_current_terms(),cali_private.accept_current_terms(text,text),cali_private.workspace_access_state(),cali_workspace.accept_current_terms(text,text),cali_workspace.workspace_access_state() to authenticated;
grant execute on function cali_private.issue_workspace_code(text,text),cali_private.deliver_workspace_code(uuid,boolean),cali_private.consume_workspace_code(text,text),cali_workspace.issue_workspace_code(text,text),cali_workspace.deliver_workspace_code(uuid,boolean),cali_workspace.consume_workspace_code(text,text) to service_role;

revoke all on function cali_private.prevent_legal_rewrite() from public,anon,authenticated,service_role;

revoke all on function cali_private.set_legal_hash() from public,anon,authenticated,service_role;
