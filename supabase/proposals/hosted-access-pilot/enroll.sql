-- Aplicar somente após revisão de adesão, escritores, Storage e transporte.
-- A associação aprovada vem do convite ativo já vinculado à conta de teste.
begin;
set local lock_timeout = '5s';

do $$
declare
  fixture record;
  account record;
  match_count integer;
begin
  if current_setting('cali.access_pilot.enroll', true) is distinct from 'reviewed'
    or to_regprocedure('cali_workspace.v2_consume_pilot_code(text,text)') is null
    or to_regprocedure('cali_v2_onboarding.require_access_adhesion(uuid)') is null
    or not exists (
      select 1 from pg_policy where polrelid = 'storage.objects'::regclass
        and polname = 'v2_hosted_current_terms_for_files' and not polpermissive
    ) then
    raise exception 'Cadastro do piloto exige revisão, adesão, transporte e guarda de arquivos.';
  end if;
  if exists (select 1 from cali_session_guard.pilot_accounts) then
    raise exception 'Piloto já registrado. Não sobrescrever escopo nem revogação.';
  end if;

  for fixture in
    select * from (values
      ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid, 'CALI_V2_TEST_A_20261101'),
      ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid, 'CALI_V2_TEST_B_20261101')
    ) as fixtures(company_id, marker)
  loop
    perform cali_v2_onboarding.require_access_adhesion(fixture.company_id);
    perform 1 from cali_workspace.companies c
      where c.id = fixture.company_id and c.notes = fixture.marker and c.status::text = 'active'
      for update;
    if not found then raise exception 'Empresa de teste divergiu do catálogo.'; end if;

    select count(*) into match_count from cali_workspace.client_invites i
      where i.company_id = fixture.company_id and i.active and i.platform_access;
    if match_count <> 1 then raise exception 'Convites ativos do piloto divergiram.'; end if;

    select p.id as profile_id, i.id as invite_id, lower(btrim(i.email)) as recipient_email
    into strict account
    from cali_workspace.profiles p
    join auth.users u on u.id = p.id and lower(btrim(u.email)) = lower(btrim(p.email))
    join cali_workspace.client_invites i on i.company_id = p.company_id
      and lower(btrim(i.email)) = lower(btrim(p.email))
    where p.company_id = fixture.company_id and p.active and p.role::text = 'client'
      and i.active and i.platform_access
    for update of p, i;

    insert into cali_session_guard.pilot_accounts (company_id, profile_id, invite_id, recipient_email)
    values (fixture.company_id, account.profile_id, account.invite_id, account.recipient_email);
  end loop;
end;
$$;
commit;
