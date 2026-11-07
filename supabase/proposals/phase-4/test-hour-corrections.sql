-- Dependências mínimas do legado: efeito e evento de cada operação.
create function cali_workspace.edit_hour_entry_with_audit(uuid,date,integer,text,text,boolean,text)
returns jsonb language sql as $$
  with changed as (
    update cali_workspace.hour_entries set work_date=$2,minutes=$3,description=$4,category=$5,client_visible=$6
    where id=$1 returning company_id
  ), event as (
    insert into cali_workspace.activity_log
    select company_id,auth.uid(),'hours_entry_edited','hour_entry',$1,jsonb_build_object('reason',$7) from changed
  ) select jsonb_build_object('id',$1);
$$;
create function cali_workspace.delete_hour_entry_with_audit(uuid,text)
returns jsonb language sql as $$
  with removed as (
    delete from cali_workspace.hour_entries where id=$1 returning company_id
  ), event as (
    insert into cali_workspace.activity_log
    select company_id,auth.uid(),'hours_entry_deleted','hour_entry',$1,jsonb_build_object('reason',$2) from removed
  ) select jsonb_build_object('id',$1);
$$;
\ir hour-corrections.sql
begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  entry uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  removal uuid:=gen_random_uuid();
  version text;
  edited_version text;
  row_data jsonb;
begin
  insert into cali_workspace.hour_entries(id,company_id,work_date,minutes,description,category,internal_note,client_visible)
  values(entry,a,'2026-11-06',10,'Horas QA','Teste','Nota preservada',true);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  select item->>'editVersion' into version
  from jsonb_array_elements(cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1)->'entries') item
  where item->>'id'=entry::text;
  assert version is not null;
  begin
    perform cali_workspace.v2_correct_pilot_hour(b,request,entry,version,'delete','Remoção indevida');
    raise exception 'Acesso cruzado aceito';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_correct_pilot_hour(a,request,entry,version,'delete','Remoção sem MFA');
    raise exception 'Remoção sem MFA aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  select item into row_data from jsonb_array_elements(cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1)->'entries') item
  where item->>'id'=entry::text;
  assert row_data is not null and not row_data ?| array['editVersion','clientVisible','internal_note'];
  begin
    perform cali_workspace.v2_correct_pilot_hour(a,request,entry,version,'delete','Remoção pelo Cliente');
    raise exception 'Remoção pelo Cliente aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_correct_pilot_hour(a,request,entry,version,'delete','x');
    raise exception 'Justificativa insuficiente aceita';
  exception when invalid_parameter_value then null; end;
  assert cali_workspace.v2_correct_pilot_hour(a,request,entry,version,'edit','Correção QA','2026-11-06',12,'Horas corrigidas',false)=entry;
  assert cali_workspace.v2_correct_pilot_hour(a,request,entry,version,'edit','Correção QA','2026-11-06',12,'Horas corrigidas',false)=entry;
  begin
    perform cali_workspace.v2_correct_pilot_hour(a,removal,entry,version,'delete','Versão obsoleta');
    raise exception 'Exclusão sobre versão antiga aceita';
  exception when serialization_failure then null; end;
  select item into row_data from jsonb_array_elements(cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1)->'entries') item
  where item->>'id'=entry::text;
  assert row_data->>'minutes'='12' and row_data->>'internal_note'='Nota preservada'
    and row_data->>'clientVisible'='false' and row_data->>'category'='Teste';
  edited_version:=row_data->>'editVersion';
  assert cali_workspace.v2_correct_pilot_hour(a,removal,entry,edited_version,'delete','Remoção QA')=entry;
  assert cali_workspace.v2_correct_pilot_hour(a,removal,entry,edited_version,'delete','Remoção QA')=entry;
  reset role;
  assert not exists(select 1 from cali_workspace.hour_entries where id=entry);
  assert (select count(*) from cali_workspace.activity_log where entity_id=entry and event_type in ('hours_entry_edited','hours_entry_deleted'))=2;
  assert not has_function_privilege('anon','cali_workspace.v2_correct_pilot_hour(uuid,uuid,uuid,text,text,text,date,integer,text,boolean)','execute');
end $$;
rollback;
\ir rollback-hour-corrections.sql
\echo Fase 4B: edição e exclusão justificadas com versão, escopo e recibos.
