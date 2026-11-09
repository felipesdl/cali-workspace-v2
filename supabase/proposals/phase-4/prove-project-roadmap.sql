-- Exercitar em uma transação a reverter após os contratos de Projetos.
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  project uuid:=gen_random_uuid();
  front uuid:=gen_random_uuid();
  early uuid:=gen_random_uuid();
  late uuid:=gen_random_uuid();
  result jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_project(a,project,'[TESTE V2] Cronograma QA','Objetivo fictício','2026-12-01');
  perform cali_workspace.v2_add_pilot_project_item(a,project,front,'workstream','Frente fictícia',null,null);
  perform cali_workspace.v2_add_pilot_project_item(a,project,late,'deliverable','Última',front,'2026-12-29 15:00');
  for i in 1..24 loop
    perform cali_workspace.v2_add_pilot_project_item(a,project,gen_random_uuid(),'deliverable','Marco '||i,front,'2026-12-15 15:00');
  end loop;
  perform cali_workspace.v2_add_pilot_project_item(a,project,early,'deliverable','Primeira',front,'2026-12-05 15:00');
  result:=cali_workspace.v2_read_pilot_project(a,project,'roadmap',1);
  assert result#>>'{items,total}'='26';
  assert jsonb_array_length(result#>'{items,rows}')=25;
  assert result#>>'{items,rows,0,id}'=early::text;
  assert result#>>'{items,rows,0,workstream_name}'='Frente fictícia';
  assert cali_workspace.v2_read_pilot_project(a,project,'roadmap',2)#>>'{items,rows,0,id}'=late::text;
  assert cali_workspace.v2_read_pilot_project(a,project,'deliverables',1)#>>'{items,rows,0,id}'=late::text;
  assert cali_workspace.v2_read_pilot_project(b,project,'roadmap',1) is null;
  reset role;
end $$;
