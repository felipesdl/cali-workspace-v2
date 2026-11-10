-- Contato administrativo separado do login. Logo usa a convenção privada da carteira.
begin;
set local lock_timeout = '5s';

create table cali_v2_onboarding.pilot_company_contacts (
  company_id uuid primary key references cali_session_guard.pilot_companies(company_id),
  full_name text,
  job_title text,
  email text,
  phone text,
  whatsapp text,
  birthday date
);
alter table cali_v2_onboarding.pilot_company_contacts enable row level security;
revoke all on cali_v2_onboarding.pilot_company_contacts from public, anon, authenticated, service_role;

create function cali_workspace.v2_read_pilot_company_brand(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform cali_session_guard.require_pilot_admin_session();
  return (
    select jsonb_build_object('companyId', c.id, 'updatedAt', c.updated_at, 'service', c.service_type,
      'plan', c.service_plan, 'hasLogo', nullif(c.logo_url, '') is not null,
      'contact', jsonb_build_object('name', coalesce(x.full_name,''), 'title', coalesce(x.job_title,''),
        'email', coalesce(x.email,''), 'phone', coalesce(x.phone,''), 'whatsapp', coalesce(x.whatsapp,''),
        'birthday', x.birthday))
    from cali_session_guard.pilot_companies p join cali_workspace.companies c on c.id=p.company_id
    left join cali_v2_onboarding.pilot_company_contacts x on x.company_id=c.id
    where p.company_id=p_company_id
  );
end;
$$;

create function cali_workspace.v2_update_pilot_company_brand(
  p_company_id uuid, p_expected_at timestamptz, p_service text, p_contact jsonb,
  p_logo_action text, p_logo_path text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  original cali_workspace.companies;
  contact cali_v2_onboarding.pilot_company_contacts;
  next_plan text;
  meeting_plan text;
  next_logo text;
begin
  if not exists(select 1 from cali_session_guard.pilot_companies where company_id=p_company_id) then
    raise exception using errcode='22023', message='Empresa fora da homologação.';
  end if;
  if p_logo_action is null or p_logo_action not in ('keep','replace','remove')
    or (p_logo_action='replace') is distinct from (p_logo_path is not null)
    or p_service not in ('CALI Partner','CALI Full','CALI Build Essencial','CALI Build Completo',
      'Assessoria Estratégica Mensal','Mentoria para RH','Treinamento','Projeto de Estruturação','Solução personalizada')
    or p_contact is null or jsonb_typeof(p_contact)<>'object'
    or not (p_contact ?& array['name','title','email','phone','whatsapp','birthday'])
    or (p_contact - array['name','title','email','phone','whatsapp','birthday'])<>'{}'::jsonb then
    raise exception using errcode='22023', message='Dados comerciais inválidos.';
  end if;
  select p_company_id, nullif(btrim(p_contact->>'name'),''), nullif(btrim(p_contact->>'title'),''),
    nullif(lower(btrim(p_contact->>'email')),''), nullif(btrim(p_contact->>'phone'),''),
    nullif(btrim(p_contact->>'whatsapp'),''), nullif(p_contact->>'birthday','')::date into contact;
  if greatest(length(contact.full_name),length(contact.job_title),length(contact.email))>254
    or greatest(length(contact.phone),length(contact.whatsapp))>50
    or contact.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or contact.birthday>current_date then
    raise exception using errcode='22023', message='Confira os dados do contato.';
  end if;
  select * into strict original from cali_workspace.companies where id=p_company_id for update;
  if p_expected_at is distinct from original.updated_at then
    raise exception using errcode='40001', message='Cadastro alterado. Recarregue antes de salvar.';
  end if;
  if p_logo_action='replace' then
    if p_logo_path !~ ('^'||p_company_id::text||'/brand/logo-[0-9a-f-]{36}[.](png|jpg|webp|avif)$')
      or not exists (select 1 from storage.objects where bucket_id='cali-workspace-private' and name=p_logo_path) then
      raise exception using errcode='22023', message='Logo fora do armazenamento da empresa.';
    end if;
    next_logo := 'private:'||p_logo_path;
  elsif p_logo_action='keep' then
    next_logo := original.logo_url;
  end if;

  next_plan := case p_service
    when 'CALI Partner' then 'partner'
    when 'CALI Full' then 'full'
    when 'CALI Build Essencial' then 'build_essential'
    when 'CALI Build Completo' then 'build_complete'
    when 'Assessoria Estratégica Mensal' then original.service_plan
    else null end;

  if p_service is not null and p_service is distinct from original.service_type then
    -- A referência só redefine as regras de reunião ao trocar para Partner ou Full.
    meeting_plan := case when p_service in ('CALI Partner','CALI Full') then next_plan end;
    update cali_workspace.companies set service_type=p_service, service_plan=next_plan,
      meeting_sessions_included_per_month=case meeting_plan when 'partner' then 1 when 'full' then 2 else original.meeting_sessions_included_per_month end,
      meeting_cadence_days=case meeting_plan when 'partner' then 30 when 'full' then 14 else original.meeting_cadence_days end,
      onsite_visits_included_per_month=case meeting_plan when 'partner' then 0 when 'full' then 1 else original.onsite_visits_included_per_month end,
      fixed_meeting_required=case when meeting_plan is not null then true else original.fixed_meeting_required end,
      meeting_mode_policy=case meeting_plan when 'partner' then 'online_only' when 'full' then 'mixed_one_onsite' else original.meeting_mode_policy end
    where id=p_company_id;
  end if;
  -- Toca a versão da empresa mesmo quando apenas o contato muda.
  if next_logo is distinct from original.logo_url then
    update cali_workspace.companies set logo_url=next_logo where id=p_company_id;
  else
    update cali_workspace.companies set updated_at=clock_timestamp() where id=p_company_id;
  end if;
  insert into cali_v2_onboarding.pilot_company_contacts values (contact.*)
  on conflict (company_id) do update set full_name=excluded.full_name, job_title=excluded.job_title,
    email=excluded.email, phone=excluded.phone, whatsapp=excluded.whatsapp, birthday=excluded.birthday;
  insert into cali_workspace.activity_log (company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values (p_company_id,actor,'v2_company_brand_updated','company',p_company_id,
    jsonb_build_object('service_changed',p_service is not null and p_service is distinct from original.service_type,
      'logo_action',p_logo_action));
  return p_company_id;
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_company_brand(uuid),
  cali_workspace.v2_update_pilot_company_brand(uuid,timestamptz,text,jsonb,text,text)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_read_pilot_company_brand(uuid),
  cali_workspace.v2_update_pilot_company_brand(uuid,timestamptz,text,jsonb,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
