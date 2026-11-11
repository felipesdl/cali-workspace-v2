create table public.mapa_respostas(id uuid primary key,protocolo text,status text,created_at timestamptz default now(),
  c_email text,observacoes jsonb not null default '{}',diagnostico_v2 jsonb,
  d1_rh_hoje integer,d1_processos integer,d1_cargos_salarios integer,d2_valores integer,
  d2_lideres_preparo integer,d2_comportamento_dono integer,d2_sucessao integer,d3_indicadores integer,
  d3_decisao integer,d3_custo integer,d4_colaboradores integer,d4_unidades integer,d4_turnover integer);
\ir mapa-operations.sql
\ir mapa-report-read.sql
\ir mapa-email.sql
create table public.mapa_sessoes_resumo(session_id uuid primary key,accessed_at timestamptz,last_seen_at timestamptz,
  max_step smallint,started boolean,submitted boolean,copy_events integer,referrer_host text,device_type text);
\ir mapa-journeys.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  record_id uuid:=gen_random_uuid();
  outside uuid:=gen_random_uuid();
  expired uuid:=gen_random_uuid();
  actor uuid;
  other_admin uuid:=gen_random_uuid();
  result jsonb;
  journey uuid:=gen_random_uuid();
  ignored uuid:=gen_random_uuid();
  email_job uuid;
  resend_job uuid;
  request_id uuid:=gen_random_uuid();
  resend_request_id uuid:=gen_random_uuid();
  recipients jsonb:='["qa@example.test"]'::jsonb;
  receipt uuid:=gen_random_uuid();
  expected_report jsonb;
