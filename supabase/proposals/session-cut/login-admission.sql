-- Complemento da candidata. NÃO APLICADO; fora de migrations/runners.
-- Exige candidate.sql e reconciliation.sql revisados no destino autorizado.
-- O adapter de códigos deve criar a autorização na mesma transação do consumo,
-- usando user_id/created_at do registro privado, nunca campos do navegador.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_user <> 'postgres'
     or to_regprocedure('cali_session_guard.profile_login_eligible(uuid)') is null then
    raise exception 'Revisão/candidata reconciliada ausente';
  end if;
end $$;

create table cali_session_guard.login_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_created_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '1 minute',
  session_id uuid unique references auth.sessions(id) on delete cascade
);
create index login_authorizations_user on cali_session_guard.login_authorizations(user_id);
alter table cali_session_guard.login_authorizations enable row level security;
revoke all on cali_session_guard.login_authorizations from public,anon,authenticated,service_role;

create function cali_session_guard.authorize_code(subject uuid,code_created_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare authorization uuid;
begin
  if code_created_at is null or code_created_at > clock_timestamp()
     or code_created_at <= clock_timestamp() - interval '10 minutes'
     or not cali_session_guard.profile_login_eligible(subject)
     or exists(select 1 from cali_session_guard.profile_cutoffs r
       where r.user_id=subject and r.revoked_before>=code_created_at) then
    return null;
  end if;
  insert into cali_session_guard.login_authorizations(user_id,code_created_at)
    values(subject,code_created_at) returning id into authorization;
  return authorization;
end; $$;

create function cali_workspace.admit_workspace_session_v2(p_authorization_id uuid,p_session_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare proof cali_session_guard.login_authorizations;
begin
  select * into proof from cali_session_guard.login_authorizations
    where id=p_authorization_id for update;
  if proof.id is null or proof.session_id is not null or proof.expires_at<=clock_timestamp()
     or not cali_session_guard.profile_login_eligible(proof.user_id)
     or exists(select 1 from cali_session_guard.profile_cutoffs r
       where r.user_id=proof.user_id and r.revoked_before>=proof.code_created_at)
     or not exists(select 1 from auth.sessions s where s.id=p_session_id
       and s.user_id=proof.user_id and s.created_at>=proof.created_at
       and (s.not_after is null or s.not_after>statement_timestamp())) then
    return false;
  end if;
  update cali_session_guard.login_authorizations set session_id=p_session_id where id=proof.id;
  return true;
end; $$;

create or replace function cali_session_guard.session_is_live()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.sessions s
    left join cali_session_guard.profile_cutoffs r on r.user_id=s.user_id
    where s.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after>statement_timestamp())
      and cali_session_guard.profile_login_eligible(s.user_id)
      and (r.revoked_before is null or (s.created_at>r.revoked_before and exists(
        select 1 from cali_session_guard.login_authorizations a
        where a.session_id=s.id and a.user_id=s.user_id and a.code_created_at>r.revoked_before))));
$$;
revoke all on function cali_session_guard.authorize_code(uuid,timestamptz),
  cali_workspace.admit_workspace_session_v2(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.admit_workspace_session_v2(uuid,uuid) to service_role;
commit;
