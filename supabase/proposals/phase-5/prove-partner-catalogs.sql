-- CALI MAPA: executar em transação revertida, sem comunicação ou arquivo real.
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
  ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  modules text[]:=array['calendar','documents','reports','notices','team'];
  result jsonb;
  slot integer;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',modules,true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);

  insert into cali_workspace.events(id,company_id,title,event_type,starts_at,ends_at,staff_visible)
    values(ids[1],a,'[TESTE V2] Agenda Partner','meeting',now(),now()+interval '1 hour',true);
  insert into cali_workspace.files(id,company_id,title,storage_path,status,client_visible)
    values(ids[2],a,'[TESTE V2] Documento Partner','qa/partner-'||ids[2]::text,'published',true);
  insert into cali_workspace.reports(id,company_id,title,status,reference_month,period_start,period_end,internal_note)
    values(ids[3],a,'[TESTE V2] Relatório Partner','published','2099-09-01','2099-09-01','2099-09-30','Nota privada fictícia');
  insert into cali_workspace.notices(id,protocol,title,body,audience)
    values(ids[4],'QA-'||ids[4]::text,'[TESTE V2] Aviso Partner','Mensagem fictícia','selected');
  insert into cali_workspace.notice_targets(notice_id,company_id) values(ids[4],a);
  insert into cali_workspace.team_members(id,company_id,employee_code,full_name,admission_date,job_title,department,work_email)
    values(ids[5],a,'QA-'||ids[5]::text,'[TESTE V2] Pessoa Partner',current_date,'Analista','Operações','qa-team@example.invalid');
  insert into cali_session_guard.phase5_partner_catalog_scope
    select a,modules[i],ids[i] from generate_subscripts(ids,1) i;
  -- Uma inscrição trocada não substitui a verificação de empresa no dado real.
  insert into cali_session_guard.phase5_partner_catalog_scope
    select b,modules[i],ids[i] from generate_subscripts(ids,1) i;
  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  assert cali_workspace.v2_read_partner_pilot()->'modules'=to_jsonb(modules);
  for slot in 1..cardinality(modules) loop
    result:=cali_workspace.v2_list_partner_pilot_catalog(a,modules[slot],1);
    assert exists(select 1 from jsonb_array_elements(result->'rows') j where j->>'id'=ids[slot]::text);
    assert result::text not like '%qa/partner-%'
      and result::text not like '%Nota privada fictícia%'
      and result::text not like '%qa-team@example.invalid%';
    begin
      perform cali_workspace.v2_list_partner_pilot_catalog(b,modules[slot],1);
      raise exception 'Catálogo de B vazou';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform cali_workspace.v2_list_partner_pilot_catalog(a,'hours',1);
    raise exception 'Módulo não atribuído foi aceito';
  exception when insufficient_privilege then null; end;
  reset role;
  update cali_workspace.events set staff_visible=false where id=ids[1];
  update cali_workspace.files set status='draft' where id=ids[2];
  update cali_workspace.reports set status='draft' where id=ids[3];
  delete from cali_workspace.notice_targets where notice_id=ids[4] and company_id=a;
  update cali_workspace.team_members set archived_at=clock_timestamp() where id=ids[5];
  set local role authenticated;
  for slot in 1..cardinality(modules) loop
    result:=cali_workspace.v2_list_partner_pilot_catalog(a,modules[slot],1);
    assert not exists(select 1 from jsonb_array_elements(result->'rows') j where j->>'id'=ids[slot]::text);
  end loop;
  reset role;
  update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=actor where id=invite;
  set local role authenticated;
  begin
    perform cali_workspace.v2_list_partner_pilot_catalog(a,'team',1);
    raise exception 'Equipe lida após corte';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
