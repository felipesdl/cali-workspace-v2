do $$
declare
  company uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  admin_id uuid:='10000000-0000-4000-8000-000000000001';
  admin_session uuid:='10000000-0000-4000-8000-000000000002';
  partner_id uuid:='10000000-0000-4000-8000-000000000003';
  partner_session uuid:='10000000-0000-4000-8000-000000000004';
  member uuid:='10000000-0000-4000-8000-000000000005';
  invite uuid:='10000000-0000-4000-8000-000000000006';
  target_record uuid:='10000000-0000-4000-8000-000000000007';
  revision timestamptz:=statement_timestamp();
  terms record;
  result jsonb;
  draft_id uuid;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.sessions(id,user_id) values(admin_session,admin_id),(partner_session,partner_id);
  insert into auth.users(id,email,email_confirmed_at) values
    (admin_id,'cali-admin-qa@example.invalid',now()),
    (partner_id,'cali-qa-staff-'||member::text||'@example.invalid',now());
  insert into cali_workspace.profiles(id,role,active,full_name) values(admin_id,'admin',true,'Admin QA');
  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),admin_id,'totp','verified',now(),now()),
      (gen_random_uuid(),partner_id,'totp','verified',now(),now());
  insert into cali_v2_terms.confirmations(user_id,version,content_hash)
    values(admin_id,terms.version,terms.content_hash);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,'cali-qa-staff-'||member::text||'@example.invalid','Partner QA',array['projects','records','hours'],true,revision);
  insert into cali_workspace.staff_company_assignments values(member,company);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,target_user_id,
    issued_by,expires_at,accepted_at)
    values(invite,company,member,revision,partner_id,admin_id,now()+interval '1 day',now());
  insert into cali_session_guard.phase5_partner_terms(user_id,version,content_hash)
    values(partner_id,terms.version,terms.content_hash);
  insert into public.mapa_respostas(id,protocolo,status,c_email,observacoes,d1_rh_hoje,d1_processos,
    d1_cargos_salarios,d2_valores,d2_lideres_preparo,d2_comportamento_dono,d2_sucessao,
    d3_indicadores,d3_decisao,d3_custo,d4_colaboradores,d4_unidades,d4_turnover)
    values(target_record,'CALI-QA-V2-MAPA-PARTNER-01','novo','synthetic@example.invalid',
      '{"d1_obs":"observação de teste","d2_obs":"segunda observação","d3_obs":"terceira","d4_obs":"quarta","contato":"segredo@example.invalid"}',
      2,4,6,5,7,4,5,1,4,2,3,5,1);
  insert into cali_session_guard.phase4_mapa_scope(record_id,company_id,operator_id,expires_at)
    values(target_record,company,admin_id,now()+interval '1 day');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated',
    'session_id',admin_session,'aal','aal2')::text,true);
  set local role authenticated;
  assert (cali_workspace.v2_list_pilot_mapa_partners(company)->'partners'->0->>'inviteId')=invite::text;
  perform cali_workspace.v2_assign_pilot_mapa_partner(company,target_record,0,invite);
  reset role;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',partner_id,'role','authenticated',
    'session_id',partner_session,'aal','aal2')::text,true);
  set local role authenticated;
  result:=cali_workspace.v2_list_partner_mapa_opinions(1);
  assert result->>'total'='1';
  assert result#>>'{entries,0,record_id}'=target_record::text;
  assert result#>>'{entries,0,diagnostic,protocol}'='CALI-QA-V2-MAPA-PARTNER-01';
  assert result::text not like '%synthetic@example.invalid%' and result::text not like '%segredo@example.invalid%';
  assert result#>>'{entries,0,diagnostic,observations,0}'='observação de teste';
  draft_id:=cali_workspace.v2_save_partner_mapa_opinion(target_record,1,gen_random_uuid(),'save','Parecer privado');
  reset role;
  assert (select observacoes->>'parecer' from public.mapa_respostas where id=target_record) is null;
  set local role authenticated;
  perform cali_workspace.v2_save_partner_mapa_opinion(target_record,1,gen_random_uuid(),'submit','Parecer privado final');
  result:=cali_workspace.v2_list_partner_mapa_opinions(1);
  assert result#>>'{entries,0,draft_status}'='submitted';
  reset role;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated',
    'session_id',admin_session,'aal','aal2')::text,true);
  set local role authenticated;
  result:=cali_workspace.v2_list_pilot_mapa_opinion_drafts(company,1);
  assert result->>'total'='1' and result#>>'{entries,0,id}'=draft_id::text;
  perform cali_workspace.v2_decide_pilot_mapa_opinion(company,target_record,1,0,gen_random_uuid(),
    'apply','em_andamento',null);
  reset role;
  assert (select observacoes->>'parecer' from public.mapa_respostas where id=target_record)='Parecer privado final';
  assert (select status from cali_session_guard.phase5_partner_mapa_opinions where id=draft_id)='approved';
  assert (select g.revision from cali_session_guard.phase4_mapa_scope g where g.record_id=target_record)=1;
  set local role authenticated;
  begin
    perform cali_workspace.v2_decide_pilot_mapa_opinion(company,target_record,1,0,gen_random_uuid(),
      'apply','em_andamento',null);
    raise exception 'Parecer repetido aplicado';
  exception when serialization_failure then null; end;
  reset role;
  update cali_session_guard.phase4_staff_invites set revoked_at=now(),revoked_by=admin_id where id=invite;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',partner_id,'role','authenticated',
    'session_id',partner_session,'aal','aal2')::text,true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_list_partner_mapa_opinions(1);
    raise exception 'Partner revogado ainda consultou parecer';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_save_partner_mapa_opinion(uuid,integer,uuid,text,text)','execute');
end $$;
