-- CALI MAPA: executar dentro de transação revertida; a prova não dispara e-mail.
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
  item uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  message uuid;
  title text:='[TESTE V2] Resposta Partner '||item::text;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['records'],true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);
  insert into cali_session_guard.phase4_record_qa(company_id,title) values(a,title);
  insert into cali_workspace.account_records(id,company_id,title,record_type,visibility,source_actor,workflow_status,
    requires_action,last_activity_at)
  values(item,a,title,'request','client','client','open',true,now());

  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  assert (cali_workspace.v2_read_partner_pilot_detail(a,'records',item,1)->>'canReply')::boolean;
  begin
    perform cali_workspace.v2_reply_partner_pilot_record(b,request,item,'Resposta fictícia');
    raise exception 'Resposta enviada para empresa alheia';
  exception when insufficient_privilege then null; end;
  message:=cali_workspace.v2_reply_partner_pilot_record(a,request,item,'Resposta fictícia');
  assert message=cali_workspace.v2_reply_partner_pilot_record(a,request,item,'Resposta fictícia');
  begin
    perform cali_workspace.v2_reply_partner_pilot_record(a,request,item,'Payload divergente');
    raise exception 'Recibo aceitou divergência';
  exception when serialization_failure then null; end;
  assert (cali_workspace.v2_read_partner_pilot_detail(a,'records',item,1)#>>'{rows,0,title}')='Resposta fictícia';
  reset role;
  assert (select count(*) from cali_workspace.account_record_messages
    where record_id=item and id=message and author_id=actor and visibility='client')=1;
  assert (select count(*) from cali_workspace.account_record_messages where record_id=item)=1;
  assert (select workflow_status from cali_workspace.account_records where id=item)='waiting_client';
  assert not exists(select 1 from cali_workspace.notifications where entity_id=item and email_required);
  update cali_workspace.account_records set workflow_status='completed' where id=item;
  set local role authenticated;
  assert not (cali_workspace.v2_read_partner_pilot_detail(a,'records',item,1)->>'canReply')::boolean;
  begin
    perform cali_workspace.v2_reply_partner_pilot_record(a,gen_random_uuid(),item,'Conversa encerrada');
    raise exception 'Resposta enviada após encerramento';
  exception when insufficient_privilege then null; end;
  reset role;
  update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=actor where id=invite;
  set local role authenticated;
  begin
    perform cali_workspace.v2_reply_partner_pilot_record(a,request,item,'Resposta fictícia');
    raise exception 'Sessão revogada reusou recibo';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
