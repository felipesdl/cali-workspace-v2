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
  old_revision uuid:=gen_random_uuid();
  new_revision uuid:=gen_random_uuid();
  payload jsonb;
  document bytea:=convert_to('%PDF-1.4 Partner Document QA','UTF8');
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['documents'],true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);
  insert into cali_session_guard.phase4_documents(id,company_id,title) values(item,a,'[TESTE V2] Documento Partner');
  insert into cali_session_guard.phase4_document_revisions(id,document_id,number,file_name,content,uploaded_by)
    values(old_revision,item,1,'anterior.pdf',convert_to('%PDF-1.4 anterior','UTF8'),actor),
      (new_revision,item,2,'vigente.pdf',document,actor);
  update cali_session_guard.phase4_documents set published_revision=new_revision where phase4_documents.id=item;
  insert into cali_session_guard.phase5_partner_catalog_scope values(a,'documents',item);
  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  payload:=cali_workspace.v2_list_partner_pilot_catalog(a,'documents',1);
  assert exists(select 1 from jsonb_array_elements(payload->'rows') j where j->>'id'=item::text and j->>'downloadRevision'=new_revision::text);
  payload:=cali_workspace.v2_download_partner_pilot_document(a,item,new_revision);
  assert decode(payload->>'content','base64')=document;
  assert payload->>'sha256'=encode(sha256(document),'hex');
  assert current_setting('response.headers',true) like '%no-store%';
  begin
    perform cali_workspace.v2_download_partner_pilot_document(a,item,old_revision);
    raise exception 'Documento obsoleto entregue';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_download_partner_pilot_document(b,item,new_revision);
    raise exception 'Documento de outra empresa entregue';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not exists(select 1 from cali_session_guard.phase4_document_acknowledgments where revision_id=new_revision);
  update cali_session_guard.phase4_documents set published_revision=null where phase4_documents.id=item;
  set local role authenticated;
  payload:=cali_workspace.v2_list_partner_pilot_catalog(a,'documents',1);
  assert not exists(select 1 from jsonb_array_elements(payload->'rows') j where j->>'id'=item::text);
  begin
    perform cali_workspace.v2_download_partner_pilot_document(a,item,new_revision);
    raise exception 'Documento retirado entregue';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
