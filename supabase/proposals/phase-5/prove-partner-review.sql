-- Ponta Partner no CALI MAPA: executar dentro de transação revertida.
-- Ponta Admin somente no banco descartável com cali.qa.review_admin=on.
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
  retry uuid:=gen_random_uuid();
  delivery uuid:=gen_random_uuid();
  project uuid:=gen_random_uuid();
  delivery_request uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid();
  admin_session uuid:=gen_random_uuid();
  title text:='[TESTE V2] Revisão Partner '||item::text;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['records','projects'],true,revision);
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

  if current_setting('cali.qa.review_admin',true)='on' then
    insert into cali_session_guard.phase4_project_qa values(project,a);
    insert into cali_workspace.deliverables(id,company_id,project_id,title,client_visible,status)
      values(delivery,a,project,'Entregável fictício',true,'in_progress');
  end if;
  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  assert cali_workspace.v2_submit_partner_pilot_review(a,request,'record_close',item,'Teste')=request;
  assert cali_workspace.v2_submit_partner_pilot_review(a,request,'record_close',item,'Teste')=request;
  assert (cali_workspace.v2_list_partner_pilot_reviews(a,false,1)->>'total')::int=1;
  begin
    perform cali_workspace.v2_submit_partner_pilot_review(a,gen_random_uuid(),'record_close',item,'Outro pedido');
    raise exception 'Segunda solicitação simultânea aceita';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_decide_partner_pilot_review(a,request,true,null);
    raise exception 'Partner decidiu a própria solicitação';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select workflow_status from cali_workspace.account_records where id=item)='open';

  assert (select status from cali_session_guard.phase5_partner_reviews where id=request)='pending';
  if current_setting('cali.qa.review_admin',true) is distinct from 'on' then return; end if;
  insert into auth.users(id,email,email_confirmed_at)
    values(admin_id,'cali-qa-admin-'||admin_id::text||'@example.invalid',now());
  insert into auth.sessions(id,user_id) values(admin_session,admin_id);
  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),admin_id,'totp','verified',now(),now());
  insert into cali_workspace.profiles(id,email,role,active,full_name)
    values(admin_id,'cali-qa-admin-'||admin_id::text||'@example.invalid','admin',true,'Admin sintético');
  insert into cali_workspace.terms_acceptances(user_id,version) values(admin_id,terms.version);
  insert into cali_v2_terms.confirmations(user_id,version,content_hash) values(admin_id,terms.version,terms.content_hash);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','session_id',admin_session,'aal','aal2')::text,true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_decide_partner_pilot_review(b,request,true,null);
    raise exception 'Admin decidiu na empresa errada';
  exception when insufficient_privilege then null; end;
  assert cali_workspace.v2_decide_partner_pilot_review(a,request,false,'Faltou comprovação')=request;
  reset role;
  assert (select workflow_status from cali_workspace.account_records where id=item)='open';

  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);
  set local role authenticated;
  assert cali_workspace.v2_list_partner_pilot_reviews(a,false,1)#>>'{rows,0,status}'='returned';
  assert cali_workspace.v2_submit_partner_pilot_review(a,retry,'record_close',item,'Ajustado')=retry;
  assert cali_workspace.v2_submit_partner_pilot_review(a,delivery_request,'deliverable',delivery,'Revisar')=delivery_request;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','session_id',admin_session,'aal','aal2')::text,true);
  set local role authenticated;
  assert cali_workspace.v2_decide_partner_pilot_review(a,retry,true,null)=retry;
  assert cali_workspace.v2_decide_partner_pilot_review(a,retry,true,null)=retry;
  assert cali_workspace.v2_decide_partner_pilot_review(a,delivery_request,true,null)=delivery_request;
  reset role;
  assert (select status from cali_workspace.deliverables where id=delivery)='client_review';
  assert (select workflow_status from cali_workspace.account_records where id=item)='completed';
  assert (select status from cali_session_guard.phase5_partner_reviews where id=retry)='approved';
  assert (select count(*) from cali_workspace.activity_log where entity_id=retry and event_type='partner_pilot_review_approved')=1;
  assert not exists(select 1 from cali_workspace.notifications where entity_id=item and email_required);
end $$;
