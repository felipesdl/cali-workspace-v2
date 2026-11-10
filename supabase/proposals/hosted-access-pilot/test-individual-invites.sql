\set cali_skip_pilot_pause 1
\ir test.sql
\unset cali_skip_pilot_pause

-- Reutiliza a fixture SQL com admissão ativa, sem iniciar Auth nem enviar códigos.
\ir individual-invites.sql

do $$
declare
  ca constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  cb constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  other_a constant uuid := '00000000-0000-4000-8000-000000000018';
  ia uuid;
  ib uuid;
  ia2 uuid;
  cut_a timestamptz;
  revoked_a timestamptz;
  second_session uuid := gen_random_uuid();
  proof uuid;
begin
  select invite_id, revoked_at into strict ia, revoked_a from cali_session_guard.pilot_accounts where company_id = ca;
  select invite_id into strict ib from cali_session_guard.pilot_accounts where company_id = cb;
  if not exists (select 1 from cali_session_guard.pilot_reauthorizations where invite_id = ia)
    or (select count(*) from cali_session_guard.login_authorizations) <> 3
    or not exists (select 1 from cali_session_guard.pilot_accounts where invite_id = ia and revoked_at is not null)
    or has_function_privilege('authenticated', 'cali_workspace.v2_revoke_pilot_access(uuid)', 'execute') then
    raise exception 'Migração perdeu histórico, corte ou manteve comando ambíguo';
  end if;
  select revoked_before into strict cut_a from cali_session_guard.profile_cutoffs
    where user_id = '00000000-0000-4000-8000-000000000011';
  insert into auth.users values (other_a,'a-second@example.test');
  insert into cali_workspace.profiles (id,company_id,email,full_name,role)
    values (other_a,ca,'a-second@example.test','Segundo vínculo A','client');
  insert into cali_workspace.client_invites (company_id,email,full_name)
    values (ca,'a-second@example.test','Segundo vínculo A') returning id into ia2;
  insert into cali_session_guard.pilot_accounts (company_id,profile_id,invite_id,recipient_email)
    values (ca,other_a,ia2,'a-second@example.test');
  proof := cali_session_guard.authorize_code(other_a, clock_timestamp());
  insert into auth.sessions values (second_session, other_a, clock_timestamp(), null);
  if proof is null or not cali_workspace.admit_workspace_session_v2(proof, second_session) then
    raise exception 'Segundo vínculo da empresa não admitido';
  end if;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000011","session_id":"00000000-0000-4000-8000-000000000021"}',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_list_pilot_invite_states(ca);
    raise exception 'Cliente conseguiu consultar a gestão';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  if jsonb_array_length(cali_workspace.v2_list_pilot_invite_states(ca)) <> 2 then
    raise exception 'Consulta não separa os dois convites da mesma empresa';
  end if;
  begin
    perform cali_workspace.v2_revoke_pilot_invite(ca, ib);
    raise exception 'Comando aceitou convite de outra empresa';
  exception when invalid_parameter_value then null;
  end;
  begin
    update cali_workspace.client_invites set active = true, platform_access = true where id = ia;
    raise exception 'Escritor legado reativou o vínculo revogado';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform cali_workspace.v2_reauthorize_pilot_invite(ca, ia, revoked_a, gen_random_uuid());
  perform set_config('test.jwt', jsonb_build_object('sub', other_a, 'session_id', second_session)::text,true);
  if not exists (select 1 from cali_workspace.companies where id = ca) then
    raise exception 'Segundo vínculo perdeu leitura após reautorizar o primeiro';
  end if;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  perform cali_workspace.v2_revoke_pilot_invite(ca, ia2);
  reset role;
  if not exists (select 1 from cali_session_guard.pilot_accounts
      where invite_id = ia2 and revoked_at is not null)
    or exists (select 1 from cali_session_guard.pilot_accounts
      where invite_id = ib and revoked_at is not null)
    or not exists (select 1 from cali_session_guard.profile_cutoffs where user_id = other_a)
    or not exists (select 1 from cali_session_guard.profile_cutoffs
      where user_id = '00000000-0000-4000-8000-000000000011' and revoked_before >= cut_a)
    or exists (select 1 from cali_workspace.profiles where id = other_a and active) then
    raise exception 'Corte individual perdeu o vínculo ou atingiu outro Cliente';
  end if;
  if not cali_session_guard.profile_login_eligible('00000000-0000-4000-8000-000000000011') then
    raise exception 'Revogar o segundo vínculo atingiu o primeiro';
  end if;
  -- Três convites ativos, inclusive um administrativo sem acesso à plataforma:
  -- o teto mantém a semântica do gatilho legado.
  insert into cali_workspace.client_invites (company_id,email,full_name,platform_access)
    select ca, 'seed-'||i||'@example.test', 'Ocupação '||i, i <> 1 from generate_series(1,2) i;
end;
$$;
