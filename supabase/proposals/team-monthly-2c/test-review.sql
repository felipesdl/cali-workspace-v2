\set cali_keep_monthly_metrics 1
\ir test-metrics.sql
\unset cali_keep_monthly_metrics
\ir ../../../tests/fixtures/team/vacancies.sql
\ir review.sql

do $$
declare
 cb constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 ca constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
 month date:=date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date;
 request uuid:=gen_random_uuid();
 state jsonb;
 payload jsonb;
 written jsonb;
 token text;
 before_state jsonb;
begin
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000012"}',true);
 begin
  perform cali_workspace.v2_read_pilot_team_review(ca,month);
  raise exception 'B leu revisão de A';
 exception when insufficient_privilege then null; end;
 state:=cali_workspace.v2_read_pilot_team_review(cb,month);
 token:=state->>'token';
 payload:=jsonb_build_array(jsonb_build_object('vacancy_code','QA-VAGA','title','Vaga sintética','department','Operações','opened_on',month,'status','open','closed_on',null));
 begin
  perform cali_workspace.v2_confirm_pilot_team_month(cb,month,'obsoleto',payload,null,request);
  raise exception 'Token obsoleto confirmou';
 exception when serialization_failure then null; end;
 begin
  perform cali_workspace.v2_confirm_pilot_team_month(cb,month,token,payload||'[{"vacancy_code":"QA-INVALID"}]',null,request);
  raise exception 'Vaga inválida confirmou';
 exception when invalid_parameter_value then null; end;
 if (cali_workspace.v2_read_pilot_team_review(cb,month)->>'vacancyTotal')::integer<>0 then
  raise exception 'Falha parcial preservou uma vaga'; end if;
 written:=cali_workspace.v2_confirm_pilot_team_month(cb,month,token,payload,null,request);
 if written<>cali_workspace.v2_confirm_pilot_team_month(cb,month,token,payload,null,request) then
  raise exception 'Replay da confirmação duplicou efeitos'; end if;
 if cali_workspace.v2_read_pilot_team_month(cb,month)->'review'->>'revision'<>'1'
  or cali_workspace.v2_read_pilot_team_review(cb,month)->'series'->0->>'active'<>'1' then
  raise exception 'Confirmação ou quadro divergente'; end if;
 perform cali_workspace.v2_save_pilot_team(cb,month,jsonb_build_array(jsonb_build_object(
  'fields','{"employee_code":"QA-B","job_title":"Coordenação QA"}'::jsonb,
  'expectedAt',cali_workspace.v2_read_pilot_team_member(cb,'10000000-0000-4000-8000-000000000002')->'updated_at')));
 begin
  perform cali_workspace.v2_confirm_pilot_team_month(cb,month,token,'[]',null,gen_random_uuid());
  raise exception 'Mudança de cadastro não invalidou revisão';
 exception when serialization_failure then null; end;
 -- Outro Cliente equivalente confirma e mantém vagas omitidas.
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000015"}',true);
 state:=cali_workspace.v2_read_pilot_team_review(cb,month);
 perform cali_workspace.v2_confirm_pilot_team_month(cb,month,state->>'token','[]',null,gen_random_uuid());
 if cali_workspace.v2_read_pilot_team_month(cb,month)->'review'->>'revision'<>'2'
  or cali_workspace.v2_read_pilot_team_review(cb,month)->>'vacancyTotal'<>'1' then
  raise exception 'Revisão equivalente ou vaga omitida divergente'; end if;
 reset role;
 select e.before_state into before_state from cali_session_guard.team_month_events e
 where company_id=cb and reference_month=month and domain='review' and revision=2;
 if before_state->'snapshots'->0->>'job_title'<>'Analista'
  or not exists(select 1 from cali_workspace.team_month_snapshots where company_id=cb and job_title='Coordenação QA')
  or (select count(*) from cali_workspace.team_vacancy_events where company_id=cb)<>1 then
  raise exception 'Histórico de snapshot ou evento de vaga perdido'; end if;
 -- Confirmação vazia da outra empresa é explícita e válida.
 update cali_workspace.team_members set archived_at=clock_timestamp() where company_id=ca;
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000011"}',true);
 state:=cali_workspace.v2_read_pilot_team_review(ca,month);
 perform cali_workspace.v2_confirm_pilot_team_month(ca,month,state->>'token','[]',null,gen_random_uuid());
 if cali_workspace.v2_read_pilot_team_review(ca,month)->'series'->0->>'active'<>'0'
  or cali_workspace.v2_read_pilot_team_month(ca,month)->'review'->>'revision'<>'1' then
  raise exception 'Mês vazio não confirmado'; end if;
end $$;
-- Treze referências históricas expõem somente a janela de doze solicitada.
do $$
declare
 cb constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 month date:=date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date;
 state jsonb;
begin
 insert into cali_workspace.team_months(company_id,reference_month)
 select cb,day::date from generate_series(month-interval '12 months',month-interval '1 month',interval '1 month') day;
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000012"}',true);
 state:=cali_workspace.v2_read_pilot_team_review(cb,month);
 if jsonb_array_length(state->'series')<>12
  or state->'series'->0->>'reference_month'<>to_char(month-interval '11 months','YYYY-MM-DD') then
  raise exception 'Janela de doze referências divergente'; end if;
end $$;
-- Simula as policies permissivas legadas. O complemento não amplia permissões.
do $$
declare relation text;
begin
 foreach relation in array array['team_months','team_month_snapshots','team_month_reviews','team_vacancies','team_vacancy_events'] loop
  execute format('alter table cali_workspace.%I enable row level security',relation);
  execute format('grant select on cali_workspace.%I to authenticated',relation);
  execute format('create policy legacy_month_read on cali_workspace.%I for select to authenticated using(cali_workspace.can_access_company(company_id))',relation);
 end loop;
end;
$$;
\ir read.sql
do $$
declare relation text; visible integer;
begin
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000012"}',true);
 select count(*) into visible from cali_workspace.team_month_metrics;
 if visible<>1 then raise exception 'Leitura própria indisponível ou outra empresa visível'; end if;
 perform set_config('test.terms','false',true);
 foreach relation in array array['team_month_metrics','team_months','team_month_snapshots',
  'team_month_reviews','team_vacancies','team_vacancy_events'] loop
  execute format('select count(*) from cali_workspace.%I',relation) into visible;
  if visible<>0 then raise exception 'Leitura sem aceite em %',relation; end if;
 end loop;
 -- Fora do piloto, o complemento mantém a autorização legada.
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000013"}',true);
 select count(*) into visible from cali_workspace.team_month_metrics;
 if visible<>1 then raise exception 'Leitura legada fora do piloto alterada'; end if;
 perform set_config('test.terms','true',true);
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal1"}',true);
 if exists(select 1 from cali_workspace.team_month_metrics where company_id in
  ('9c5ab148-78b8-4410-9338-58c44222a5db','6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76')) then
  raise exception 'Admin sem MFA leu métricas do piloto'; end if;
end $$;
\ir rollback-read.sql
\ir rollback-review.sql
\ir rollback-metrics.sql
