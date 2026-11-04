-- Executar depois da fixture e do teste concorrente de cinco convites.
set cali.session_cut_review = 'reviewed-v1';
\ir ../session-cut/rpc-guard.sql

-- Política de leitura Cliente observada no CALI MAPA, sobre metadados sintéticos.
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
create policy fixture_client_documents on storage.objects
for select to authenticated using (
  bucket_id = 'cali-workspace-private'
  and (
    (split_part(name, '/', 1) = 'documents'
      and split_part(name, '/', 2) = cali_workspace.current_company_id()::text)
    or (split_part(name, '/', 1) = cali_workspace.current_company_id()::text
      and split_part(name, '/', 2) = 'deliverables')
  )
);

do $$
declare
  company uuid;
  other_company uuid := gen_random_uuid();
  revoked_invite cali_workspace.client_invites;
  other_invite cali_workspace.client_invites;
  client_a uuid := '00000000-0000-4000-8000-000000000061';
  client_b uuid := '00000000-0000-4000-8000-000000000062';
  session_a uuid := '00000000-0000-4000-8000-000000000071';
  session_b uuid := '00000000-0000-4000-8000-000000000072';
  new_session uuid := '00000000-0000-4000-8000-000000000073';
  revoke_request uuid := gen_random_uuid();
  initial_proof_a uuid;
  initial_proof_b uuid;
  old_proof uuid;
  fresh_proof uuid;
  previous_code timestamptz := clock_timestamp() - interval '1 minute';
