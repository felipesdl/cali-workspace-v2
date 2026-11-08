alter table cali_workspace.companies add column closed_at timestamptz, add column data_eliminated_at timestamptz;
create function cali_workspace.company_access_closed(uuid) returns boolean language sql stable as $$
  select exists(select 1 from cali_workspace.companies c where c.id=$1 and c.status in ('closed','blocked','archived'));
$$;
create function cali_workspace.company_elimination_ready(uuid) returns boolean language sql stable as $$
  select exists(select 1 from cali_workspace.companies c where c.id=$1 and c.status='closed'
    and c.closed_at<=now()-interval '45 days' and c.data_eliminated_at is null);
$$;
create function cali_workspace.admin_export_company_data(p_company_id uuid,p_recipient text)
returns jsonb language sql as $$
  select jsonb_build_object('company',jsonb_build_object('id',p_company_id),'recipient',p_recipient,'dados_restritos','{}'::jsonb);
$$;
create function cali_workspace.admin_company_storage_objects(p_company_id uuid)
returns table(bucket text,path text) language sql as $$
  select 'test'::text,p_company_id::text||'/synthetic.pdf';
$$;
\ir data-lifecycle-read.sql
\ir data-lifecycle-export.sql
begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  payload jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_data_lifecycle(a);
    raise exception 'Leitura permitida sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_data_lifecycle(a);
    raise exception 'Leitura administrativa permitida ao Cliente';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_export_pilot_company_data(a,'Representante QA')#>>'{company,id}'=a::text;
  assert cali_workspace.v2_export_pilot_company_data(a,'Representante QA')#>'{workspace_v2,forms}' is not null;
  assert cali_workspace.v2_preview_pilot_company_elimination(a)->>'eligible'='false';
  assert cali_workspace.v2_read_pilot_data_lifecycle(a)->>'status'='active';
  reset role;
  update cali_workspace.companies set status='archived' where id=a;
  update cali_workspace.companies set status='closed',closed_at=now()-interval '45 days' where id=b;
  set local role authenticated;
  payload:=cali_workspace.v2_read_pilot_data_lifecycle(a);
  assert payload->>'status'='archived' and payload->>'accessClosed'='true' and payload->>'waitingPeriodMet'='false';
  payload:=cali_workspace.v2_read_pilot_data_lifecycle(b);
  assert payload->>'companyId'=b::text and payload->>'waitingPeriodMet'='true';
  assert (select count(*) from jsonb_object_keys(payload))=6;
  reset role;
  set local role authenticated;
  assert cali_workspace.v2_preview_pilot_company_elimination(b)->>'legacyStorageObjects'='1';
  reset role;
  update cali_workspace.companies set data_eliminated_at=now() where id=b;
  set local role authenticated;
  assert cali_workspace.v2_read_pilot_data_lifecycle(b)->>'waitingPeriodMet'='false';
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_data_lifecycle(uuid)','execute');
end $$;
rollback;
drop function cali_workspace.v2_export_pilot_company_data(uuid,text);
drop function cali_workspace.v2_preview_pilot_company_elimination(uuid);
\ir rollback-data-lifecycle-read.sql
\echo Fase 4E: ciclo de dados projetado sem escrita e com guarda Admin.
