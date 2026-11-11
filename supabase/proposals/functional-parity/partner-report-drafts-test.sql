create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
create schema cali_v2_terms;
grant usage on schema cali_workspace to authenticated;
create function auth.uid() returns uuid language sql as $$select current_setting('cali.qa.actor',true)::uuid$$;
create table auth.users(id uuid primary key);
create table cali_workspace.companies(id uuid primary key);
create table cali_workspace.staff_members(id uuid primary key,full_name text,role text);
create table cali_workspace.reports(id uuid primary key,company_id uuid,title text,reference_month date,status text,executive_summary text);
create table cali_workspace.activity_log(company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table cali_session_guard.phase4_staff_invites(
  id uuid primary key,company_id uuid,member_id uuid,member_revision timestamptz,target_user_id uuid,
  revoked_at timestamptz,accepted_at timestamptz
);
create table cali_session_guard.phase5_partner_terms(user_id uuid,version text,content_hash text);
create table cali_v2_terms.publications(version text,content_hash text,is_current boolean);
insert into cali_v2_terms.publications values('v1','hash-v1',true);
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language plpgsql as $$
begin
  if current_setting('cali.qa.role',true) is distinct from $2 then raise exception using errcode='42501'; end if;
  return auth.uid();
end $$;
create function cali_session_guard.phase5_partner_invite() returns cali_session_guard.phase4_staff_invites
language sql as $$select * from cali_session_guard.phase4_staff_invites where target_user_id=auth.uid() and revoked_at is null$$;
create function cali_session_guard.require_phase5_partner(p_company uuid,p_module text)
returns jsonb language plpgsql as $$
declare invitation cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
begin
  if invitation.company_id is distinct from p_company or invitation.accepted_at is null
    or current_setting('cali.qa.mfa',true) is distinct from 'true'
    or current_setting('cali.qa.module',true) is distinct from p_module
    or not exists(select 1 from cali_session_guard.phase5_partner_terms where user_id=auth.uid()) then
    raise exception using errcode='42501';
  end if;
  return '{}'::jsonb;
end $$;
create function cali_workspace.v2_create_pilot_report_draft(uuid,uuid,date,text,text) returns uuid language plpgsql as $$
begin
  perform cali_session_guard.require_phase4_role($1,'admin');
  insert into cali_workspace.reports values($2,$1,$4,$3,'draft',$5);
  return $2;
end $$;
\ir ../phase-5/partner-report-drafts.sql

do $$
declare
  company uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
  staff uuid:=gen_random_uuid(); other_staff uuid:=gen_random_uuid(); invite uuid:=gen_random_uuid();
  draft uuid:=gen_random_uuid(); expected timestamptz:='2026-11-01Z'; result jsonb; report_id uuid;
begin
  insert into auth.users values(admin),(partner),(other);
  insert into cali_workspace.companies values(company);
  insert into cali_workspace.staff_members values(staff,'Parceiro atribuído','partner'),(other_staff,'Outro parceiro','partner');
  insert into cali_session_guard.phase4_staff_invites values
    (invite,company,staff,expected,partner,null,expected),
    (gen_random_uuid(),company,other_staff,expected,other,null,expected);
  insert into cali_session_guard.phase5_partner_terms values(partner,'v1','hash-v1'),(other,'v1','hash-v1');

  perform set_config('cali.qa.actor',partner::text,true);
  perform set_config('cali.qa.role','partner',true);
  perform set_config('cali.qa.mfa','true',true);
  perform set_config('cali.qa.module','reports',true);
  perform cali_workspace.v2_save_partner_report_draft(company,gen_random_uuid(),null,'2026-11-01','Privado','Ainda em edição',false);
  result:=cali_workspace.v2_save_partner_report_draft(company,draft,null,'2026-11-01','Relatório mensal','Resumo privado',true);
  assert result->>'status'='submitted';
  assert cali_workspace.v2_save_partner_report_draft(company,draft,null,'2026-11-01','Relatório mensal','Resumo privado',true)=result;
  result:=cali_workspace.v2_list_partner_report_drafts(company,1);
  assert result->>'total'='2' and result#>>'{rows,0,summary}'='Resumo privado';
  assert result::text not like '%source_snapshot%';
  begin
    perform cali_workspace.v2_list_admin_partner_report_drafts(company,1);
    raise exception 'Partner consultou a fila Admin';
  exception when insufficient_privilege then null; end;
  perform set_config('cali.qa.actor',other::text,true);
  result:=cali_workspace.v2_list_partner_report_drafts(company,1);
  assert result->>'total'='0';
  begin
    perform cali_workspace.v2_save_partner_report_draft(gen_random_uuid(),gen_random_uuid(),null,'2026-11-01','X','Y',true);
    raise exception 'Partner sem vínculo criou relatório';
  exception when insufficient_privilege then null; end;

  perform set_config('cali.qa.actor',admin::text,true);
  perform set_config('cali.qa.role','admin',true);
  result:=cali_workspace.v2_list_admin_partner_report_drafts(company,1);
  assert result->>'total'='1' and result#>>'{rows,0,authorName}'='Parceiro atribuído';
  expected:=(result#>>'{rows,0,updatedAt}')::timestamptz;
  perform cali_workspace.v2_return_partner_report_draft(company,draft,expected,'Ajustar o resumo.');
  perform cali_workspace.v2_return_partner_report_draft(company,draft,expected,'Ajustar o resumo.');
  assert (select count(*) from cali_workspace.activity_log where event_type='partner_report_returned')=1;

  perform set_config('cali.qa.actor',partner::text,true);
  perform set_config('cali.qa.role','partner',true);
  result:=cali_workspace.v2_list_partner_report_drafts(company,1);
  assert result#>>'{rows,0,status}'='returned' and result#>>'{rows,0,decisionNote}'='Ajustar o resumo.';
  result:=cali_workspace.v2_save_partner_report_draft(company,draft,(result#>>'{rows,0,updatedAt}')::timestamptz,
    '2026-11-01','Relatório mensal','Resumo privado',true);
  assert result->>'status'='submitted' and result->>'decisionNote' is null;

  perform set_config('cali.qa.actor',admin::text,true);
  perform set_config('cali.qa.role','admin',true);
  begin
    perform cali_workspace.v2_materialize_partner_report_draft(company,draft,expected);
    raise exception 'Admin aceitou uma revisão desatualizada';
  exception when serialization_failure then null; end;
  expected:=(result->>'updatedAt')::timestamptz;
  result:=cali_workspace.v2_materialize_partner_report_draft(company,draft,expected);
  assert result->>'status'='materialized';
  report_id:=(result->>'reportId')::uuid;
  assert (select count(*) from cali_workspace.reports where id=report_id and status='draft' and executive_summary='Resumo privado')=1;
  assert cali_workspace.v2_materialize_partner_report_draft(company,draft,expected)=result;
  assert (select count(*) from cali_workspace.activity_log where event_type='partner_report_materialized')=1;
  assert (select author_user_id from cali_session_guard.phase5_partner_report_drafts where id=draft)=partner;
end $$;
