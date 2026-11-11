begin;
set local lock_timeout='5s';

create table if not exists cali_v2_onboarding.pre_registrations (
  company_id uuid primary key references cali_workspace.companies(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  fields jsonb,
  released_at timestamptz,
  released_by uuid,
  release_request uuid,
  release_fingerprint bytea
);
alter table cali_v2_onboarding.pre_registrations enable row level security;
revoke all on cali_v2_onboarding.pre_registrations from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_issue_pre_registration(p_company uuid,p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform cali_session_guard.require_phase4_role(p_company,'admin');
  if p_token is null then raise exception using errcode='22023',message='Link inválido.'; end if;
  insert into cali_v2_onboarding.pre_registrations as previous (company_id,token_hash,expires_at)
  values(p_company,sha256(convert_to(p_token::text,'UTF8')),clock_timestamp()+interval '7 days')
  on conflict(company_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at
  where previous.submitted_at is null;
  if not found then raise exception using errcode='40001',message='O pré-cadastro já foi enviado.'; end if;
end;
$$;

create or replace function cali_workspace.v2_submit_pre_registration(
  p_token uuid,p_name text,p_legal_name text,p_city text,p_state text,p_contact text,p_email text
) returns void language plpgsql security definer set search_path='' as $$
declare
  intake cali_v2_onboarding.pre_registrations;
  details jsonb;
begin
  select * into intake from cali_v2_onboarding.pre_registrations
  where token_hash=sha256(convert_to(p_token::text,'UTF8')) and expires_at>clock_timestamp()
  for update;
  if not found then raise exception using errcode='42501',message='Link indisponível.'; end if;
  if coalesce(length(btrim(p_name)),0) not between 1 and 200
    or coalesce(length(btrim(p_legal_name)),0) not between 1 and 200
    or coalesce(length(btrim(p_city)),0) not between 1 and 200
    or coalesce(upper(btrim(p_state)),'') !~ '^[A-Z]{2}$'
    or coalesce(length(btrim(p_contact)),0) not between 1 and 200
    or coalesce(length(btrim(p_email)),0) not between 3 and 254
    or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then raise exception using errcode='22023',message='Revise os campos obrigatórios.'; end if;
  details:=jsonb_build_object('name',btrim(p_name),'legalName',btrim(p_legal_name),
    'city',btrim(p_city),'state',upper(btrim(p_state)),'contact',btrim(p_contact),'email',lower(btrim(p_email)));
  if intake.fields=details then return; end if;
  if intake.submitted_at is not null then raise exception using errcode='40001',message='O pré-cadastro já foi enviado.'; end if;
  update cali_v2_onboarding.pre_registrations set submitted_at=clock_timestamp(),fields=details
  where company_id=intake.company_id;
end;
$$;

create or replace function cali_workspace.v2_read_pre_registration(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform cali_session_guard.require_phase4_role(p_company,'admin');
  return (select jsonb_build_object('submittedAt',submitted_at,'releasedAt',released_at,'fields',fields)
    from cali_v2_onboarding.pre_registrations where company_id=p_company);
end;
$$;

create or replace function cali_workspace.v2_release_pre_registration(
  p_company uuid,p_request uuid,p_signed boolean,p_invites jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  intake cali_v2_onboarding.pre_registrations;
  invitation record;
  evidence uuid;
  fingerprint bytea;
begin
  if p_request is null or p_signed is not true or jsonb_typeof(p_invites) is distinct from 'array'
    then raise exception using errcode='22023',message='Confirme a assinatura e os acessos.'; end if;
  if jsonb_array_length(p_invites) not between 1 and 4 then
    raise exception using errcode='22023',message='Informe de um a quatro acessos.';
  end if;
  select * into intake from cali_v2_onboarding.pre_registrations where company_id=p_company for update;
  if not found or intake.submitted_at is null then
    raise exception using errcode='55000',message='Aguarde o preenchimento do pré-cadastro.';
  end if;
  fingerprint:=sha256(convert_to(p_invites::text,'UTF8'));
  if intake.release_request=p_request and intake.release_fingerprint=fingerprint and intake.released_by=actor then
    return p_company;
  end if;
  if intake.released_at is not null then raise exception using errcode='40001',message='A ficha já foi liberada.'; end if;
  evidence:=cali_v2_onboarding.require_access_adhesion(p_company);
  if not exists(select 1 from cali_v2_onboarding.adhesion_events e where e.id=evidence
      and e.document_snapshot->>'document_type'='contract') then
    raise exception using errcode='55000',message='Vincule o contrato assinado na comprovação da adesão.';
  end if;
  perform 1 from cali_workspace.companies c where c.id=p_company
    and nullif(btrim(c.service_plan),'') is not null for update;
  if not found then raise exception using errcode='55000',message='Complete o plano contratado.'; end if;
  for invitation in select * from jsonb_to_recordset(p_invites) as row(name text,email text)
  loop
    perform cali_workspace.v2_reserve_pilot_invite(p_company,gen_random_uuid(),invitation.name,invitation.email);
  end loop;
  update cali_workspace.companies set display_name=intake.fields->>'name',
    legal_name=intake.fields->>'legalName',address_city=intake.fields->>'city',address_state=intake.fields->>'state'
    where id=p_company;
  update cali_v2_onboarding.pre_registrations set released_at=clock_timestamp(),released_by=actor,
    release_request=p_request,release_fingerprint=fingerprint where company_id=p_company;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'company_registration_released','company',p_company,
    jsonb_build_object('adhesion',evidence,'accesses',jsonb_array_length(p_invites)));
  return p_company;
end;
$$;

revoke all on function cali_workspace.v2_issue_pre_registration(uuid,uuid),
  cali_workspace.v2_submit_pre_registration(uuid,text,text,text,text,text,text),
  cali_workspace.v2_read_pre_registration(uuid),
  cali_workspace.v2_release_pre_registration(uuid,uuid,boolean,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_issue_pre_registration(uuid,uuid),
  cali_workspace.v2_read_pre_registration(uuid),
  cali_workspace.v2_release_pre_registration(uuid,uuid,boolean,jsonb) to authenticated;
grant execute on function cali_workspace.v2_submit_pre_registration(uuid,text,text,text,text,text,text)
  to anon,authenticated;
notify pgrst,'reload schema';
commit;
