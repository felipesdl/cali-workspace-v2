-- Assinaturas e corpos reconciliados com a leitura do catálogo de 04/11.
-- Candidata exclusiva para homologação descartável.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only'
     or current_user <> 'postgres'
     or current_database() !~ '^cali_session_cut_20261101_[0-9a-f]{8}$' then
    raise exception 'Ensaio de RPCs restrito à cópia isolada';
  end if;
end $$;

create or replace function cali_workspace.create_client_account(
  p_company text, p_contact text, p_email text,
  p_hours numeric default null, p_service_type text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  company_id uuid;
  reference_month date := date_trunc('month', current_date)::date;
begin
  perform cali_v2_onboarding.require_live_legacy_admin();
  if nullif(trim(p_company), '') is null or nullif(trim(p_contact), '') is null
    or nullif(trim(p_email), '') is null then
    raise exception using errcode = '22023', message = 'Empresa, contato e e-mail são obrigatórios';
  end if;
  insert into cali_workspace.companies (
    legal_name, display_name, service_type, monthly_hours_contracted, show_hours_to_client
  ) values (
    trim(p_company), trim(p_company), nullif(trim(coalesce(p_service_type, '')), ''),
    case when p_hours >= 0 then p_hours end, true
  ) returning id into company_id;
  insert into cali_workspace.client_invites (company_id, email, full_name, is_primary, active, invited_at)
  values (company_id, lower(trim(p_email)), trim(p_contact), true, true, now());
  if p_hours > 0 then
    insert into cali_workspace.service_cycles (company_id, reference_month, contracted_hours, status)
    values (company_id, reference_month, p_hours, 'open');
  end if;
  insert into cali_workspace.activity_log (
    company_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    company_id, auth.uid(), 'client_account_created', 'company', company_id,
    jsonb_build_object('email', lower(trim(p_email)), 'contact', trim(p_contact))
  );
  return company_id;
end;
$$;

create or replace function cali_workspace.profile_renew_invite(p_invite uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  previous cali_workspace.profile_invites;
  new_id uuid;
begin
  perform cali_v2_onboarding.require_live_legacy_admin();
  select * into previous from cali_workspace.profile_invites where id = p_invite;
  if not found then raise exception 'Convite não encontrado.'; end if;
  insert into cali_workspace.profile_invites (
    link_id, person_name, email, team_member_id, cycle, previous_invite_id
  ) values (
    previous.link_id, previous.person_name, previous.email, previous.team_member_id,
    (select coalesce(max(cycle), 0) + 1 from cali_workspace.profile_invites
      where link_id = previous.link_id and lower(email) = lower(previous.email)),
    previous.id
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function cali_workspace.profile_send_invites(p_link uuid, p_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  link cali_workspace.profile_links;
  sent_count integer := 0;
  deadline timestamptz;
  invitation record;
begin
  perform cali_v2_onboarding.require_live_legacy_admin();
  select * into link from cali_workspace.profile_links where id = p_link;
  if not found then raise exception 'Link não encontrado.'; end if;
  if link.status <> 'open' then
    raise exception 'Este link está bloqueado. Desbloqueie para enviar convites.';
  end if;
  deadline := cali_workspace.profile_deadline_from_now(link.deadline_days);
  for invitation in update cali_workspace.profile_invites set sent_at = now(), deadline_at = deadline
    where link_id = p_link and sent_at is null and declined_at is null and (p_ids is null or id = any(p_ids))
    returning id
  loop
    sent_count := sent_count + 1;
    perform cali_workspace.profile_post_invite_email(jsonb_build_object('kind', 'invite', 'invite_id', invitation.id));
  end loop;
  return jsonb_build_object('sent', sent_count, 'deadline_at', deadline);
end;
$$;

revoke all on function cali_workspace.create_client_account(text,text,text,numeric,text),
  cali_workspace.profile_renew_invite(uuid), cali_workspace.profile_send_invites(uuid,uuid[])
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.create_client_account(text,text,text,numeric,text),
  cali_workspace.profile_renew_invite(uuid), cali_workspace.profile_send_invites(uuid,uuid[])
  to authenticated;

commit;
