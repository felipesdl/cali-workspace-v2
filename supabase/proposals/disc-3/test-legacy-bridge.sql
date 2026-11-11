\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_v2_disc;
create schema auth;
create function auth.role() returns text language sql stable as $$ select current_setting('test.role',true) $$;
create schema storage;
create table storage.objects(bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql immutable as $$ select array['fixture']::text[] $$;
create function cali_v2_disc.require_admin() returns uuid language plpgsql stable as $$ begin
 if current_setting('test.admin',true) is distinct from 'true' then raise exception using errcode='42501',message='Admin MFA/terms required'; end if;
 return '90000000-0000-4000-8000-000000000009'::uuid;
end $$;
create table cali_v2_disc.allowed_recipients(email text primary key);
insert into cali_v2_disc.allowed_recipients values('synthetic@example.invalid');
create table cali_workspace.companies(id uuid primary key,display_name text);
create table cali_workspace.profile_links(
 id uuid primary key,slug text unique,title text,purpose text,status text,created_at timestamptz,
 company_id uuid,company_label text,gestao_goal text,gestao_note text,gestao_moment text,gestao_sector text,
 gestao_approved_at timestamptz,gestao_released_at timestamptz,gestao_protocol text,gestao_sent_log jsonb
);
create table cali_workspace.profile_results(id uuid primary key,answers jsonb,job_title text);
alter table cali_workspace.profile_results enable row level security;
alter table cali_workspace.profile_results add column client_visible boolean not null default false;
alter table cali_workspace.profile_results add column company_id uuid;
alter table cali_workspace.profile_results add column link_id uuid;
alter table cali_workspace.profile_results add column person_name text;
alter table cali_workspace.profile_results add column email text;
alter table cali_workspace.profile_results add column primary_style text;
alter table cali_workspace.profile_results add column secondary_style text;
alter table cali_workspace.profile_results add column mixed boolean;
alter table cali_workspace.profile_results add column scores jsonb;
alter table cali_workspace.profile_results add column method_version text;
alter table cali_workspace.profile_results add column protocol text;
alter table cali_workspace.profile_results add column created_at timestamptz;
alter table cali_workspace.profile_results add column report_path text;
alter table cali_workspace.profile_results add column report_emailed_at timestamptz;
create function cali_workspace.current_company_id() returns uuid language sql stable as $$ select null::uuid $$;
create function cali_workspace.is_admin() returns boolean language sql stable as $$ select false $$;
create policy profile_results_admin_all on cali_workspace.profile_results for all to authenticated
 using (cali_workspace.is_admin()) with check (cali_workspace.is_admin());
create policy profile_results_client_visible on cali_workspace.profile_results for select to authenticated
 using (client_visible and company_id is not null and company_id=cali_workspace.current_company_id());
create table cali_workspace.profile_invites(
 id uuid primary key,link_id uuid,token uuid unique,person_name text,email text,created_at timestamptz,
 sent_at timestamptz,
 deadline_at timestamptz,opened_at timestamptz,started_at timestamptz,last_block integer,
 completed_at timestamptz,result_id uuid,declined_at timestamptz
);
create function public.cali_profile_report(uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.cali_profile_report_ready(uuid,text) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.cali_profile_accepts_report(text) returns boolean language sql stable as $$ select true $$;
create policy cali_profiles_report_upload on storage.objects for insert to anon,authenticated
 with check (bucket_id='cali-profiles' and public.cali_profile_accepts_report((storage.foldername(name))[1]));
create function cali_workspace.profile_invite_state(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz)
returns text language sql stable as $$ select case when $5 is not null then 'completed' when $6 is not null then 'declined' when $1 is null then 'created' when $3 is not null then 'opened' when $4 is not null then 'started' else 'sent' end $$;
insert into cali_workspace.companies values ('9c5ab148-78b8-4410-9338-58c44222a5db','Empresa sintética A');
insert into cali_workspace.profile_links(id,slug,title,purpose,status,created_at,company_id,company_label,gestao_sent_log)
 values ('10000000-0000-4000-8000-000000000001','ciclo-teste','Questionário teste','desenvolvimento','open',now(),
 '9c5ab148-78b8-4410-9338-58c44222a5db',null,'[]'::jsonb);
insert into cali_workspace.profile_links(id,slug,title,purpose,status,created_at,company_id,company_label,gestao_sent_log)
 values ('70000000-0000-4000-8000-000000000007','fora-do-piloto','Fixture sem autorização','desenvolvimento','open',now(),
 '70000000-0000-4000-8000-000000000007',null,'[]'::jsonb);
insert into cali_workspace.profile_invites values
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','Pessoa Sintética','synthetic@example.invalid',now(),now(),now()+interval '7 days',null,null,0,null,null,null);
insert into cali_workspace.profile_invites values
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','Pessoa Fora da Lista','outside@example.invalid',now(),now(),now()+interval '7 days',null,null,0,null,null,null);
insert into cali_workspace.profile_invites values
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006','Resposta histórica','historic@example.invalid',now(),now(),now()+interval '7 days',now(),now(),24,now(),
  '80000000-0000-4000-8000-000000000006',null);
insert into cali_workspace.profile_invites values
 ('20000000-0000-4000-8000-000000000007','70000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000007','Pessoa fora do piloto','notpilot@example.invalid',now(),now(),now()+interval '7 days',null,null,0,null,null,null);
insert into cali_workspace.profile_results(id,answers,job_title,company_id,link_id,person_name,email,primary_style,secondary_style,mixed,scores,method_version,protocol,created_at,report_path)
 values('80000000-0000-4000-8000-000000000006','{"natural":[],"pressure":[]}'::jsonb,'Analista',
 '9c5ab148-78b8-4410-9338-58c44222a5db','10000000-0000-4000-8000-000000000001','Resposta histórica','historic@example.invalid','S','C',false,'{}'::jsonb,'cali-disc-v1','DISC-OLD-001',now(),null);
create function cali_workspace.profile_gestao(uuid) returns jsonb language sql stable as $$ select jsonb_build_object(
 'link_id','10000000-0000-4000-8000-000000000001','title','Questionário teste','company','Empresa sintética A',
 'purpose','desenvolvimento','moment',null,'sector',null,'goal',null,'released_at',null,'n',0,
 'invites',jsonb_build_object('sent',1,'completed',0,'declined',0,'started',0,'expired',0,'median_minutes',null),
 'dates',jsonb_build_object('min',null,'max',null,'method',null),'dist',null) $$;
create function public.cali_profile_invite_open(uuid) returns jsonb language plpgsql as $$ begin update cali_workspace.profile_invites set opened_at=coalesce(opened_at,now()) where token=$1; return '{}'::jsonb; end $$;
create function public.cali_profile_invite_progress(uuid,integer) returns void language sql as $$ update cali_workspace.profile_invites set last_block=$2 where token=$1 $$;
create function public.cali_profile_invite_decline(uuid) returns jsonb language sql as $$ update cali_workspace.profile_invites set declined_at=now() where token=$1 returning '{}'::jsonb $$;
create function public.cali_profile_submit_invite(uuid,text,jsonb,boolean) returns jsonb language plpgsql as $$
declare v_result_id uuid:=gen_random_uuid(); begin
 insert into cali_workspace.profile_results(id,answers,job_title,company_id,link_id,person_name,email,primary_style,secondary_style,mixed,scores,method_version,protocol,created_at)
 select v_result_id,$3,nullif($2,''),l.company_id,i.link_id,i.person_name,i.email,'D','I',false,
 jsonb_build_object('natural',jsonb_build_object('D',jsonb_build_object('raw',1,'pct',60),'I',jsonb_build_object('raw',0,'pct',50),'S',jsonb_build_object('raw',0,'pct',50),'C',jsonb_build_object('raw',0,'pct',50)),
 'natural6',jsonb_build_object('D',jsonb_build_object('raw',1,'pct',60),'I',jsonb_build_object('raw',0,'pct',50),'S',jsonb_build_object('raw',0,'pct',50),'C',jsonb_build_object('raw',0,'pct',50)),
 'pressure',jsonb_build_object('D',jsonb_build_object('raw',1,'pct',60),'I',jsonb_build_object('raw',0,'pct',50),'S',jsonb_build_object('raw',0,'pct',50),'C',jsonb_build_object('raw',0,'pct',50)),
 'adaptation',jsonb_build_object('D',0,'I',0,'S',0,'C',0)),'cali-disc-v1','DISC-SYN-001',now()
 from cali_workspace.profile_invites i join cali_workspace.profile_links l on l.id=i.link_id where i.token=$1;
 update cali_workspace.profile_results set report_path=id::text||'/perfil-comportamental-1.pdf' where id=v_result_id;
 update cali_workspace.profile_invites set completed_at=now(),result_id=v_result_id where token=$1;
 return jsonb_build_object('id',v_result_id,'token',gen_random_uuid());
end $$;
\ir legacy-bridge.sql
do $$ begin
 begin
   perform cali_workspace.v2_disc_legacy_admin(null);
   raise exception 'Admin catalog bypassed MFA/terms guard';
 exception when sqlstate '42501' then null; end;
end $$;
set test.admin='true';
\ir legacy-bridge-dec13.sql
\ir legacy-delivery.sql

do $$ declare got jsonb; payload jsonb:=jsonb_build_object(
 'requestId','40000000-0000-4000-8000-000000000004','jobTitle','Analista','consent',true,
 'answers',jsonb_build_object('natural',jsonb_build_array(1,2),'pressure',jsonb_build_array(3))
); n integer; delivery jsonb; delivery_id uuid; lease_id uuid; begin
 got:=cali_workspace.v2_disc_legacy_public('outro-slug','30000000-0000-4000-8000-000000000003','read','{}');
 if got->>'state'<>'missing' then raise exception 'slug mismatch was accepted'; end if;
 got:=cali_workspace.v2_disc_legacy_public('fora-do-piloto','30000000-0000-4000-8000-000000000007','read','{}');
 if got->>'state'<>'missing' then raise exception 'non-pilot data became public'; end if;
 if has_function_privilege('anon','public.cali_profile_report(uuid)','execute') then raise exception 'public result reader remained executable'; end if;
 if has_function_privilege('anon','public.cali_profile_report_ready(uuid,text)','execute') then raise exception 'production email trigger remained callable'; end if;
 if exists(select 1 from pg_policies where schemaname='cali_workspace' and tablename='profile_results' and policyname='profile_results_client_visible') then raise exception 'legacy client row policy remained'; end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cali_profiles_report_upload') then raise exception 'legacy public upload policy remained'; end if;
 got:=cali_workspace.v2_disc_legacy_public('ciclo-teste','30000000-0000-4000-8000-000000000003','submit',payload);
 if got->>'state'<>'completed' or got ? 'token' or got ? 'result_id' then raise exception 'unsafe submit projection: %',got; end if;
 select count(*) into n from cali_workspace.profile_results;
 got:=cali_workspace.v2_disc_legacy_public('ciclo-teste','30000000-0000-4000-8000-000000000003','submit',payload);
 if (select count(*) from cali_workspace.profile_results)<>n then raise exception 'retry duplicated result'; end if;
 got:=cali_workspace.v2_disc_legacy_public('ciclo-teste','30000000-0000-4000-8000-000000000005','submit',jsonb_set(payload,'{requestId}','"40000000-0000-4000-8000-000000000005"'));
 if got->>'state'<>'completed' then raise exception 'non-allowlisted recipient blocked collection'; end if;
 got:=cali_workspace.v2_disc_legacy_public('ciclo-teste','30000000-0000-4000-8000-000000000006','submit',payload);
 if got->>'state'<>'completed' then raise exception 'historical completion was not acknowledged'; end if;
 if exists(select 1 from cali_workspace.profile_invite_submit_receipts where invite_id='20000000-0000-4000-8000-000000000006') then raise exception 'historical completion was incorrectly marked as new'; end if;
 begin
   perform cali_workspace.v2_disc_legacy_public('ciclo-teste','30000000-0000-4000-8000-000000000003','submit',jsonb_set(payload,'{jobTitle}','"Outro"'));
   raise exception 'changed retry unexpectedly succeeded';
 exception when sqlstate '22023' then null; end;
 got:=cali_workspace.v2_disc_legacy_admin('10000000-0000-4000-8000-000000000001');
 if got->'selected'->'link'->>'slug'<>'ciclo-teste' then raise exception 'Admin catalog missed synthetic link'; end if;
 if jsonb_array_length(got->'selected'->'evaluations')<>3 then raise exception 'Admin history missed fixture evaluations'; end if;
 if exists(select 1 from jsonb_array_elements(got->'selected'->'evaluations') evaluation where evaluation ? 'token' or evaluation ? 'access_token') then raise exception 'Admin report leaked public token'; end if;
 if not exists(select 1 from jsonb_array_elements(got->'selected'->'evaluations') evaluation where evaluation->>'report_path' ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$') then raise exception 'Admin private PDF path missing'; end if;
 if got->'selected'->'management_report'->>'link_id'<>'10000000-0000-4000-8000-000000000001' then raise exception 'Management report not preserved for Admin'; end if;
 if jsonb_array_length(cali_workspace.v2_disc_legacy_admin(null)->'links')<>1 then raise exception 'Admin catalog escaped pilot company allowlist'; end if;
 if not exists(select 1 from pg_policies where schemaname='cali_workspace' and tablename='profile_results' and policyname='profile_results_admin_all') then raise exception 'Admin history policy was removed'; end if;
 if has_function_privilege('anon','public.cali_profile_report(uuid)','execute') then raise exception 'public result reader remained executable'; end if;
 if exists(select 1 from pg_policies where schemaname='cali_workspace' and tablename='profile_results' and policyname='profile_results_client_visible') then raise exception 'legacy client row policy remained'; end if;
 if (select count(*) from cali_v2_disc.legacy_delivery_jobs where state='pending')<>1 then raise exception 'allowlisted delivery job not queued exactly once'; end if;
 if (select count(*) from cali_v2_disc.legacy_delivery_jobs where state='blocked' and error='recipient_outside_preview')<>1 then raise exception 'non-allowlisted delivery was not recorded as blocked'; end if;
end $$;
set test.role='user';
do $$ begin
 begin perform cali_workspace.v2_disc_legacy_delivery('claim',null,'{}'); raise exception 'non-service role claimed delivery';
 exception when sqlstate '42501' then null; end;
end $$;
set test.role='service_role';
do $$ declare job jsonb; ok jsonb; begin
 job:=cali_workspace.v2_disc_legacy_delivery('claim',null,'{}');
 if job->>'kind'<>'respondent_pdf' or job->>'token' is distinct from null or job->'respondent' ? 'scores' then raise exception 'unsafe worker DTO: %',job; end if;
 if job->'respondent'->>'protocol' is null or job->'respondent'->'signer' is distinct from 'null'::jsonb then raise exception 'worker DTO lacks safe protocol/signer'; end if;
 ok:=cali_workspace.v2_disc_legacy_delivery('validate',(job->>'id')::uuid,jsonb_build_object('lease',job->>'legacyLease'));
 if ok is distinct from 'true'::jsonb then raise exception 'current lease did not validate'; end if;
 begin
   perform cali_workspace.v2_disc_legacy_delivery('validate',(job->>'id')::uuid,jsonb_build_object('lease',gen_random_uuid()));
   raise exception 'stale lease validated';
 exception when sqlstate '40001' then null; end;
 if exists(select 1 from cali_workspace.profile_results where report_emailed_at is not null) then raise exception 'email timestamp written before provider confirmation'; end if;
 perform cali_workspace.v2_disc_legacy_delivery('sent',(job->>'id')::uuid,jsonb_build_object('lease',job->>'legacyLease','providerId','synthetic-provider-receipt'));
 if not exists(select 1 from cali_workspace.profile_results where report_emailed_at is not null) then raise exception 'confirmed synthetic receipt did not stamp report'; end if;
end $$;
\ir legacy-bridge-dec13-rollback.sql
do $$ begin
 if not has_function_privilege('anon','public.cali_profile_report(uuid)','execute') then raise exception 'rollback did not restore original report grant'; end if;
 if not has_function_privilege('anon','public.cali_profile_report_ready(uuid,text)','execute') then raise exception 'rollback did not restore report delivery grant'; end if;
 if not exists(select 1 from pg_policies where schemaname='cali_workspace' and tablename='profile_results' and policyname='profile_results_client_visible') then raise exception 'rollback did not restore client policy'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cali_profiles_report_upload') then raise exception 'rollback did not restore upload policy'; end if;
end $$;
