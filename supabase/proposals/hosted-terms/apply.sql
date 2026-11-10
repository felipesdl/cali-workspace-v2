-- CALI MAPA. Contrato hospedado de recibos da V1 e publicação de 2026-10-15.
begin;
set local lock_timeout = '5s';

create schema cali_v2_terms;
revoke all on schema cali_v2_terms from public, anon, authenticated, service_role;

create table cali_v2_terms.publications (
  version text primary key check (char_length(version) between 1 and 40),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default false,
  unique (version, content_hash)
);
create unique index only_one_current on cali_v2_terms.publications (is_current) where is_current;

create table cali_v2_terms.confirmations (
  user_id uuid not null,
  version text not null,
  content_hash text not null,
  confirmed_at timestamptz not null default clock_timestamp(),
  primary key (user_id, version),
  foreign key (user_id, version) references cali_workspace.terms_acceptances (user_id, version) on delete cascade,
  foreign key (version, content_hash) references cali_v2_terms.publications (version, content_hash)
);
alter table cali_v2_terms.publications enable row level security;
alter table cali_v2_terms.confirmations enable row level security;
revoke all on all tables in schema cali_v2_terms from public, anon, authenticated, service_role;

insert into cali_v2_terms.publications values
  ('2026-10-15', '3f19575d148c0e3f7720c6fba088752d2c4c737a937973a52e07988d078924cb', true);

-- Compatibilidade temporária com Auth legado. Se o corte V2 estiver instalado,
-- a autorização de aceite também passa pela sua guarda.
create function cali_v2_terms.actor_can_confirm()
returns boolean language plpgsql stable set search_path = '' as $$
declare
  allowed boolean;
begin
  if not exists (
    select 1 from auth.sessions s
    join cali_workspace.profiles p on p.id = s.user_id and p.active
    left join cali_workspace.companies c on c.id = p.company_id
    where s.user_id = auth.uid() and s.id::text = (auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > statement_timestamp())
      and (
        (p.role::text = 'client' and c.status::text in ('active', 'paused'))
        or (p.role::text = 'admin' and (auth.jwt()->>'aal') = 'aal2' and cali_workspace.is_admin()
          and exists (select 1 from auth.mfa_factors f where f.user_id = p.id
            and f.factor_type = 'totp' and f.status = 'verified'))
      )
  ) then
    return false;
  end if;
  if to_regprocedure('cali_session_guard.session_is_live()') is not null then
    execute 'select cali_session_guard.session_is_live()' into allowed;
    return allowed is true;
  end if;
  return true;
end;
$$;
revoke all on function cali_v2_terms.actor_can_confirm() from public, anon, authenticated, service_role;

create function cali_workspace.v2_read_terms_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', p.version, 'contentHash', p.content_hash,
    'accepted', cali_v2_terms.actor_can_confirm() and exists (
      select 1 from cali_v2_terms.confirmations c
      where c.user_id = auth.uid() and c.version = p.version and c.content_hash = p.content_hash
    ))
  from cali_v2_terms.publications p where p.is_current;
$$;

create function cali_workspace.v2_accept_terms(p_version text, p_content_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if not cali_v2_terms.actor_can_confirm() then
    raise exception using errcode = '42501', message = 'Acesso indisponível.';
  end if;

  perform 1 from cali_v2_terms.publications
    where is_current and version = p_version and content_hash = p_content_hash for share;
  if not found then
    raise exception using errcode = '22023', message = 'Versão apresentada não é a versão corrente.';
  end if;

  insert into cali_workspace.terms_acceptances (user_id, version)
    values (actor, p_version) on conflict (user_id, version) do nothing;
  insert into cali_v2_terms.confirmations (user_id, version, content_hash)
    values (actor, p_version, p_content_hash) on conflict (user_id, version) do nothing;
end;
$$;

revoke all on function cali_workspace.v2_read_terms_state(), cali_workspace.v2_accept_terms(text,text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_read_terms_state(), cali_workspace.v2_accept_terms(text,text)
  to authenticated;
notify pgrst, 'reload schema';
commit;
