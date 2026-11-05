\set cali_keep_team_private 1
\ir test-private-fields.sql
\unset cali_keep_team_private
\ir import.sql
\ir history.sql

do $$
declare
  company constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member constant uuid := '10000000-0000-4000-8000-000000000002';
  current_month date := date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  public_rows jsonb;
  private_rows jsonb;
  preview jsonb;
  history jsonb;
begin
  insert into cali_workspace.team_months values(company,current_month);
  insert into cali_workspace.team_month_snapshots
    values(company,current_month,member,'Operações',null,'Analista','active','2026-10-01',null);
  set local role authenticated;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  preview := cali_workspace.v2_preview_pilot_team_import(company,
    '[{"employee_code":"QA-B","department":"Produto"},{"employee_code":"QA-NEW"},{"employee_code":"QA-UNKNOWN","manager_code":"MISSING"}]');
  if preview->'rows'->0->>'kind' is distinct from 'changed'
    or preview->'rows'->1->>'kind' is distinct from 'reactivated'
    or preview->'rows'->2->>'kind' is distinct from 'new'
    or preview->'rows'->2->>'managerValid' is distinct from 'false'
    or preview->'rows'->0 ? 'salary' then raise exception 'Classificação ou escopo da prévia inválidos'; end if;
  preview := cali_workspace.v2_preview_pilot_team_import(company,
    '[{"employee_code":"QA-NEW"}]');
  if preview->>'absent' is distinct from '1' then
    raise exception 'Ausentes não foram informados';
  end if;
  preview := cali_workspace.v2_preview_pilot_team_import(company,
    '[{"employee_code":"QA-B","department":"Produto"}]');
  public_rows := jsonb_build_array(jsonb_build_object('fields','{"employee_code":"QA-B","department":"Produto"}'::jsonb,
    'expectedAt',preview->'rows'->0->'expectedAt'));
  private_rows := jsonb_build_array(jsonb_build_object('code','QA-B','declared',true,
    'fields','{"has_children":"yes"}'::jsonb,'expectedAt',null));
  begin
    perform cali_workspace.v2_confirm_pilot_team_import(company,current_month,public_rows,private_rows);
    raise exception 'Preimagem privada inválida foi aceita';
  exception when serialization_failure then null;
  end;
  if (cali_workspace.v2_read_pilot_team_member(company,member)->>'department') <> 'Operações' then
    raise exception 'Erro privado não reverteu escrita profissional';
  end if;
  private_rows := jsonb_set(private_rows,'{0,expectedAt}',preview->'rows'->0->'privateExpectedAt');
  perform cali_workspace.v2_confirm_pilot_team_import(company,current_month,public_rows,private_rows);
  if (cali_workspace.v2_read_pilot_team_private(company,member)->>'salary')::numeric <> 1000
    or (cali_workspace.v2_read_pilot_team_private(company,member)->>'has_children') <> 'yes' then
    raise exception 'Importação perdeu um dado privado omitido';
  end if;
  history := cali_workspace.v2_read_pilot_team_history(company,current_month,member,1);
  if history->'events'->0->>'kind' is distinct from 'transfer'
    or history->'events'->0 ? 'before_state'
    or history->'snapshots'->0->>'department' is distinct from 'Operações'
    or cali_workspace.v2_read_pilot_team_structure(company)->0->>'department' is distinct from 'Produto' then
    raise exception 'Histórico não preservou snapshot ou estrutura atual';
  end if;
end;
$$;
do $$
declare
  cb constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  member constant uuid := '10000000-0000-4000-8000-000000000002';
  b2 constant uuid := '00000000-0000-4000-8000-000000000018';
  session_id uuid := gen_random_uuid();
  invite_id uuid;
  proof uuid;
  accepted jsonb;
  professional jsonb;
  month date := date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into auth.users values (b2,'b-second@example.test');
  insert into cali_workspace.profiles (id,company_id,email,full_name,role,is_primary)
    values(b2,cb,'b-second@example.test','Segundo vínculo B','client',false);
  insert into cali_workspace.client_invites(company_id,email,full_name)
    values(cb,'b-second@example.test','Segundo vínculo B') returning id into invite_id;
  insert into cali_session_guard.pilot_accounts(company_id,profile_id,invite_id,recipient_email)
    values(cb,b2,invite_id,'b-second@example.test');
  proof := cali_session_guard.authorize_code(b2,clock_timestamp());
  insert into auth.sessions values(session_id,b2,clock_timestamp(),null);
  if proof is null or not cali_workspace.admit_workspace_session_v2(proof,session_id) then
    raise exception 'Segundo Cliente não admitido';
  end if;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',b2,'session_id',session_id)::text,true);
  accepted := cali_workspace.v2_read_terms_state();
  perform cali_workspace.v2_accept_terms(accepted->>'version',accepted->>'contentHash');
  professional := cali_workspace.v2_read_pilot_team_member(cb,member);
  perform cali_workspace.v2_save_pilot_team(cb,month,jsonb_build_array(jsonb_build_object(
    'fields',jsonb_build_object('employee_code','QA-B','job_title','Liderança sintética'),
    'expectedAt',professional->'updated_at')));
  if (cali_workspace.v2_read_pilot_team_private(cb,member)->>'salary')::numeric is distinct from 1000 then
    raise exception 'Segundo Cliente não leu ficha privada autorizada';
  end if;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  perform cali_workspace.v2_revoke_pilot_invite(cb,invite_id);
  perform set_config('test.jwt',jsonb_build_object('sub',b2,'session_id',session_id)::text,true);
  begin
    perform cali_workspace.v2_read_pilot_team_private(cb,member);
    raise exception 'Segundo Cliente revogado ainda leu a ficha';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  if (cali_workspace.v2_read_pilot_team_member(cb,member)->>'job_title') is distinct from 'Liderança sintética' then
    raise exception 'Revogar o segundo Cliente afetou o primeiro';
  end if;
end;
$$;
\ir rollback-history.sql
\ir rollback-import.sql
\ir rollback-private-fields.sql
\ir rollback-maintenance.sql
\ir rollback-directory.sql
