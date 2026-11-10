\ir ../../../tests/fixtures/team/monthly-context.sql
\ir metrics.sql

do $$
declare
 company constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 other constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
 month date:=date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date;
 request uuid:=gen_random_uuid();
 written jsonb;
 correction jsonb;
 version timestamptz;
 fields jsonb:='{"planned_hours":100,"absence_medical_hours":4,"hour_bank_balance":-2,"approved_headcount":{"Operações":4}}';
begin
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000012"}',true);
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(other,month,null,fields,null,request);
  raise exception 'Cliente escreveu métricas de outra empresa';
 exception when insufficient_privilege then null; end;
 begin
  insert into cali_workspace.team_month_metrics(company_id,reference_month) values(company,month);
  raise exception 'Escrita direta legada passou no piloto';
 exception when insufficient_privilege then null; end;
 written:=cali_workspace.v2_write_pilot_team_metrics(company,month,null,fields,null,request);
 if written<>cali_workspace.v2_write_pilot_team_metrics(company,month,null,fields,null,request) then
  raise exception 'Replay não repetiu resultado'; end if;
 version:=(written->>'updatedAt')::timestamptz;
 update cali_workspace.team_month_metrics set planned_hours=900 where company_id=company and reference_month=month;
 if found or cali_workspace.v2_read_pilot_team_month(company,month)->'metrics'->>'planned_hours'<>'100' then
  raise exception 'UPDATE direto alterou o piloto'; end if;
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(company,month,version,fields,null,gen_random_uuid());
  raise exception 'Cliente corrigiu após gravado';
 exception when insufficient_privilege then null; end;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000015"}',true);
 if cali_workspace.v2_read_pilot_team_month(company,month)->'metrics'->>'planned_hours'<>'100' then
  raise exception 'Cliente equivalente não leu'; end if;
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(company,month,version,fields,null,gen_random_uuid());
  raise exception 'Segundo Cliente corrigiu';
 exception when insufficient_privilege then null; end;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal1"}',true);
 begin
  perform cali_workspace.v2_read_pilot_team_month(company,month);
  raise exception 'Admin sem MFA leu';
 exception when insufficient_privilege then null; end;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal2"}',true);
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(other,month,null,fields,'Sintético',gen_random_uuid());
  raise exception 'Admin fez primeiro lançamento';
 exception when insufficient_privilege then null; end;
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(company,month,version,fields,null,gen_random_uuid());
  raise exception 'Correção sem motivo passou';
 exception when invalid_parameter_value then null; end;
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(company,month,version,'{"planned_hours":-1}','Sintético',gen_random_uuid());
  raise exception 'Hora negativa passou';
 exception when invalid_parameter_value then null; end;
 correction:=cali_workspace.v2_write_pilot_team_metrics(company,month,version,'{"planned_hours":120}','Correção sintética',gen_random_uuid());
 begin
  perform cali_workspace.v2_write_pilot_team_metrics(company,month,version,'{"planned_hours":130}','Versão obsoleta',gen_random_uuid());
  raise exception 'Preimagem obsoleta passou';
 exception when serialization_failure then null; end;
 if cali_workspace.v2_read_pilot_team_month(company,month)->'metrics'->>'absence_medical_hours'<>'4'
  or cali_workspace.v2_read_pilot_team_month(company,month)->'metrics'->>'absence_leave_hours' is not null
  or jsonb_array_length(cali_workspace.v2_read_pilot_team_month(company,month)->'events')<>2 then
  raise exception 'Omissão, nulos ou auditoria divergentes'; end if;
 perform set_config('test.live','false',true);
 begin
  perform cali_workspace.v2_read_pilot_team_month(company,month);
  raise exception 'Sessão cortada leu';
 exception when insufficient_privilege then null; end;
 perform set_config('test.live','true',true);
 perform set_config('test.terms','false',true);
 begin
  perform cali_workspace.v2_read_pilot_team_month(company,month);
  raise exception 'Sem aceite leu';
 exception when insufficient_privilege then null; end;
 reset role;
 if (select count(*) from cali_session_guard.team_month_events)<>2 or not exists(
  select 1 from cali_session_guard.team_month_events where before_state->>'planned_hours'='100' and after_state->>'planned_hours'='120'
 ) then raise exception 'Histórico perdeu preimagem'; end if;
end $$;
-- Fora do piloto, a policy adicional mantém a superfície preexistente.
do $$
begin
 set local role authenticated;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000013"}',true);
 insert into cali_workspace.team_month_metrics(company_id,reference_month)
 values('00000000-0000-4000-8000-000000000003',date_trunc('month',now())::date);
end $$;
\if :{?cali_keep_monthly_metrics}
\else
\ir rollback-metrics.sql
\endif
