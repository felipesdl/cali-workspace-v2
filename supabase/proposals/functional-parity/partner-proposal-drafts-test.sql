create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
create schema cali_session_guard;
grant usage on schema cali_workspace to authenticated;
create function auth.uid() returns uuid language sql as $$select current_setting('cali.qa.actor',true)::uuid$$;
create table cali_workspace.staff_members(id uuid primary key,full_name text,role text);
create table cali_workspace.activity_log(company_id uuid,actor_user_id uuid,event_type text,entity_type text,entity_id uuid,metadata jsonb);
create table cali_session_guard.phase4_staff_invites(id uuid primary key,company_id uuid,member_id uuid,member_revision timestamptz,target_user_id uuid,
  revoked_at timestamptz,accepted_at timestamptz);
create table cali_session_guard.phase4_commercial_scope(submission_id uuid primary key,company_id uuid,operator_id uuid,proposal_id uuid,expires_at timestamptz,delivered_at timestamptz);
create table public.cali_submissions(id uuid primary key,protocol text,service_slug text,updated_at timestamptz,status text,contact_email text);
create table public.cali_proposals(id uuid primary key,submission_id uuid,updated_at timestamptz,status text,payment_terms text,public_notes text,validity_days integer);
create function cali_session_guard.require_phase4_role(uuid,text) returns uuid language plpgsql as $$
begin
  if current_setting('cali.qa.role',true) is distinct from 'admin' then raise exception using errcode='42501'; end if;
  return auth.uid();
end $$;
create function cali_session_guard.phase4_staff_binding(uuid,uuid,timestamptz,uuid) returns boolean
language sql as $$select exists(select 1 from cali_session_guard.phase4_staff_invites i
  where i.company_id=$1 and i.member_id=$2 and i.member_revision=$3 and i.target_user_id=$4 and i.revoked_at is null)$$;
create function cali_session_guard.phase5_partner_invite() returns cali_session_guard.phase4_staff_invites
language sql as $$select * from cali_session_guard.phase4_staff_invites where target_user_id=auth.uid() and revoked_at is null$$;
create function cali_workspace.v2_read_partner_pilot() returns jsonb language sql as $$
  select jsonb_build_object('status','ready','company',company_id) from cali_session_guard.phase5_partner_invite() where id is not null
$$;
create function cali_workspace.v2_create_pilot_commercial_draft(uuid,uuid) returns uuid language plpgsql as $$
declare proposal uuid:=gen_random_uuid();
begin
  perform cali_session_guard.require_phase4_role($1,'admin');
  insert into public.cali_proposals values(proposal,$2,clock_timestamp(),'rascunho',null,null,15);
  update cali_session_guard.phase4_commercial_scope set proposal_id=proposal where company_id=$1 and submission_id=$2;
  return proposal;
end $$;
create function cali_workspace.v2_save_pilot_commercial_draft(uuid,uuid,timestamptz,text,text,text,integer) returns uuid language plpgsql as $$
begin
  perform cali_session_guard.require_phase4_role($1,'admin');
  update public.cali_proposals set payment_terms=$5,public_notes=$6,validity_days=$7 where id=$2 and updated_at=$3 and status='rascunho';
  if not found then raise exception using errcode='40001'; end if;
  return $2;
end $$;
\ir ../phase-5/partner-proposal-drafts.sql

do $$
declare
  company uuid:=gen_random_uuid();
  admin uuid:=gen_random_uuid();
  partner uuid:=gen_random_uuid();
  other uuid:=gen_random_uuid();
  staff uuid:=gen_random_uuid();
  second_staff uuid:=gen_random_uuid();
  invite uuid:=gen_random_uuid();
  opportunity uuid:=gen_random_uuid();
  unassigned uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  expected timestamptz:='2026-11-01Z';
  list jsonb;
begin
  insert into cali_workspace.staff_members values(staff,'Parceiro atribuído','partner'),(second_staff,'Outro parceiro','partner');
  insert into cali_session_guard.phase4_staff_invites values
    (invite,company,staff,expected,partner,null,expected),(gen_random_uuid(),company,second_staff,expected,other,null,expected);
  insert into public.cali_submissions values
    (opportunity,'CALI-QA-V2-TESTE','cali-build',expected,'edicao','teste@example.invalid'),
    (unassigned,'CALI-QA-V2-OUTRA','cali-build',expected,'edicao','teste@example.invalid');
  insert into cali_session_guard.phase4_commercial_scope values
    (opportunity,company,admin,null,now()+interval '1 day',null),
    (unassigned,company,admin,null,now()+interval '1 day',null);
  perform set_config('cali.qa.actor',admin::text,true);
  perform set_config('cali.qa.role','admin',true);
  set local role authenticated;
  perform cali_workspace.v2_assign_partner_proposal(company,opportunity,invite);

  perform set_config('cali.qa.actor',other::text,true);
  perform set_config('cali.qa.role','partner',true);
  assert cali_workspace.v2_list_partner_proposal_drafts(company,1)->>'total'='0';
  begin
    perform cali_workspace.v2_submit_partner_proposal_draft(company,opportunity,expected,request,'Condição','Nota',15);
    raise exception 'Parceiro sem atribuição enviou rascunho';
  exception when insufficient_privilege then null; end;
  perform set_config('cali.qa.actor',partner::text,true);
  list:=cali_workspace.v2_list_partner_proposal_drafts(company,1);
  assert list->>'total'='1' and list#>>'{rows,0,id}'=opportunity::text;
  assert cali_workspace.v2_submit_partner_proposal_draft(company,opportunity,expected,request,'Condição','Nota',15)=request;
  assert cali_workspace.v2_submit_partner_proposal_draft(company,opportunity,expected,request,'Condição','Nota',15)=request;
  begin
    perform cali_workspace.v2_decide_partner_proposal_draft(company,opportunity,request,true,null);
    raise exception 'Parceiro decidiu o próprio rascunho';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not exists(select 1 from public.cali_proposals);
  perform set_config('cali.qa.actor',admin::text,true);
  perform set_config('cali.qa.role','admin',true);
  set local role authenticated;
  assert cali_workspace.v2_partner_proposal_admin(company,opportunity)#>>'{draft,author}'='Parceiro atribuído';
  assert cali_workspace.v2_decide_partner_proposal_draft(company,opportunity,request,true,null)=request;
  assert cali_workspace.v2_decide_partner_proposal_draft(company,opportunity,request,true,null)=request;
  reset role;
  assert (select count(*) from public.cali_proposals where status='rascunho' and payment_terms='Condição')=1;
  assert (select count(*) from cali_workspace.activity_log where event_type='partner_proposal_draft_accepted')=1;
end $$;
