-- Fase 5. Aplicar depois de phase-4/staff-pilot-admission.sql, no CALI MAPA.
-- As identidades reservadas ficam fora do perfil e do vínculo Partner legado.
create table cali_session_guard.phase5_partner_terms (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  content_hash text not null,
  accepted_at timestamptz not null default clock_timestamp(),
  primary key(user_id,version,content_hash)
);
alter table cali_session_guard.phase5_partner_terms enable row level security;
revoke all on cali_session_guard.phase5_partner_terms from public,anon,authenticated,service_role;

create function cali_session_guard.phase5_partner_invite()
returns cali_session_guard.phase4_staff_invites
language sql stable set search_path='' as $$
  select i from cali_session_guard.phase4_staff_invites i
  join cali_workspace.companies c on c.id=i.company_id and c.status::text in ('active','paused')
  where i.target_user_id=auth.uid() and i.revoked_at is null
    and (i.accepted_at is not null or i.expires_at>statement_timestamp())
    and cali_session_guard.phase4_staff_live_session(i.target_user_id)
    and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,i.target_user_id)
$$;

create function cali_session_guard.phase5_partner_mfa()
returns boolean language sql stable set search_path='' as $$
  select coalesce(auth.jwt()->>'aal'='aal2',false) and exists (
    select 1 from auth.mfa_factors f where f.user_id=auth.uid()
      and f.factor_type='totp' and f.status='verified'
  )
$$;

create function cali_workspace.v2_read_partner_pilot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  terms record;
begin
  if invite.id is null then return jsonb_build_object('status','blocked'); end if;
  if not cali_session_guard.phase5_partner_mfa() then return jsonb_build_object('status','mfa_required'); end if;
  if invite.accepted_at is null then return jsonb_build_object('status','invite_required'); end if;
  select p.version,p.content_hash into terms from cali_v2_terms.publications p where p.is_current;
  if not found then return jsonb_build_object('status','terms_unavailable'); end if;
  if not exists(select 1 from cali_session_guard.phase5_partner_terms t
    where t.user_id=invite.target_user_id and t.version=terms.version and t.content_hash=terms.content_hash) then
    return jsonb_build_object('status','terms_required','version',terms.version,'contentHash',terms.content_hash);
  end if;
  return (
    select jsonb_build_object('status','ready','actor',invite.target_user_id,'company',c.id,'companyName',c.display_name,
      'modules',to_jsonb(array(select module from unnest(m.modules) module where module in ('projects','records','hours'))))
    from cali_workspace.companies c cross join cali_workspace.staff_members m
    where c.id=invite.company_id and m.id=invite.member_id
  );
end;
$$;

-- Para o piloto V2, o aceite só entra pela porta com MFA.
revoke execute on function cali_workspace.v2_accept_pilot_staff_invite(uuid) from authenticated;
create function cali_workspace.v2_accept_partner_pilot_invite()
returns uuid language plpgsql security definer set search_path='' as $$
declare
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
begin
  if invite.id is null or not cali_session_guard.phase5_partner_mfa() then
    raise exception using errcode='42501',message='Convite indisponível.';
  end if;
  return cali_workspace.v2_accept_pilot_staff_invite(invite.id);
end;
$$;

create function cali_workspace.v2_accept_partner_pilot_terms(p_version text,p_content_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
begin
  if invite.accepted_at is null or not cali_session_guard.phase5_partner_mfa() then
    raise exception using errcode='42501',message='Acesso indisponível.';
  end if;
  perform 1 from cali_v2_terms.publications p where p.is_current
    and p.version=p_version and p.content_hash=p_content_hash for share;
  if not found then raise exception using errcode='22023',message='Confira a versão vigente dos termos.'; end if;
  insert into cali_session_guard.phase5_partner_terms(user_id,version,content_hash)
    values(invite.target_user_id,p_version,p_content_hash) on conflict do nothing;
end;
$$;

create function cali_workspace.v2_list_partner_pilot_items(p_company uuid,p_module text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
begin
  if access->>'status' is distinct from 'ready'
    or access->>'company' is distinct from p_company::text
    or p_module is null or not coalesce((access->'modules') ? p_module,false) then
    raise exception using errcode='42501',message='Módulo indisponível.';
  end if;
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select p.id,p.name as title,p.protocol,p.planning_status::text as status,p.roadmap_end_date as day,null::integer as minutes
      from cali_workspace.projects p
      join cali_session_guard.phase4_project_qa q on q.company_id=p.company_id and q.project_id=p.id
      where p_module='projects' and p.company_id=p_company
      union all
      select r.id,r.title,r.protocol,r.workflow_status::text,(r.occurred_at at time zone 'America/Sao_Paulo')::date,null::integer
      from cali_workspace.account_records r
      join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
      where p_module='records' and r.company_id=p_company and r.visibility='client'
      union all
      select h.id,h.description,null::text,null::text,h.work_date,h.minutes
      from cali_workspace.hour_entries h
      where p_module='hours' and h.company_id=p_company and h.created_by=auth.uid()
    ), page as (
      select * from matched order by day desc nulls last,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),'rows',
      coalesce((select jsonb_agg(to_jsonb(page) order by day desc nulls last,id) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_session_guard.phase5_partner_invite(),cali_session_guard.phase5_partner_mfa(),
  cali_workspace.v2_read_partner_pilot(),cali_workspace.v2_accept_partner_pilot_invite(),
  cali_workspace.v2_accept_partner_pilot_terms(text,text),cali_workspace.v2_list_partner_pilot_items(uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_partner_pilot(),cali_workspace.v2_accept_partner_pilot_invite(),
  cali_workspace.v2_accept_partner_pilot_terms(text,text),cali_workspace.v2_list_partner_pilot_items(uuid,text,integer)
  to authenticated;
