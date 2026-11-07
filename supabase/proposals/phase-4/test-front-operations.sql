alter table cali_workspace.companies add column service_plan text;
alter table cali_workspace.front_catalog add column category text default 'addon',
  add column partner_core boolean default false,add column full_core boolean default false,
  add column partner_slot boolean default false,add column full_slot boolean default false,
  add column build_allowed boolean default false,add column active boolean default true,
  add column display_order smallint default 0;
alter table cali_workspace.company_fronts add primary key(id),
  add column activated_by_user_id uuid,add column ended_at timestamptz;

create function cali_workspace.fixture_validate_company_front() returns trigger language plpgsql as $$
begin
  if new.status='active' and exists(select 1 from cali_workspace.company_fronts f
    where f.company_id=new.company_id and f.status='active' and f.mode='build_assisted') then
    raise exception 'Limite de uma frente';
  end if;
  if new.status='ended' then new.ended_at:=clock_timestamp(); end if;
  return new;
end;
$$;
create trigger fixture_validate_company_front before insert or update on cali_workspace.company_fronts
for each row execute function cali_workspace.fixture_validate_company_front();

\ir front-operations.sql
begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  front_id uuid := gen_random_uuid();
begin
  update cali_workspace.companies set service_plan='build_essential' where id=b;
  update cali_workspace.front_catalog set build_allowed=true where code='F1';
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_pilot_front_options(a)->>'hasPlan'='false';
  assert cali_workspace.v2_list_pilot_front_options(b)#>>'{options,0,mode}'='build_assisted';
  begin
    perform cali_workspace.v2_activate_pilot_front(a,gen_random_uuid(),'F1','build_assisted','',current_date,null);
    raise exception 'Ativação sem plano';
  exception when sqlstate 'P4F01' then null; end;
  assert cali_workspace.v2_activate_pilot_front(b,front_id,'F1','build_assisted','Escopo B',current_date,null)=front_id;
  assert cali_workspace.v2_activate_pilot_front(b,front_id,'F1','build_assisted','Escopo B',current_date,null)=front_id;
  begin
    perform cali_workspace.v2_activate_pilot_front(b,gen_random_uuid(),'F1','build_assisted','Escopo B',current_date,null);
    raise exception 'Exceção esperada: limite de uma frente';
  exception when raise_exception then
    if sqlerrm<>'Limite de uma frente' then raise; end if;
  end;
  begin
    perform cali_workspace.v2_end_pilot_front(a,front_id);
    raise exception 'Encerramento cruzado';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_read_pilot_catalog(b,'fronts',null,1)#>>'{entries,0,frontTerms,scope}'='Escopo B';
  begin
    perform cali_workspace.v2_end_pilot_front(b,front_id);
    raise exception 'Cliente encerrou frente';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_end_pilot_front(b,front_id)=front_id;
  assert cali_workspace.v2_end_pilot_front(b,front_id)=front_id;
  assert cali_workspace.v2_read_pilot_catalog(b,'fronts',null,1)#>>'{entries,0,status}'='ended';
  perform cali_workspace.fixture_as('clientB');
  assert cali_workspace.v2_read_pilot_catalog(b,'fronts',null,1)->>'total'='0';
  reset role;
  assert (select count(*) from cali_workspace.activity_log l where l.entity_id=front_id)=2;
  assert not exists(select 1 from cali_workspace.notifications n where n.entity_id=front_id);
end;
$$;
rollback;
