-- Rodar em transação revertida com as candidatas e as duas empresas sintéticas do CALI MAPA.
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  actor uuid:=gen_random_uuid();
  member uuid:=gen_random_uuid();
  session_id uuid:=gen_random_uuid();
  invite uuid:=gen_random_uuid();
  address text:='cali-qa-staff-'||member::text||'@example.invalid';
  revision timestamptz:=statement_timestamp();
  claims jsonb:=jsonb_build_object('sub',actor,'role','authenticated','session_id',session_id,'aal','aal1');
  terms record;
  project_id uuid;
  record_fixture uuid;
  detail jsonb;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['projects','records'],true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  assert not has_function_privilege('anon','cali_workspace.v2_read_partner_pilot()','execute');
  assert not has_function_privilege('authenticated','cali_workspace.v2_accept_pilot_staff_invite(uuid)','execute');
  assert not has_table_privilege('authenticated','cali_session_guard.phase5_partner_terms','select');
  perform set_config('request.jwt.claims',claims::text,true);
  set local role authenticated;
  assert cali_workspace.v2_read_partner_pilot()->>'status'='mfa_required';
  begin
    perform cali_workspace.v2_accept_partner_pilot_invite();
    raise exception 'Convite aceito em AAL1';
  exception when insufficient_privilege then null; end;
  reset role;
  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);

  set local role authenticated;
  assert cali_workspace.v2_read_partner_pilot()->>'status'='invite_required';
  assert cali_workspace.v2_accept_partner_pilot_invite()=member;
  assert cali_workspace.v2_read_partner_pilot()->>'status'='terms_required';
  begin
    perform cali_workspace.v2_list_partner_pilot_items(a,'projects',1);
    raise exception 'Listagem sem aceite vigente';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,repeat('0',64));
    raise exception 'Aceite de hash divergente';
  exception when invalid_parameter_value then null; end;
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  assert cali_workspace.v2_read_partner_pilot()->>'status'='ready';
  assert cali_workspace.v2_read_partner_pilot()->'modules'='["projects","records"]'::jsonb;
  assert jsonb_array_length(cali_workspace.v2_list_partner_pilot_items(a,'projects',1)->'rows')>0;
  project_id:=(cali_workspace.v2_list_partner_pilot_items(a,'projects',1)#>>'{rows,0,id}')::uuid;
  record_fixture:=(cali_workspace.v2_list_partner_pilot_items(a,'records',1)#>>'{rows,0,id}')::uuid;
  detail:=cali_workspace.v2_read_partner_pilot_detail(a,'projects',project_id,1);
  assert detail->>'title' is not null;
  detail:=cali_workspace.v2_read_partner_pilot_detail(a,'records',record_fixture,1);
  assert detail->>'title' is not null;
  reset role;
  assert (detail->>'total')::integer=(select count(*) from cali_workspace.account_record_messages m
    where m.record_id=record_fixture and m.company_id=a and m.visibility='client' and m.deleted_at is null);
  set local role authenticated;
  assert cali_workspace.v2_read_partner_pilot_detail(a,'projects',gen_random_uuid(),1) is null;
  begin
    perform cali_workspace.v2_read_partner_pilot_detail(b,'projects',project_id,1);
    raise exception 'Detalhe de outra empresa vazou';
  exception when insufficient_privilege then null; end;
  assert not cali_workspace.is_partner();
  begin
    perform cali_workspace.v2_list_partner_pilot_items(b,'projects',1);
    raise exception 'Empresa B vazou';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_list_partner_pilot_items(a,'hours',1);
    raise exception 'Módulo sem atribuição vazou';
  exception when insufficient_privilege then null; end;
  reset role;
  update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=actor where id=invite;
  set local role authenticated;
  assert cali_workspace.v2_read_partner_pilot()->>'status'='blocked';
  begin
    perform cali_workspace.v2_list_partner_pilot_items(a,'projects',1);
    raise exception 'Sessão revogada leu projetos';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
