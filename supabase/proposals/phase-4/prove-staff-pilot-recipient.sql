-- Prova hospedada do destinatário; usar na mesma transação da candidata e reverter.
-- A emissão e a revogação Admin são cobertas separadamente em prove-staff-pilot-admission.sql.
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member uuid:=gen_random_uuid();
  recipient uuid:=gen_random_uuid();
  stranger uuid:=gen_random_uuid();
  session_id uuid:=gen_random_uuid();
  stranger_session uuid:=gen_random_uuid();
  invite_id uuid:=gen_random_uuid();
  member_email text:='cali-qa-staff-'||member::text||'@example.invalid';
  revision timestamptz:=clock_timestamp();
  claims jsonb:=jsonb_build_object('sub',recipient,'role','authenticated','session_id',session_id,'aal','aal1');
begin
  assert (select count(*) from cali_session_guard.pilot_companies where company_id in(a,b))=2;
  insert into auth.users(id,email,email_confirmed_at) values
    (recipient,member_email,clock_timestamp()),(stranger,'cali-qa-other-'||stranger::text||'@example.invalid',clock_timestamp());
  insert into auth.sessions(id,user_id) values(session_id,recipient),(stranger_session,stranger);
  insert into cali_workspace.staff_members(id,email,full_name,active,modules,updated_at)
  values(member,member_email,'[TESTE V2] Admissão QA',true,array['projects'],revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,target_user_id,issued_by,expires_at)
  values(invite_id,a,member,revision,recipient,gen_random_uuid(),clock_timestamp()+interval '5 minutes');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated',
    'session_id',stranger_session,'aal','aal1')::text,true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(invite_id);
    raise exception 'Aceite por outro usuário';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',claims::text,true);
  assert cali_workspace.v2_accept_pilot_staff_invite(invite_id)=member;
  reset role;

  assert cali_session_guard.phase4_staff_can_access(a,'projects');
  assert not cali_session_guard.phase4_staff_can_access(a,'hours');
  assert not cali_session_guard.phase4_staff_can_access(b,'projects');
  update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=issued_by
  where id=invite_id;
  assert exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=recipient);
  assert not cali_session_guard.phase4_staff_can_access(a,'projects');
  set local role authenticated;
  begin
    perform cali_workspace.v2_accept_pilot_staff_invite(invite_id);
    raise exception 'Aceite restaurou convite revogado';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not exists(select 1 from cali_workspace.profiles where id in(recipient,stranger));
  assert not has_function_privilege('anon','cali_workspace.v2_accept_pilot_staff_invite(uuid)','EXECUTE');
end;
$$;
