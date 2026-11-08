-- Usar após staff-pilot-admission.sql, na mesma transação a reverter.
-- cali.test_admin_claims é definido pelo executor; não é exportado do banco.
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member uuid:=gen_random_uuid();
  target uuid:=gen_random_uuid();
  session_id uuid:=gen_random_uuid();
  expired_invite uuid:=gen_random_uuid();
  invite_id uuid:=gen_random_uuid();
  later_invite uuid:=gen_random_uuid();
  revision timestamptz;
  accepted timestamptz;
  revoked timestamptz;
  deadline timestamptz:=clock_timestamp()+interval '5 minutes';
  admin_claims jsonb:=current_setting('cali.test_admin_claims')::jsonb;
  admin_aal1 jsonb:=admin_claims||'{"aal":"aal1"}'::jsonb;
  target_claims jsonb:=jsonb_build_object('sub',target,'role','authenticated','session_id',session_id,'aal','aal1');
  claims_name text:=current_setting('cali.test_claims_name');
begin
  perform set_config(claims_name,admin_claims::text,true);
  set local role authenticated;
  assert cali_workspace.v2_save_pilot_staff_draft(a,member,null,null,'Admissão QA',array['projects'],false)=member;
  reset role;
  select updated_at into strict revision from cali_workspace.staff_members where id=member;
  set local role authenticated;
  assert cali_workspace.v2_set_pilot_staff_active(a,gen_random_uuid(),member,revision,true)=member;
  reset role;
  select updated_at into strict revision from cali_workspace.staff_members where id=member;

  insert into auth.users(id,email,email_confirmed_at)
  values(target,'cali-qa-staff-'||member::text||'@example.invalid',null);
  insert into auth.sessions(id,user_id) values(session_id,target);
  set local role authenticated;
  begin
    perform cali_workspace.v2_issue_pilot_staff_invite(a,invite_id,member,revision,target,deadline);
    raise exception 'Convite para endereço sem confirmação';
  exception when insufficient_privilege then null; end;
  reset role;
  update auth.users set email_confirmed_at=clock_timestamp() where id=target;
  set local role authenticated;
  perform set_config(claims_name,admin_aal1::text,true);
  begin
    perform cali_workspace.v2_issue_pilot_staff_invite(a,invite_id,member,revision,target,deadline);
    raise exception 'Convite sem MFA';
  exception when insufficient_privilege then null; end;
  perform set_config(claims_name,admin_claims::text,true);
  begin
    perform cali_workspace.v2_issue_pilot_staff_invite(b,invite_id,member,revision,target,deadline);
    raise exception 'Convite cruzado';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_issue_pilot_staff_invite(a,expired_invite,member,revision,target,deadline)=expired_invite;
  reset role;
  update cali_session_guard.phase4_staff_invites
  set issued_at=clock_timestamp()-interval '2 seconds',expires_at=clock_timestamp()-interval '1 second'
  where id=expired_invite;
  set local role authenticated;
  perform set_config(claims_name,target_claims::text,true);
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(expired_invite);
    raise exception 'Aceite de convite expirado';
  exception when insufficient_privilege then null; end;
  perform set_config(claims_name,admin_claims::text,true);
  assert cali_workspace.v2_revoke_pilot_staff_invite(a,expired_invite)=member;
  assert cali_workspace.v2_issue_pilot_staff_invite(a,invite_id,member,revision,target,deadline)=invite_id;
  assert cali_workspace.v2_issue_pilot_staff_invite(a,invite_id,member,revision,target,deadline)=invite_id;
  begin
    perform cali_workspace.v2_issue_pilot_staff_invite(a,gen_random_uuid(),member,revision,target,deadline);
    raise exception 'Dois convites abertos';
  exception when unique_violation then null; end;
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(invite_id);
    raise exception 'Aceite por outro usuário';
  exception when insufficient_privilege then null; end;
  reset role;

  perform set_config(claims_name,target_claims::text,true);
  assert not cali_session_guard.phase4_staff_can_access(a,'projects');
  set local role authenticated;
  perform set_config(claims_name,(target_claims||'{"session_id":"inválida"}'::jsonb)::text,true);
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(invite_id);
    raise exception 'Aceite sem sessão válida';
  exception when insufficient_privilege then null; end;
  perform set_config(claims_name,target_claims::text,true);
  assert cali_workspace.v2_accept_pilot_staff_invite(invite_id)=member;
  reset role;
  select accepted_at into strict accepted from cali_session_guard.phase4_staff_invites where id=invite_id;
  assert accepted is not null;
  set local role authenticated;
  assert cali_workspace.v2_accept_pilot_staff_invite(invite_id)=member;
  begin
    perform cali_workspace.v2_revoke_pilot_staff_invite(a,invite_id);
    raise exception 'Revogação por convidado';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select accepted_at from cali_session_guard.phase4_staff_invites where id=invite_id)=accepted;
  assert cali_session_guard.phase4_staff_can_access(a,'projects');
  assert not cali_session_guard.phase4_staff_can_access(a,'hours');
  assert not cali_session_guard.phase4_staff_can_access(b,'projects');

  perform set_config(claims_name,admin_claims::text,true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_revoke_pilot_staff_invite(b,invite_id);
    raise exception 'Revogação cruzada';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_revoke_pilot_staff_invite(a,invite_id)=member;
  reset role;
  select revoked_at into strict revoked from cali_session_guard.phase4_staff_invites where id=invite_id;
  assert revoked is not null;
  set local role authenticated;
  assert cali_workspace.v2_revoke_pilot_staff_invite(a,invite_id)=member;
  reset role;
  assert (select revoked_at from cali_session_guard.phase4_staff_invites where id=invite_id)=revoked;

  perform set_config(claims_name,target_claims::text,true);
  assert exists(select 1 from auth.sessions where id=session_id);
  assert not cali_session_guard.phase4_staff_can_access(a,'projects');
  set local role authenticated;
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(invite_id);
    raise exception 'Aceite restaurou convite revogado';
  exception when insufficient_privilege then null; end;

  perform set_config(claims_name,admin_claims::text,true);
  assert cali_workspace.v2_issue_pilot_staff_invite(a,later_invite,member,revision,target,deadline)=later_invite;
  perform set_config(claims_name,target_claims::text,true);
  assert cali_workspace.v2_accept_pilot_staff_invite(later_invite)=member;
  reset role;
  assert cali_session_guard.phase4_staff_can_access(a,'projects');
  update auth.sessions set not_after=statement_timestamp()-interval '1 second' where id=session_id;
  assert not cali_session_guard.phase4_staff_can_access(a,'projects');
  update auth.sessions set not_after=null where id=session_id;
  assert cali_session_guard.phase4_staff_can_access(a,'projects');
  perform set_config(claims_name,admin_claims::text,true);
  set local role authenticated;
  assert cali_workspace.v2_set_pilot_staff_active(a,gen_random_uuid(),member,revision,false)=member;
  reset role;
  select updated_at into strict revision from cali_workspace.staff_members where id=member;
  set local role authenticated;
  assert cali_workspace.v2_set_pilot_staff_active(a,gen_random_uuid(),member,revision,true)=member;
  reset role;
  perform set_config(claims_name,target_claims::text,true);
  assert not cali_session_guard.phase4_staff_can_access(a,'projects');
  assert not exists(select 1 from cali_workspace.profiles where id=target);
  assert exists(select 1 from cali_workspace.staff_members where id=member and user_id is null);
  assert not has_function_privilege('anon','cali_workspace.v2_accept_pilot_staff_invite(uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','cali_session_guard.phase4_staff_can_access(uuid,text)','EXECUTE');
  assert not has_table_privilege('authenticated','cali_session_guard.phase4_staff_invites','SELECT');
end;
$$;
