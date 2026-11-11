-- Candidata restrita ao projeto isolado de homologação; não aplicar no CALI MAPA.
-- Requer preview-access.sql, staff-pilot-admission.sql e o catálogo da admissão V2.
begin;
set local lock_timeout='5s';

do $$ begin
  if to_regclass('cali_session_guard.preview_partner_recipients') is null
    or to_regclass('cali_session_guard.phase4_staff_invites') is null
    or to_regprocedure('cali_session_guard.phase4_staff_binding(uuid,uuid,timestamp with time zone,uuid)') is null
    or to_regprocedure('cali_session_guard.profile_login_eligible(uuid)') is null
    or to_regprocedure('cali_session_guard.authorize_code(uuid,timestamp with time zone)') is null
    or to_regprocedure('cali_workspace.admit_workspace_session_v2(uuid,uuid)') is null then
    raise exception 'Preview Partner exige os contratos V2 e a allowlist privada.';
  end if;
end $$;

-- Mantém a elegibilidade Client da base hosted-access-pilot; acrescenta Admin ativo
-- e Partner sintético somente quando Auth, invite, associação e allowlist concordam.
-- authorize_code/admit_workspace_session_v2 continuam aplicando seus cortes de sessão.
create or replace function cali_session_guard.profile_login_eligible(subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from cali_session_guard.pilot_accounts a
    join cali_workspace.profiles p on p.id=a.profile_id and p.company_id=a.company_id
    join cali_workspace.companies c on c.id=a.company_id
    join cali_workspace.client_invites i on i.id=a.invite_id and i.company_id=a.company_id
    join auth.users u on u.id=a.profile_id
    where a.profile_id=subject and a.revoked_at is null and p.active and p.role::text='client'
      and c.status::text in ('active','paused') and i.active and i.platform_access
      and lower(btrim(i.email))=a.recipient_email
      and lower(btrim(p.email))=a.recipient_email
      and lower(btrim(u.email))=a.recipient_email
  ) or exists (
    select 1 from cali_workspace.profiles p
    join auth.users u on u.id=p.id
    where p.id=subject and p.active and p.role::text='admin'
      and u.email_confirmed_at is not null and lower(btrim(u.email))=lower(btrim(p.email))
  ) or exists (
    select 1 from auth.users u
    join cali_session_guard.preview_partner_recipients r on r.user_id=u.id
      and lower(btrim(r.recipient_email))=lower(btrim(u.email))
    join cali_session_guard.phase4_staff_invites i on i.id=r.invite_id
      and i.target_user_id=u.id and i.revoked_at is null
      and (i.accepted_at is not null or i.expires_at>statement_timestamp())
    where u.id=subject and u.email_confirmed_at is not null
      and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,u.id)
  );
$$;

revoke all on function cali_session_guard.profile_login_eligible(uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_session_guard.profile_login_eligible(uuid) to service_role;
notify pgrst,'reload schema';
commit;
