-- NÃO EXECUTADO. Somente cópia isolada autorizada, com candidata previamente aplicada.
-- Testa banco/policies sob claims de teste; não valida JWT, Auth, e-mail ou Edge.
-- As quatro configurações cali.qa.{a,b}_{profile,session} referem-se a fixtures
-- com sessões Auth reais e distintas. Não recebem tokens ou e-mails.
begin;
do $$
begin
  if current_user <> 'postgres'
    or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only' then
    raise exception 'Teste bloqueado: exige cópia isolada autorizada';
  end if;
  if (select count(*) from cali_workspace.profiles p
      join cali_workspace.companies c on c.id=p.company_id
      join auth.sessions s on s.user_id=p.id
      where p.active and p.role::text='client' and c.status::text='active'
      and ((p.id=current_setting('cali.qa.a_profile')::uuid
            and s.id=current_setting('cali.qa.a_session')::uuid and c.notes='CALI_V2_TEST_A_20261101')
        or (p.id=current_setting('cali.qa.b_profile')::uuid
            and s.id=current_setting('cali.qa.b_session')::uuid and c.notes='CALI_V2_TEST_B_20261101'))
      and (s.not_after is null or s.not_after>clock_timestamp())) <> 2
    or current_setting('cali.qa.a_profile')=current_setting('cali.qa.b_profile')
    or current_setting('cali.qa.a_session')=current_setting('cali.qa.b_session') then
    raise exception 'Fixtures/sessões elegíveis não conferem';
  end if;
  perform set_config('cali.qa.missing_session',gen_random_uuid()::text,true);
  if exists (select 1 from auth.sessions where id=current_setting('cali.qa.missing_session')::uuid) then
    raise exception 'ID de teste deve estar ausente no Auth';
  end if;
end $$;
create function pg_temp.check_session_cut(ok boolean,label text)
returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Falhou: %',label; end if; end $$;
create function pg_temp.use_client(actor text)
returns void language plpgsql as $$
declare subject text; session_id text;
begin
  if actor not in ('a','b') then raise exception 'Ator inválido'; end if;
  subject:=current_setting('cali.qa.'||actor||'_profile');
  session_id:=current_setting('cali.qa.'||actor||'_session');
  perform set_config('request.jwt.claim.sub',subject,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',subject,'role','authenticated','session_id',session_id)::text,true);
end $$;
grant execute on function pg_temp.check_session_cut(boolean,text),pg_temp.use_client(text) to authenticated;

set local role authenticated;
select pg_temp.use_client('a');
select pg_temp.check_session_cut(cali_session_guard.session_is_live(),'A ativo');
select pg_temp.check_session_cut((select count(*)=1 from cali_workspace.profiles
  where id=current_setting('cali.qa.a_profile')::uuid),'A próprio perfil');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.profiles
  where id=current_setting('cali.qa.b_profile')::uuid),'A não lê perfil B');
select pg_temp.check_session_cut((select count(*)=1 from cali_workspace.companies),'A só uma empresa');
select pg_temp.use_client('b');
select pg_temp.check_session_cut(cali_session_guard.session_is_live(),'B ativo');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.profiles
  where id=current_setting('cali.qa.a_profile')::uuid),'B não lê perfil A');

-- session_id alheio e ausente não podem se apoiar numa policy permissiva.
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('cali.qa.b_profile'),'role','authenticated',
  'session_id',current_setting('cali.qa.a_session'))::text,true);
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'sessão de outro usuário');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.profiles),'RLS após sessão alheia');
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('cali.qa.b_profile'),'role','authenticated')::text,true);
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'sem session_id');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.companies),'RLS sem sessão');
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('cali.qa.b_profile'),'role','authenticated',
  'session_id',current_setting('cali.qa.missing_session'))::text,true);
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'sessão removida do Auth');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.profiles),'perfil após logout');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.client_invites),'convites após logout');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.terms_acceptances),'aceites após logout');
-- Pré-condição de INSERT evita confundir ausência de grant com o gate de sessão.
select pg_temp.check_session_cut(has_table_privilege('cali_workspace.terms_acceptances','INSERT'),'grant de aceite');
do $$ begin
  begin
    insert into cali_workspace.terms_acceptances(user_id,version)
      values (current_setting('cali.qa.b_profile')::uuid,'QA-'||gen_random_uuid()::text);
    raise exception 'Falhou: sessão removida gravou aceite';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Cada cenário usa savepoint; cortes técnicos não são apagados em operação real.
savepoint profile_cycle;
update cali_workspace.profiles set active=false where id=current_setting('cali.qa.a_profile')::uuid;
set local role authenticated;
select pg_temp.use_client('a');
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'A inativo');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.companies),'A inativo sem empresa');
select pg_temp.use_client('b');
select pg_temp.check_session_cut(cali_session_guard.session_is_live(),'B preservado');
reset role;
update cali_workspace.profiles set active=true where id=current_setting('cali.qa.a_profile')::uuid;
set local role authenticated;
select pg_temp.use_client('a');
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'reativação não ressuscita A');
select pg_temp.check_session_cut((select count(*)=0 from cali_workspace.profiles),'perfil negado após reativação');
reset role;
rollback to savepoint profile_cycle;

savepoint company_cycle;
-- Pausa preserva a sessão; bloqueio/reativação não recuperam credencial anterior.
update cali_workspace.companies set status='paused'
where id=(select company_id from cali_workspace.profiles where id=current_setting('cali.qa.a_profile')::uuid);
set local role authenticated;
select pg_temp.use_client('a');
select pg_temp.check_session_cut(cali_session_guard.session_is_live(),'pausa mantém consulta');
reset role;
update cali_workspace.companies set status='blocked'
where id=(select company_id from cali_workspace.profiles where id=current_setting('cali.qa.a_profile')::uuid);
set local role authenticated;
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'empresa bloqueada');
select pg_temp.use_client('b');
select pg_temp.check_session_cut(cali_session_guard.session_is_live(),'empresa B preservada');
reset role;
update cali_workspace.companies set status='active'
where id=(select company_id from cali_workspace.profiles where id=current_setting('cali.qa.a_profile')::uuid);
update cali_workspace.profiles set active=true where id=current_setting('cali.qa.a_profile')::uuid;
set local role authenticated;
select pg_temp.use_client('a');
select pg_temp.check_session_cut(not cali_session_guard.session_is_live(),'retomada não ressuscita A');
reset role;
rollback to savepoint company_cycle;
rollback;
