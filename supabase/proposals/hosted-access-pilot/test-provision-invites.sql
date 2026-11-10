\set cali_skip_pilot_pause 1
\ir test.sql
\unset cali_skip_pilot_pause
\ir individual-invites.sql
alter table auth.users add column raw_app_meta_data jsonb default '{}';
\ir provision-invites.sql

do $$
declare
  company constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  auth_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  reservation uuid;
  collision uuid;
  result jsonb;
begin
  insert into cali_session_guard.pilot_invite_recipients(email,company_id)
    values ('new@example.test',company), ('collision@example.test',company), ('extra@example.test',company);
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  set local role authenticated;
  reservation := cali_workspace.v2_reserve_pilot_invite(company,request_id,'Novo Cliente','new@example.test');
  if cali_workspace.v2_reserve_pilot_invite(company,request_id,'Novo Cliente','NEW@example.test') <> reservation then
    raise exception 'Repetição ocupou outra vaga';
  end if;
  begin
    perform cali_workspace.v2_reserve_pilot_invite(company,gen_random_uuid(),'Fora','other@example.test');
    raise exception 'Destinatário não aprovado foi reservado';
  exception when insufficient_privilege then null;
  end;
  collision := cali_workspace.v2_reserve_pilot_invite(company,gen_random_uuid(),'Colisão','collision@example.test');
  if jsonb_array_length(cali_workspace.v2_list_pending_pilot_invites(company)) <> 2 then
    raise exception 'Reservas não aparecem na ficha';
  end if;
  reset role;

  if exists (select 1 from cali_workspace.client_invites where id=reservation) then
    raise exception 'Reserva ficou disponível no fluxo legado';
  end if;
  if has_function_privilege('authenticated','cali_workspace.v2_prepare_pilot_invite_login(text)','execute') then
    raise exception 'Preparação disponível fora do papel de serviço';
  end if;
  set local role service_role;
  result := cali_workspace.v2_prepare_pilot_invite_login('new@example.test');
  if result is distinct from jsonb_build_object('status','create','inviteId',reservation) then
    raise exception 'Preparação não vinculou a conta ao convite certo';
  end if;
  reset role;
  insert into auth.users (id,email,raw_app_meta_data) values
    (auth_id,'new@example.test',jsonb_build_object('cali_v2_invite',reservation)),
    (gen_random_uuid(),'collision@example.test','{}');
  set local role service_role;
  if cali_workspace.v2_prepare_pilot_invite_login('collision@example.test')->>'status' <> 'unavailable'
    or cali_workspace.v2_prepare_pilot_invite_login('new@example.test')->>'status' <> 'ready'
    or cali_workspace.v2_prepare_pilot_invite_login('new@example.test')->>'status' <> 'ready'
    or cali_workspace.v2_prepare_pilot_invite_login('b@example.test')->>'status' <> 'ready' then
    raise exception 'Preparação não preservou colisão, repetição ou Cliente existente';
  end if;
  reset role;
  if not exists (select 1 from cali_session_guard.pilot_accounts where invite_id=reservation and profile_id=auth_id)
    or not cali_session_guard.profile_login_eligible(auth_id) then
    raise exception 'Conta nova não recebeu vínculo elegível';
  end if;
  set local role authenticated;
  perform cali_workspace.v2_reserve_pilot_invite(company,gen_random_uuid(),'Quarta vaga','extra@example.test');
  begin
    insert into cali_workspace.client_invites(company_id,email,full_name) values(company,'fifth@example.test','Quinta vaga');
    raise exception 'Escritor legado ultrapassou quatro vagas';
  exception when check_violation then null;
  end;
  perform cali_workspace.v2_cancel_pilot_invite(company,collision);
  if jsonb_array_length(cali_workspace.v2_list_pending_pilot_invites(company)) <> 1 then
    raise exception 'Cancelamento não liberou a reserva';
  end if;
  insert into cali_workspace.client_invites(company_id,email,full_name)
    values(company,'released@example.test','Vaga liberada');
end;
$$;
