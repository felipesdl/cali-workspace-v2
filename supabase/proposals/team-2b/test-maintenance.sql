\set cali_keep_team_directory 1
\ir test-directory.sql
\unset cali_keep_team_directory
\ir maintenance.sql
do $$
declare
  company constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  ca constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  current_month date := date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  record jsonb;
  written jsonb;
  qa_new uuid;
  version timestamptz;
  payload jsonb := '{"fields":{"employee_code":"QA-NEW","full_name":"Nova pessoa sintética","job_title":"Especialista",
    "department":"Operações","admission_date":"2026-10-01","work_phone":"000"},"expectedAt":null}';
begin
  set local role authenticated;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  begin
    perform cali_workspace.v2_save_pilot_team(ca,current_month,jsonb_build_array(payload));
    raise exception 'Cliente escreveu em outra empresa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_save_pilot_team(company,current_month,jsonb_build_array(payload,payload));
    raise exception 'Lote duplicado aceito';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform cali_workspace.v2_save_pilot_team(company,current_month,jsonb_build_array(
      payload,jsonb_set(jsonb_set(payload,'{fields,employee_code}','"QA-BAD"'),'{fields,manager_code}','"QA-A"')));
    raise exception 'Gestor de outra empresa aceito';
  exception when invalid_parameter_value then null;
  end;
  if (cali_workspace.v2_list_pilot_team(company,'QA-NEW','all',1)->>'total') <> '0' then
    raise exception 'Lote inválido persistiu uma ficha';
  end if;
  written := cali_workspace.v2_save_pilot_team(company,current_month,jsonb_build_array(payload));
  qa_new := (written->'ids'->>0)::uuid;
  record := cali_workspace.v2_read_pilot_team_member(company,qa_new);
  version := (record->>'updated_at')::timestamptz;
  if (record->>'work_phone') <> '000' or (written->>'added') <> '1' then
    raise exception 'Cadastro não persistiu';
  end if;
  begin
    perform cali_workspace.v2_save_pilot_team(company,current_month,jsonb_build_array(payload));
    raise exception 'Nova ficha sobrescrita sem preimagem';
  exception when serialization_failure then null;
  end;
  perform cali_workspace.v2_save_pilot_team(company,current_month,jsonb_build_array(jsonb_build_object(
    'fields',jsonb_build_object('employee_code','QA-NEW','department','Produto'),
    'expectedAt',version)));
  record := cali_workspace.v2_read_pilot_team_member(company,qa_new);
  if record->>'department' <> 'Produto' or record->>'work_phone' <> '000' then
    raise exception 'Alteração parcial apagou campo omitido';
  end if;
  perform cali_workspace.v2_archive_pilot_team_member(company,qa_new,current_month,(record->>'updated_at')::timestamptz);
  if (cali_workspace.v2_list_pilot_team(company,'QA-NEW','all',1)->>'total') <> '0'
    or (cali_workspace.v2_list_pilot_team(company,'QA-NEW','archived',1)->>'total') <> '1'
    or (cali_workspace.v2_read_pilot_team_member(company,qa_new)->>'status') <> 'active' then
    raise exception 'Arquivar virou desligamento ou eliminou a ficha';
  end if;
  reset role;
  if (select count(*) from cali_workspace.team_changes where member_id=qa_new) <> 3
    or exists (select 1 from cali_workspace.team_changes where member_id=qa_new and actor_user_id<>'00000000-0000-4000-8000-000000000012')
    or not exists (select 1 from cali_workspace.team_members where company_id=company and employee_code='QA-B' and archived_at is null)
  then raise exception 'Histórico ou ausência divergente'; end if;
end;
$$;
\if :{?cali_keep_team_maintenance}
\else
\ir rollback-maintenance.sql
\ir rollback-directory.sql
\endif
