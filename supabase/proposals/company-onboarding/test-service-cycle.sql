\set cali_skip_pilot_pause 1
\ir ../hosted-access-pilot/test.sql
\unset cali_skip_pilot_pause
\ir ../hosted-access-pilot/individual-invites.sql
\ir transition-service-cycle.sql

do $$
declare
  ca constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  cb constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  planned uuid;
  existing uuid;
begin
  if has_function_privilege('anon','cali_workspace.v2_transition_service_cycle(uuid,uuid,text,text)','execute')
    or has_function_privilege('service_role','cali_workspace.v2_transition_service_cycle(uuid,uuid,text,text)','execute') then
    raise exception 'Transição exposta a papel indevido';
  end if;
  insert into cali_workspace.service_cycles (company_id,reference_month,contracted_hours,status)
    values (ca,'2025-01-01',null,'planned') returning id into planned;
  select id into strict existing from cali_workspace.service_cycles where company_id = ca and status = 'open';
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  set local role authenticated;
  begin
    perform cali_workspace.v2_transition_service_cycle(ca, existing, 'open', 'review');
    raise exception 'Cliente executou transição';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  perform cali_workspace.v2_prepare_pilot_company_draft(cb);
  begin
    perform cali_workspace.v2_transition_service_cycle(cb, existing, 'open', 'review');
    raise exception 'Ciclo aceito com empresa errada';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform cali_workspace.v2_transition_service_cycle(ca, existing, 'open', 'closed');
    raise exception 'Saltou a revisão';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform cali_workspace.v2_transition_service_cycle(ca, planned, 'planned', 'open');
    raise exception 'Abriu ciclo sem horas';
  exception when object_not_in_prerequisite_state then null;
  end;
  reset role;
  update cali_workspace.service_cycles set contracted_hours = 9.25 where id = planned;
  set local role authenticated;
  perform cali_workspace.v2_transition_service_cycle(ca, planned, 'planned', 'open');
  perform cali_workspace.v2_transition_service_cycle(ca, planned, 'open', 'review');
  perform cali_workspace.v2_transition_service_cycle(ca, planned, 'open', 'review');
  perform cali_workspace.v2_transition_service_cycle(ca, planned, 'review', 'closed');
  begin
    perform cali_workspace.v2_transition_service_cycle(ca, planned, 'open', 'review');
    raise exception 'Confirmação antiga sobrescreveu ciclo encerrado';
  exception when serialization_failure then null;
  end;
  begin
    perform cali_workspace.v2_transition_service_cycle(ca, planned, 'closed', 'open');
    raise exception 'Reabriu ciclo encerrado';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  if not exists (select 1 from cali_workspace.service_cycles where id = planned and
      status = 'closed' and contracted_hours = 9.25 and reference_month = '2025-01-01')
    or (select count(*) from cali_workspace.activity_log where entity_id = planned
        and event_type = 'v2_service_cycle_transitioned') <> 3
    or not exists (select 1 from cali_workspace.service_cycles where id = existing and status = 'open') then
    raise exception 'Transição perdeu dados, alterou outro ciclo ou duplicou auditoria';
  end if;
end;
$$;