begin
  perform cali_workspace.fixture_as('admin');
  actor:=auth.uid();
  insert into public.mapa_respostas(id,protocolo,status,c_email,observacoes) values
    (record_id,'CALI-QA-V2-MAPA-01','novo','qa@example.invalid','{"d1_obs":"preservar"}'),
    (outside,'MAPA-LEGADO','novo','qa@example.invalid','{}'),
    (expired,'CALI-QA-V2-MAPA-02','novo','qa@example.invalid','{}');
  insert into cali_session_guard.phase4_mapa_scope(record_id,company_id,operator_id,expires_at)
    values(record_id,a,actor,now()+interval '1 day'),(outside,a,actor,now()+interval '1 day'),
      (expired,a,actor,now()-interval '1 day');
  insert into cali_workspace.profiles(id,role,active) values(other_admin,'admin',true);
  update public.mapa_respostas set d1_rh_hoje=2,d1_processos=4,
    d2_valores=5,d3_indicadores=1,d4_colaboradores=3 where id=record_id;
  insert into public.mapa_sessoes_resumo values
    (journey,now()-interval '25 minutes',now()-interval '20 minutes',2,true,false,1,'qa.example.invalid','desktop'),
    (ignored,now(),now(),7,true,true,0,null,'mobile');
  insert into cali_session_guard.phase4_mapa_journey_scope values(journey,a,actor,now()+interval '10 minutes');
  set local role authenticated;
  result:=cali_workspace.v2_list_pilot_mapa_journeys(a,1);
  assert result->>'total'='1' and result#>>'{entries,0,status}'='abandoned';
  assert result#>>'{entries,0,step}'='2' and result#>>'{entries,0,copies}'='1';
  assert strpos(result::text,journey::text)=0;
  assert cali_workspace.v2_list_pilot_mapa_journeys(b,1)->>'total'='0';
  result:=cali_workspace.v2_read_pilot_mapa_report(a,record_id);
  assert result->'dimensions'='[6,10,2,6]'::jsonb and (result->>'score')::numeric=6.4;
  assert result->'subscores'='null'::jsonb and result->>'version'='1';
  assert result::text not like '%@example.invalid%';
  assert cali_workspace.v2_read_pilot_mapa_report(b,record_id) is null;
  assert cali_workspace.v2_read_pilot_mapa_report(a,expired) is null;
  assert cali_workspace.v2_read_pilot_mapa_report(a,outside) is null;
  reset role;
  update public.mapa_respostas set diagnostico_v2='{
    "version":2,
    "d1":{"processos":[1,3],"estrutura":[3],"governanca":[4]},
    "d2":{"comportamento":[5],"valores":{"cultura_decisao":4},"desenvolvimento":[3]},
    "d3":{"indicadores":[2],"decisao":[3],"tecnologia":[1]},
    "d4":{"tamanho":[5],"vinculos":{"gestao":4},"rotatividade":[3]}
  }' where id=record_id;
  set local role authenticated;
  result:=cali_workspace.v2_read_pilot_mapa_report(a,record_id);
  assert result->'dimensions'='[6,8,4,8]'::jsonb and (result->>'score')::numeric=6.7;
  assert result->'subscores'='[4,6,8,10,8,6,4,6,2,10,8,6]'::jsonb and result->>'version'='2';
  result:=cali_workspace.v2_list_pilot_mapa(a,1);
  assert result->>'total'='1' and result#>>'{entries,0,id}'=record_id::text;
  assert result::text not like '%@example.invalid%';
  assert cali_workspace.v2_list_pilot_mapa(b,1)->>'total'='0';
  assert cali_workspace.v2_review_pilot_mapa(a,record_id,0,'em_andamento','Parecer de teste')=record_id;
  assert cali_workspace.v2_review_pilot_mapa(a,record_id,0,'em_andamento','Parecer de teste')=record_id;
  expected_report:=cali_workspace.v2_read_pilot_mapa_report(a,record_id);
  email_job:=(cali_workspace.v2_prepare_pilot_mapa_email(a,record_id,expected_report,request_id,recipients)->>'id')::uuid;
  assert cali_workspace.v2_prepare_pilot_mapa_email(a,record_id,expected_report,request_id,recipients)->>'id'=email_job::text;
  begin
    perform cali_workspace.v2_prepare_pilot_mapa_email(a,record_id,expected_report-'opinion',request_id,recipients);
    raise exception 'Relatório obsoleto enviado';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_prepare_pilot_mapa_email(b,record_id,expected_report,request_id,recipients);
    raise exception 'Envio cruzado permitido';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('authenticated','cali_workspace.v2_record_pilot_mapa_email(uuid,uuid)','execute');
  reset role;
  update cali_session_guard.phase4_mapa_email set created_at=now()-interval '11 minutes' where id=email_job;
  set local role authenticated;
  begin
    perform cali_workspace.v2_prepare_pilot_mapa_email(a,record_id,expected_report,request_id,recipients);
    raise exception 'Envio incerto reaberto fora da janela';
  exception when invalid_parameter_value then null; end;
  reset role;
  set local role service_role;
  perform cali_workspace.v2_record_pilot_mapa_email(email_job,receipt);
  perform cali_workspace.v2_record_pilot_mapa_email(email_job,receipt);
  reset role;
  set local role authenticated;
  assert cali_workspace.v2_prepare_pilot_mapa_email(a,record_id,expected_report,request_id,recipients)->>'sent'='true';
  resend_job:=(cali_workspace.v2_prepare_pilot_mapa_email(
    a,record_id,expected_report,resend_request_id,recipients)->>'id')::uuid;
  assert resend_job<>email_job;
  assert cali_workspace.v2_prepare_pilot_mapa_email(
    a,record_id,expected_report,resend_request_id,recipients)->>'id'=resend_job::text;
  begin
    perform cali_workspace.v2_prepare_pilot_mapa_email(
      a,record_id,expected_report,resend_request_id,'["other@example.test"]'::jsonb);
    raise exception 'Envio repetido aceitou destino diferente';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_review_pilot_mapa(a,record_id,0,'cancelado','Não deve salvar');
    raise exception 'Revisão obsoleta aceita';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_review_pilot_mapa(b,record_id,1,'cancelado',null);
    raise exception 'Escrita cruzada aceita';
  exception when insufficient_privilege then null; end;
  perform set_config('test.jwt',jsonb_build_object('sub',other_admin,'aal','aal2')::text,true);
  assert cali_workspace.v2_list_pilot_mapa(a,1)->>'total'='0';
  assert cali_workspace.v2_read_pilot_mapa_report(a,record_id) is null;
  begin
    perform cali_workspace.v2_review_pilot_mapa(a,record_id,1,'cancelado',null);
    raise exception 'Admin sem inscrição escreveu no Mapa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_mapa_report(a,record_id);
    raise exception 'Cliente leu relatório Mapa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_mapa_report(a,record_id);
    raise exception 'Admin sem MFA leu relatório Mapa';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_mapa_report(uuid,uuid)','execute');
  update public.mapa_respostas set diagnostico_v2='{"version":2}' where id=record_id;
  perform cali_workspace.fixture_as('admin');
  set local role authenticated;
  assert cali_workspace.v2_read_pilot_mapa_report(a,record_id) is null;
  reset role;
  assert (select observacoes from public.mapa_respostas where id=record_id)
    ='{"d1_obs":"preservar","parecer":"Parecer de teste"}'::jsonb;
  assert (select count(*) from cali_workspace.activity_log where entity_id=record_id and event_type='mapa_review_saved')=1;
  assert (select count(*) from cali_workspace.activity_log where entity_id=record_id and event_type='mapa_report_email_test')=1;
  assert (select status from public.mapa_respostas where id=record_id)='em_andamento';
end $$;
rollback;
drop function cali_workspace.v2_list_pilot_mapa_journeys(uuid,integer);
drop table cali_session_guard.phase4_mapa_journey_scope;
\ir rollback-mapa-email.sql
drop table cali_session_guard.phase4_mapa_email;
\ir rollback-mapa-report-read.sql
\ir rollback-mapa-operations.sql
\echo Fase 4E: Mapa com triagem, escopo, concorrência e recibo da devolutiva validados.
