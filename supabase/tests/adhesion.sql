-- Teste de autorização/constraints real no Postgres, com claims sintéticos.
-- Não comprova emissão/validação de JWT pelo Auth. Tudo é revertido.
begin;
create function pg_temp.assert_true(value boolean, label text)
returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Falhou: %', label; end if;
end;
$$;
create function pg_temp.expect_denied(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'SQLSTATE esperado %, recebido %', expected_state, sqlstate;
  end;
  raise exception 'Operação indevidamente aceita: %', statement;
end;
$$;

insert into cali_workspace.companies(id, display_name, legal_name) values
  ('10000000-0000-4000-8000-000000000001', 'Empresa A teste', 'Empresa A teste'),
  ('10000000-0000-4000-8000-000000000002', 'Empresa B teste', 'Empresa B teste');
insert into auth.users(id, email) values
  ('20000000-0000-4000-8000-000000000001', 'admin-sql@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'cliente-a-sql@example.test'),
  ('20000000-0000-4000-8000-000000000003', 'cliente-b-sql@example.test'),
  ('20000000-0000-4000-8000-000000000004', 'inativo-sql@example.test'),
  ('20000000-0000-4000-8000-000000000005', 'partner-sql@example.test'),
  ('20000000-0000-4000-8000-000000000006', 'sem-perfil-sql@example.test');
insert into cali_workspace.profiles(id, company_id, role, active) values
  ('20000000-0000-4000-8000-000000000001', null, 'admin', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'client', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'client', true),
  ('20000000-0000-4000-8000-000000000004', null, 'admin', false),
  ('20000000-0000-4000-8000-000000000005', null, 'partner', true);

insert into auth.sessions(id,user_id) select ('30000000-0000-4000-8000-' || right(id::text,12))::uuid,id from auth.users where email like '%-sql@example.test';
insert into cali_workspace.legal_versions(version,title,content) values ('local-adhesion-sql','Teste sintético','Termos sintéticos exclusivos do laboratório.');
insert into cali_private.current_legal_version(singleton,version) values (true,'local-adhesion-sql') on conflict(singleton) do update set version=excluded.version;

set local role anon;
select pg_temp.expect_denied('select * from cali_workspace.workspace_adhesions', '42501');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', 'ref')$q$, '42501');
reset role;
set local role service_role;
select pg_temp.expect_denied('select * from cali_workspace.workspace_adhesions', '42501');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', 'ref')$q$, '42501');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000001","session_id":"30000000-0000-4000-8000-000000000001","aal":"aal1"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Admin AAL1 negado');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', 'ref')$q$, '42501');
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000001","session_id":"30000000-0000-4000-8000-000000000001","aal":"aal2"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'AAL2 sem fator verificado negado');
reset role;
insert into auth.mfa_factors(id, user_id, factor_type, status, secret, created_at, updated_at)
  select gen_random_uuid(), id, 'totp', 'verified', 'synthetic-sql-only', now(), now()
  from auth.users where email like '%-sql@example.test';

set local role authenticated;
select cali_workspace.accept_current_terms('local-adhesion-sql',(cali_workspace.get_current_terms()->>'contentHash'));
select pg_temp.assert_true(cali_private.is_admin(), 'Admin ativo com AAL2/fator/termos permitido');
select pg_temp.assert_true(
  (cali_workspace.register_workspace_adhesion('10000000-0000-4000-8000-000000000001', '  CALI-TESTE-01  ')
    ->>'recordedBy') = '20000000-0000-4000-8000-000000000001', 'Autoria vem da sessão');
select pg_temp.assert_true(
  (select evidence_reference = 'CALI-TESTE-01' and recorded_at between transaction_timestamp() and clock_timestamp()
    from cali_workspace.workspace_adhesions where company_id = '10000000-0000-4000-8000-000000000001'),
  'Referência normalizada e instante do servidor');
select cali_workspace.register_workspace_adhesion('10000000-0000-4000-8000-000000000001', 'CALI-TESTE-02');
select pg_temp.assert_true((select count(*) = 2 from cali_workspace.workspace_adhesions where company_id = '10000000-0000-4000-8000-000000000001'), 'Histórico preservado');
select pg_temp.expect_denied($q$insert into cali_workspace.workspace_adhesions(company_id,evidence_reference,recorded_by)
  values ('10000000-0000-4000-8000-000000000001','forjado','20000000-0000-4000-8000-000000000002')$q$, '42501');
select pg_temp.expect_denied('update cali_workspace.workspace_adhesions set evidence_reference = ''alterado''', '42501');
select pg_temp.expect_denied('delete from cali_workspace.workspace_adhesions', '42501');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000099', 'ref')$q$, '23503');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  null, 'ref')$q$, '22023');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', E' \n\t ')$q$, '22023');

set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000002","session_id":"30000000-0000-4000-8000-000000000002","aal":"aal2","role":"admin","user_metadata":{"role":"admin"}}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Cliente não vira Admin por claims');
select pg_temp.assert_true((select count(*) = 0 from cali_workspace.workspace_adhesions), 'Cliente A não lê evidências');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', 'ref')$q$, '42501');
select pg_temp.expect_denied('update cali_workspace.profiles set role = ''admin''', '42501');
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000003","session_id":"30000000-0000-4000-8000-000000000003","aal":"aal2"}';
select pg_temp.assert_true((select count(*) = 0 from cali_workspace.workspace_adhesions), 'Cliente B não lê evidências');
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000004","session_id":"30000000-0000-4000-8000-000000000004","aal":"aal2"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Admin inativo negado');
select pg_temp.expect_denied($q$select cali_workspace.register_workspace_adhesion(
  '10000000-0000-4000-8000-000000000001', 'ref')$q$, '42501');
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000005","session_id":"30000000-0000-4000-8000-000000000005","aal":"aal2"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Partner negado');
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000006","session_id":"30000000-0000-4000-8000-000000000006","aal":"aal2"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Perfil ausente negado');
set local request.jwt.claims = '{}';
select pg_temp.assert_true(not cali_private.is_admin(), 'Identidade/aal ausentes negados');
reset role;

select pg_temp.expect_denied('update cali_workspace.workspace_adhesions set evidence_reference = ''alterado''', '55000');
select pg_temp.expect_denied('delete from cali_workspace.workspace_adhesions', '55000');
delete from auth.mfa_factors where user_id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000001","session_id":"30000000-0000-4000-8000-000000000001","aal":"aal2"}';
select pg_temp.assert_true(not cali_private.is_admin(), 'JWT AAL2 com fator removido negado');
reset role;
rollback;
select 'Adesão: cenários SQL permitidos/negados passaram; fixtures revertidas.' as result;