begin
  select d.company_id into company from cali_v2_onboarding.company_drafts d where d.access_management_enabled;
  insert into storage.objects(id, bucket_id, name)
  values
    (gen_random_uuid(), 'cali-workspace-private', 'documents/' || company || '/own.txt'),
    (gen_random_uuid(), 'cali-workspace-private', company || '/deliverables/own.txt'),
    (gen_random_uuid(), 'cali-workspace-private', 'documents/' || other_company || '/foreign.txt'),
    (gen_random_uuid(), 'cali-workspace-private', other_company || '/deliverables/foreign.txt');
  select * into strict revoked_invite from cali_workspace.client_invites where company_id = company and v2_access_slot = 1;
  select * into strict other_invite from cali_workspace.client_invites where company_id = company and v2_access_slot = 2;
  if (select count(*) from cali_workspace.client_invites where company_id = company and v2_access_slot is not null) <> 4 then
    raise exception 'Quatro vagas não confirmadas.';
  end if;
  set local role service_role;
  update cali_workspace.client_invites set accepted_at = clock_timestamp() where id = other_invite.id;
  if not found then raise exception 'Aceite da Edge não preservado.'; end if;
  begin
    update cali_workspace.client_invites set active = false, platform_access = false, v2_access_slot = null
    where id = other_invite.id;
    raise exception 'Escrita direta da Edge alterou a vaga.';
  exception when insufficient_privilege then null;
  end;
  reset role;

  insert into auth.users values (client_a), (client_b);
  insert into cali_workspace.profiles (id, role, active, email, company_id)
  values (client_a, 'client', true, revoked_invite.email, company),
         (client_b, 'client', true, other_invite.email, company);
  insert into auth.sessions values
    (session_a, client_a, previous_code, null), (session_b, client_b, previous_code, null);

  perform set_config('test.actor', client_a::text, true);
  perform set_config('test.session', session_a::text, true);
  set local role authenticated;
  if exists (select 1 from cali_workspace.profiles where id = client_a) then
    raise exception 'Primeira sessão sem admissão leu dados.';
  end if;
  if exists (select 1 from storage.objects) then
    raise exception 'Primeira sessão sem admissão leu objetos.';
  end if;
  reset role;

  initial_proof_a := cali_session_guard.authorize_code(client_a, previous_code);
  initial_proof_b := cali_session_guard.authorize_code(client_b, previous_code);
  update auth.sessions set created_at = clock_timestamp() where id in (session_a, session_b);
  if cali_workspace.admit_workspace_session_v2(initial_proof_a, session_a) is not true
    or cali_workspace.admit_workspace_session_v2(initial_proof_b, session_b) is not true then
    raise exception 'Admissão inicial recusada.';
  end if;
  old_proof := cali_session_guard.authorize_code(client_a, previous_code);
  if old_proof is null then raise exception 'Prova pré-corte indisponível.'; end if;

  set local role authenticated;
  if not exists (select 1 from cali_workspace.profiles where id = client_a) then
    raise exception 'Cliente não tinha acesso antes do corte.';
  end if;
  if (select count(*) from storage.objects where name like '%/own.txt') <> 2
    or exists (select 1 from storage.objects where name like '%/foreign.txt') then
    raise exception 'A leitura inicial de objetos não ficou restrita à empresa.';
  end if;
  reset role;

  perform set_config('test.actor', '00000000-0000-4000-8000-000000000001', true);
  perform set_config('test.session', '00000000-0000-4000-8000-000000000051', true);
  perform set_config('test.aal', 'aal2', true);
  set local role authenticated;
  perform cali_workspace.v2_manage_company_access(company, revoke_request, 'revoke', revoked_invite.id, null, null);
  reset role;
  if exists (select 1 from cali_workspace.profiles where id = client_a and active)
    or exists (select 1 from cali_workspace.client_invites where id = revoked_invite.id and v2_access_slot is not null)
    or not exists (select 1 from cali_session_guard.profile_cutoffs where user_id = client_a) then
    raise exception 'Revogação parcial.';
  end if;

  perform set_config('test.actor', client_a::text, true);
  perform set_config('test.session', session_a::text, true);
  set local role authenticated;
  if exists (select 1 from cali_workspace.profiles where id = client_a) then
    raise exception 'Sessão anterior ainda lê dados.';
  end if;
  if exists (select 1 from storage.objects) then
    raise exception 'Sessão revogada ainda lê objetos.';
  end if;
  reset role;

  perform set_config('test.actor', '00000000-0000-4000-8000-000000000001', true);
  perform set_config('test.session', '00000000-0000-4000-8000-000000000051', true);
  set local role authenticated;
  perform cali_workspace.v2_manage_company_access(company, gen_random_uuid(), 'reactivate', revoked_invite.id, null, null);
  if cali_workspace.v2_manage_company_access(company, revoke_request, 'revoke', revoked_invite.id, null, null)
    is distinct from revoked_invite.id then
    raise exception 'Replay de revogação divergente.';
  end if;
  reset role;
  if not exists (select 1 from cali_workspace.client_invites where id = revoked_invite.id and v2_access_slot = 1) then
    raise exception 'Replay de revogação desfez a reativação.';
  end if;

  insert into auth.sessions values (new_session, client_a, clock_timestamp(), null);
  if cali_workspace.admit_workspace_session_v2(old_proof, new_session) then
    raise exception 'Prova anterior ao corte voltou a admitir sessão.';
  end if;
  if cali_session_guard.authorize_code(client_a, previous_code) is not null then
    raise exception 'Código anterior ao corte voltou a autorizar.';
  end if;
  fresh_proof := cali_session_guard.authorize_code(client_a, clock_timestamp());
  if fresh_proof is null then raise exception 'Código novo recusado.'; end if;
  update auth.sessions set created_at = clock_timestamp() where id = new_session;
  if not cali_workspace.admit_workspace_session_v2(fresh_proof, new_session) then
    raise exception 'Sessão nova recusada.';
  end if;

  set local role authenticated;
  perform set_config('test.actor', client_a::text, true);
  perform set_config('test.session', session_a::text, true);
  if exists (select 1 from cali_workspace.profiles where id = client_a) then
    raise exception 'Sessão antiga voltou após reativação.';
  end if;
  if exists (select 1 from storage.objects) then
    raise exception 'Sessão antiga voltou a ler objetos após reativação.';
  end if;
  perform set_config('test.session', new_session::text, true);
  if not exists (select 1 from cali_workspace.profiles where id = client_a) then
    raise exception 'Sessão nova não lê dados.';
  end if;
  if (select count(*) from storage.objects where name like '%/own.txt') <> 2
    or exists (select 1 from storage.objects where name like '%/foreign.txt') then
    raise exception 'A leitura de objetos na sessão nova não ficou restrita à empresa.';
  end if;
  perform set_config('test.actor', client_b::text, true);
  perform set_config('test.session', session_b::text, true);
  if not exists (select 1 from cali_workspace.profiles where id = client_b) then
    raise exception 'Revogação atingiu outro cliente.';
  end if;
  if (select count(*) from storage.objects where name like '%/own.txt') <> 2 then
    raise exception 'Revogação atingiu a leitura de objetos do outro cliente.';
  end if;
end;
$$;
