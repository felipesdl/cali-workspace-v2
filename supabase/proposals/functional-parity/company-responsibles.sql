-- DEC-29. Designações por conta. Somente empresas sintéticas do piloto.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.company_responsibles (
  company_id uuid primary key references cali_workspace.companies(id) on delete cascade,
  cali_admin_id uuid not null references cali_workspace.profiles(id),
  partner_staff_id uuid references cali_workspace.staff_members(id),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null
);
alter table cali_session_guard.company_responsibles enable row level security;
revoke all on cali_session_guard.company_responsibles from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_read_company_responsibles(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); actor_role text; result jsonb;
begin
  if p_company not in ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid) then
    raise exception using errcode='42501',message='Designações indisponíveis.';
  end if;
  select role::text into actor_role from cali_workspace.profiles where id=actor and active;
  if actor_role='admin' then perform cali_session_guard.require_phase4_role(p_company,'admin');
  elsif actor_role='client' then perform cali_session_guard.require_phase4_role(p_company,'client');
  else raise exception using errcode='42501',message='Designações indisponíveis.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('role',role,'name',name,'title',title) order by ordinal),'[]'::jsonb)
  into result from (
    select 1 ordinal,'cali'::text role,nullif(btrim(p.full_name),'') name,
      coalesce(nullif(btrim(p.job_title),''),'CALI') title
    from cali_session_guard.company_responsibles r
    join cali_workspace.profiles p on p.id=r.cali_admin_id and p.active and p.role::text='admin'
    where r.company_id=p_company
    union all
    select 2,'partner',nullif(btrim(s.full_name),''),'Parceiro de apoio'
    from cali_session_guard.company_responsibles r
    join cali_workspace.staff_members s on s.id=r.partner_staff_id and s.active and s.role='partner'
    join cali_workspace.staff_company_assignments a on a.staff_id=s.id and a.company_id=r.company_id
    where r.company_id=p_company and r.partner_staff_id is not null
  ) assigned;
  return jsonb_build_object('companyId',p_company,'responsibles',result);
end;
$$;

create or replace function cali_workspace.v2_read_company_responsible_options(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  if p_company not in ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid) then
    raise exception using errcode='42501',message='Designações indisponíveis.';
  end if;
  return (
    select jsonb_build_object('companyId',p_company,
      'updatedAt',(select r.updated_at from cali_session_guard.company_responsibles r where r.company_id=p_company),
      'caliAdminId',(select r.cali_admin_id from cali_session_guard.company_responsibles r where r.company_id=p_company),
      'partnerStaffId',(select r.partner_staff_id from cali_session_guard.company_responsibles r where r.company_id=p_company),
      'admins',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id)
        from cali_workspace.profiles p where p.active and p.role::text='admin'
          and nullif(btrim(p.full_name),'') is not null),'[]'::jsonb),
      'partners',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name) order by s.full_name,s.id)
        from cali_workspace.staff_members s join cali_workspace.staff_company_assignments a
          on a.staff_id=s.id and a.company_id=p_company
        where s.active and s.role='partner' and s.full_name is not null and coalesce(cardinality(s.modules),0)>0),'[]'::jsonb))
  );
end;
$$;

create or replace function cali_workspace.v2_save_company_responsibles(
  p_company uuid,p_expected timestamptz,p_admin uuid,p_partner uuid
) returns timestamptz language plpgsql security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin'); saved timestamptz;
begin
  if p_company not in ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid)
    or p_admin is null then raise exception using errcode='22023',message='Confira as designações.'; end if;
  if not exists(select 1 from cali_workspace.profiles where id=p_admin and active and role::text='admin') then
    raise exception using errcode='22023',message='Selecione uma pessoa Admin ativa.';
  end if;
  if p_partner is not null and not exists(select 1 from cali_workspace.staff_members s
    join cali_workspace.staff_company_assignments a on a.staff_id=s.id and a.company_id=p_company
    where s.id=p_partner and s.active and s.role='partner' and coalesce(cardinality(s.modules),0)>0) then
    raise exception using errcode='22023',message='Selecione uma pessoa ativa já designada à empresa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('company-responsibles:'||p_company::text,0));
  if p_expected is null then
    insert into cali_session_guard.company_responsibles(company_id,cali_admin_id,partner_staff_id,updated_by)
      values(p_company,p_admin,p_partner,actor) on conflict(company_id) do nothing returning updated_at into saved;
    if saved is null then raise exception using errcode='40001',message='As designações mudaram. Atualize a ficha.'; end if;
  else
    update cali_session_guard.company_responsibles set cali_admin_id=p_admin,partner_staff_id=p_partner,
      updated_at=clock_timestamp(),updated_by=actor
    where company_id=p_company and updated_at=p_expected returning updated_at into saved;
    if saved is null then raise exception using errcode='40001',message='As designações mudaram. Atualize a ficha.'; end if;
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'company_responsibles_updated','company',p_company,
    jsonb_build_object('caliAdminId',p_admin,'partnerAssigned',p_partner is not null));
  return saved;
end;
$$;

revoke all on function cali_workspace.v2_read_company_responsibles(uuid),
  cali_workspace.v2_read_company_responsible_options(uuid),
  cali_workspace.v2_save_company_responsibles(uuid,timestamptz,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_company_responsibles(uuid) to authenticated;
grant execute on function cali_workspace.v2_read_company_responsible_options(uuid),
  cali_workspace.v2_save_company_responsibles(uuid,timestamptz,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
