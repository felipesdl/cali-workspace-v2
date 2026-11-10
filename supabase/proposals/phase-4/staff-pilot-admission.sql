-- FLOW-15. Candidata de ensaio; executar somente dentro de transação com rollback.
-- Não vincula staff_members.user_id, não cria perfil e não envia comunicação.
create table cali_session_guard.phase4_staff_invites (
  id uuid primary key,
  company_id uuid not null,
  member_id uuid not null,
  member_revision timestamptz not null,
  target_user_id uuid not null,
  issued_by uuid not null,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  check (expires_at > issued_at),
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index phase4_staff_one_open_invite on cali_session_guard.phase4_staff_invites(member_id)
  where revoked_at is null;
revoke all on cali_session_guard.phase4_staff_invites from public,anon,authenticated,service_role;

-- Revalidar vínculo e revisão em toda operação. Ativar de novo exige novo convite.
create function cali_session_guard.phase4_staff_binding(
  p_company uuid,p_member uuid,p_revision timestamptz,p_target uuid
)
returns boolean language sql stable set search_path=''
as $$
  select exists(
    select 1 from cali_workspace.staff_members m
    join cali_workspace.staff_company_assignments a on a.staff_id=m.id and a.company_id=p_company
    join auth.users u on u.id=p_target and u.email=m.email and u.email_confirmed_at is not null
      and not u.is_anonymous
    where m.id=p_member and m.updated_at=p_revision and m.active
      and exists(select 1 from cali_session_guard.pilot_companies c where c.company_id=p_company)
      and cardinality(m.modules)>0
      and m.email='cali-qa-staff-'||m.id::text||'@example.invalid'
      and m.user_id is null and m.accepted_at is null and m.invited_by is null
      and not exists(select 1 from cali_workspace.profiles p where p.id=u.id)
      and not exists(select 1 from cali_workspace.staff_company_assignments other
        where other.staff_id=m.id and other.company_id<>p_company)
  );
$$;

create function cali_session_guard.phase4_staff_live_session(p_target uuid)
returns boolean language sql stable set search_path=''
as $$
  select exists(
    select 1 from auth.sessions s
    where s.user_id=p_target and s.user_id=auth.uid()
      and s.id::text=auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after>statement_timestamp())
  );
$$;

create function cali_workspace.v2_issue_pilot_staff_invite(
  p_company uuid,p_invite uuid,p_member uuid,p_revision timestamptz,p_target uuid,p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company,'admin');
  existing cali_session_guard.phase4_staff_invites;
begin
  if p_invite is null or p_expires_at is null then
    raise exception using errcode='22023',message='Confira os dados do convite.';
  end if;
  -- Serializa emissão e mudança de estado do membro.
  perform 1 from cali_workspace.staff_members m where m.id=p_member for update;
  if not cali_session_guard.phase4_staff_binding(p_company,p_member,p_revision,p_target) then
    raise exception using errcode='42501',message='Vínculo indisponível.';
  end if;
  select * into existing from cali_session_guard.phase4_staff_invites where id=p_invite;
  if found then
    if row(existing.company_id,existing.member_id,existing.member_revision,existing.target_user_id,
      existing.issued_by,existing.expires_at) is distinct from
      row(p_company,p_member,p_revision,p_target,actor,p_expires_at) then
      raise exception using errcode='40001',message='A solicitação já foi usada.';
    end if;
    return existing.id;
  end if;
  if p_expires_at<=clock_timestamp() then
    raise exception using errcode='22023',message='Prazo do convite inválido.';
  end if;
  insert into cali_session_guard.phase4_staff_invites
    (id,company_id,member_id,member_revision,target_user_id,issued_by,expires_at)
  values(p_invite,p_company,p_member,p_revision,p_target,actor,p_expires_at);
  return p_invite;
end;
$$;

create function cali_workspace.v2_accept_pilot_staff_invite(p_invite uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  invite cali_session_guard.phase4_staff_invites;
begin
  select * into invite from cali_session_guard.phase4_staff_invites
    where id=p_invite and target_user_id=auth.uid() for update;
  if not found or invite.revoked_at is not null
    or not cali_session_guard.phase4_staff_live_session(invite.target_user_id)
    or not cali_session_guard.phase4_staff_binding(invite.company_id,invite.member_id,invite.member_revision,invite.target_user_id)
    or (invite.accepted_at is null and invite.expires_at<=clock_timestamp()) then
    raise exception using errcode='42501',message='Convite indisponível.';
  end if;
  if invite.accepted_at is null then
    update cali_session_guard.phase4_staff_invites set accepted_at=clock_timestamp() where id=invite.id;
  end if;
  return invite.member_id;
end;
$$;

create function cali_workspace.v2_revoke_pilot_staff_invite(p_company uuid,p_invite uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company,'admin');
  invite cali_session_guard.phase4_staff_invites;
begin
  select * into invite from cali_session_guard.phase4_staff_invites
    where id=p_invite and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Convite indisponível.'; end if;
  if invite.revoked_at is null then
    update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=actor where id=invite.id;
  end if;
  return invite.member_id;
end;
$$;

-- Predicado privado; não está ligado a nenhuma rota, policy ou módulo operacional.
create function cali_session_guard.phase4_staff_can_access(p_company uuid,p_module text)
returns boolean language sql stable set search_path=''
as $$
  select exists(
    select 1 from cali_session_guard.phase4_staff_invites i
    join cali_workspace.staff_members m on m.id=i.member_id
    where i.company_id=p_company and i.target_user_id=auth.uid()
      and i.accepted_at is not null and i.revoked_at is null and p_module=any(m.modules)
      and cali_session_guard.phase4_staff_live_session(i.target_user_id)
      and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,i.target_user_id)
  );
$$;

revoke all on function cali_session_guard.phase4_staff_binding(uuid,uuid,timestamptz,uuid),
  cali_session_guard.phase4_staff_live_session(uuid),cali_session_guard.phase4_staff_can_access(uuid,text),
  cali_workspace.v2_issue_pilot_staff_invite(uuid,uuid,uuid,timestamptz,uuid,timestamptz),
  cali_workspace.v2_accept_pilot_staff_invite(uuid),cali_workspace.v2_revoke_pilot_staff_invite(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_issue_pilot_staff_invite(uuid,uuid,uuid,timestamptz,uuid,timestamptz),
  cali_workspace.v2_accept_pilot_staff_invite(uuid),cali_workspace.v2_revoke_pilot_staff_invite(uuid,uuid) to authenticated;
