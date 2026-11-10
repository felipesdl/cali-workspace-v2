begin;
do $$
declare
  company_a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  company_b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  month_start constant date := '2026-11-01';
  request uuid := gen_random_uuid();
  initial_version timestamptz;
  resumed_version timestamptz;
  payload jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  payload := cali_workspace.v2_read_pilot_hours(company_a,month_start,1);
  initial_version := (payload#>>'{capacityControl,version}')::timestamptz;
  assert payload#>>'{capacityHistory,paused}'='true';
  assert cali_workspace.v2_set_pilot_capacity_pause(company_a,month_start,request,initial_version,false)=company_a;
  assert cali_workspace.v2_set_pilot_capacity_pause(company_a,month_start,request,initial_version,false)=company_a;
  payload := cali_workspace.v2_read_pilot_hours(company_a,month_start,1);
  assert payload#>>'{capacityHistory,paused}'='false';
  resumed_version := (payload#>>'{capacityControl,version}')::timestamptz;
  begin
    perform cali_workspace.v2_set_pilot_capacity_pause(company_b,month_start,gen_random_uuid(),null,true);
    raise exception 'Pausa sem franquia excedida';
  exception when invalid_parameter_value then null; end;
  begin
    perform cali_workspace.v2_set_pilot_capacity_pause(company_a,month_start,gen_random_uuid(),initial_version,true);
    raise exception 'Estado antigo aceito';
  exception when serialization_failure then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_set_pilot_capacity_pause(company_a,month_start,gen_random_uuid(),resumed_version,true);
    raise exception 'Cliente registrou pausa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  reset role;
  insert into cali_workspace.hour_entries(id,company_id,work_date,minutes,description,client_visible)
    values(gen_random_uuid(),company_a,'2026-11-02',500,'Excedente sintético',false);
  set local role authenticated;
  assert cali_workspace.v2_set_pilot_capacity_pause(company_a,month_start,gen_random_uuid(),resumed_version,true)=company_a;
  perform cali_workspace.fixture_as('clientA');
  payload := cali_workspace.v2_read_pilot_hours(company_a,month_start,1);
  assert payload#>>'{capacityHistory,paused}'='true';
  assert payload->>'capacityControl' is null;
  assert cali_workspace.v2_read_pilot_hours(company_a,'2026-12-01',1)#>>'{capacityHistory,paused}' is distinct from 'true';
  reset role;
  assert (select count(*) from cali_workspace.activity_log where company_id=company_a
    and event_type in ('capacity_pause_recorded','capacity_pause_resumed'))=2;
end;
$$;
rollback;
