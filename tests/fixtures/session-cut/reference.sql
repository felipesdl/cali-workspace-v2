-- Projeção de teste da referência f3d3f14, não dump do catálogo ativo.
-- Somente banco separado; não executar na baseline ou no hospedado.
do $$ begin
  if current_database() !~ '^cali_session_cut_20261101_[0-9a-f]{8}$' or to_regnamespace('cali_workspace') is not null then
    raise exception 'Alvo de fixture inválido/não vazio';
  end if;
end $$;
create schema cali_workspace;
create schema cali_qa;
create table cali_qa.identity(singleton boolean primary key check(singleton),marker text not null);
insert into cali_qa.identity values(true,'CALI_SESSION_CUT_REFERENCE_ONLY_20261101');
revoke all on schema cali_qa from public,anon,authenticated,service_role;
create table cali_workspace.companies(
 id uuid primary key default gen_random_uuid(), display_name text not null, legal_name text not null,
 status text not null default 'active' check(status in ('active','paused','blocked','closed','archived')),
 notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table cali_workspace.client_invites(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references cali_workspace.companies(id),
 email text not null,full_name text not null,is_primary boolean not null default false,
 active boolean not null default true,platform_access boolean not null default true,
 job_title text,phone text,whatsapp text,birthday date,
 invited_at timestamptz,accepted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,email)
);
create table cali_workspace.profiles(
 id uuid primary key references auth.users(id) on delete cascade,company_id uuid references cali_workspace.companies(id),
 email text not null,full_name text not null,role text not null check(role in ('admin','client','partner')),
 active boolean not null default true,is_primary boolean not null default false,job_title text,phone text,
 whatsapp text,avatar_url text,linkedin_url text,instagram_url text,avatar_position_x numeric default 50,
 avatar_position_y numeric default 50,avatar_zoom numeric default 1,signature_mode text default 'generated',
 signature_url text,signature_style text default 'executive',updated_at timestamptz not null default now()
);
create table cali_workspace.terms_acceptances(
 user_id uuid not null references auth.users(id),version text not null check(length(version) between 1 and 40),
 accepted_at timestamptz not null default now(),user_agent text,primary key(user_id,version)
);
-- Única adaptação do predicado Admin nesta fixture: identidade sintética por perfil,
-- sem e-mails reais. Não certifica o MFA/helper do catálogo hospedado.
create function cali_workspace.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cali_workspace.profiles where id=auth.uid() and role='admin' and active);
$$;
create function cali_workspace.current_company_id() returns uuid language sql stable security definer set search_path='' as $$
 select company_id from cali_workspace.profiles where id=auth.uid() and active limit 1;
$$;
grant usage on schema cali_workspace to authenticated,service_role;
grant select,insert,update,delete on all tables in schema cali_workspace to authenticated,service_role;
alter table cali_workspace.profiles enable row level security;
alter table cali_workspace.companies enable row level security;
alter table cali_workspace.client_invites enable row level security;
alter table cali_workspace.terms_acceptances enable row level security;
create policy profiles_self_select on cali_workspace.profiles for select to authenticated using(id=auth.uid());
create policy profiles_admin_all on cali_workspace.profiles for all to authenticated using(cali_workspace.is_admin()) with check(cali_workspace.is_admin());
create policy companies_client_select on cali_workspace.companies for select to authenticated using(id=cali_workspace.current_company_id());
create policy companies_admin_all on cali_workspace.companies for all to authenticated using(cali_workspace.is_admin()) with check(cali_workspace.is_admin());
create policy invites_admin_all on cali_workspace.client_invites for all to authenticated using(cali_workspace.is_admin()) with check(cali_workspace.is_admin());
create policy terms_acceptances_own_select on cali_workspace.terms_acceptances for select to authenticated using(user_id=auth.uid() or cali_workspace.is_admin());
create policy terms_acceptances_own_insert on cali_workspace.terms_acceptances for insert to authenticated with check(user_id=auth.uid());
-- Interação do trigger de fim de contrato com os novos cortes.
create function cali_workspace.companies_cut_client_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('closed','blocked','archived') and old.status is distinct from new.status then
  update cali_workspace.profiles set active=false where company_id=new.id and role='client' and active;
 end if; return new;
end; $$;
create trigger companies_cut_client_access after update of status on cali_workspace.companies
for each row execute function cali_workspace.companies_cut_client_access();
