-- CALI MAPA: executar dentro de transação revertida.
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
  payload jsonb;
  document bytea:=convert_to('%PDF-1.4 partner QA','UTF8');
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['reports'],true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);
  insert into cali_workspace.reports(id,company_id,title,status,version,reference_month,period_start,period_end)
    values(item,a,'[TESTE V2] Relatório com download Partner','approved',2,'2099-09-01','2099-09-01','2099-09-30');
  insert into cali_session_guard.phase5_partner_catalog_scope values(a,'reports',item);
  insert into cali_session_guard.phase4_report_approvals(report_id,company_id,version,approved_by,approved_at,snapshot,render_protocol)
    values(item,a,1,actor,now(),'{}','QA-ANTERIOR-'||item::text),(item,a,2,actor,now(),'{}','QA-VIGENTE-'||item::text);
  insert into cali_session_guard.phase4_report_pdfs(report_id,version,content)
    values(item,1,convert_to('%PDF-1.4 versão anterior','UTF8')),(item,2,document);
  insert into cali_session_guard.phase4_report_releases(report_id,version,released_at,released_by,requires_ack,withdrawn_at)
    values(item,1,now(),actor,false,now());
  insert into cali_session_guard.phase4_report_releases(report_id,version,released_at,released_by,requires_ack)
    values(item,2,now(),actor,true);

  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  payload:=cali_workspace.v2_list_partner_pilot_catalog(a,'reports',1);
  assert exists(select 1 from jsonb_array_elements(payload->'rows') j where j->>'id'=item::text and j->>'downloadVersion'='2');
  payload:=cali_workspace.v2_download_partner_pilot_report(a,item,2);
  assert decode(payload->>'content','base64')=document;
  assert payload->>'sha256'=encode(sha256(document),'hex');
  assert current_setting('response.headers',true) like '%no-store%';
  begin
    perform cali_workspace.v2_download_partner_pilot_report(a,item,1);
    raise exception 'PDF obsoleto entregue';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_download_partner_pilot_report(b,item,2);
    raise exception 'PDF de outra empresa entregue';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select acknowledged_at is null from cali_session_guard.phase4_report_releases where report_id=item and version=2);
  update cali_session_guard.phase4_report_releases set withdrawn_at=clock_timestamp() where report_id=item and version=2;
  set local role authenticated;
  payload:=cali_workspace.v2_list_partner_pilot_catalog(a,'reports',1);
  assert not exists(select 1 from jsonb_array_elements(payload->'rows') j where j->>'id'=item::text);
  begin
    perform cali_workspace.v2_download_partner_pilot_report(a,item,2);
    raise exception 'PDF retirado entregue';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
