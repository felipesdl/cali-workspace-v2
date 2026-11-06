\ir ../../../tests/fixtures/phase4/read-context.sql
\ir read-projects.sql
\ir read-hours.sql
\ir read-catalogs.sql

do $$
begin
 assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_hours(uuid,date,integer)','EXECUTE');
 assert not has_function_privilege('service_role','cali_workspace.v2_read_pilot_catalog(uuid,text,date,integer)','EXECUTE');
end $$;

begin;
set local role authenticated;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 pa constant uuid := '10000000-0000-4000-8000-000000000001';
 pb constant uuid := '10000000-0000-4000-8000-000000000002';
 pd constant uuid := '10000000-0000-4000-8000-000000000003';
 payload jsonb;
 mod text;
begin
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000011","aal":"aal1"}',true);
 payload := cali_workspace.v2_list_pilot_projects(a,1);
 assert payload->>'total'='1' and payload#>>'{projects,0,name}'='Projeto A';
 assert cali_workspace.v2_list_pilot_projects(a,2)->'projects'='[]'::jsonb;
 assert cali_workspace.v2_read_pilot_project(a,pb,'deliverables',1) is null;
 assert cali_workspace.v2_read_pilot_project(a,pd,'deliverables',1) is null;
 payload := cali_workspace.v2_read_pilot_project(a,pa,'deliverables',1);
 assert payload#>>'{review,number}'='2' and payload#>>'{review,status}'='pending';
 assert payload#>>'{items,total}'='1' and payload#>>'{items,rows,0,name}'='Entrega pública';
 assert cali_workspace.v2_read_pilot_project(a,pa,'workstreams',1)#>>'{items,rows,0,name}'='Frente do projeto';
 begin
  perform cali_workspace.v2_list_pilot_projects(b,1);
  raise exception 'Projeto de outra empresa autorizado';
 exception when insufficient_privilege then null; end;
 payload := cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1);
 assert payload->>'total'='1' and payload->>'minutes'='30';
 assert not (payload#>'{entries,0}' ? 'internal_note');
 payload := cali_workspace.v2_read_pilot_hours(a,'2026-10-01',1);
 assert payload->>'visible'='false' and not (payload ? 'entries');
 foreach mod in array array['calendar','records','documents','notices','reports','fronts'] loop
  payload := cali_workspace.v2_read_pilot_catalog(a,mod,'2026-11-01',1);
  assert payload->>'total'=case when mod='calendar' then '2' else '1' end,mod;
  assert payload#>>'{entries,0,title}'=case mod when 'calendar' then 'Geral'
   when 'records' then 'Visível' when 'documents' then 'Publicado' when 'notices' then 'Geral'
   when 'reports' then 'Publicado' else 'Frente ativa' end,mod;
  assert not (payload#>'{entries,0}' ?| array['path','storage_path','url','internal_note']),mod;
  if mod='calendar' then
   assert payload#>>'{entries,1,title}'='Cruza início do mês';
  end if;
 end loop;
 perform set_config('test.terms','false',true);
 begin
  perform cali_workspace.v2_read_pilot_catalog(a,'reports',null,1);
  raise exception 'Leitura sem aceite autorizada';
 exception when insufficient_privilege then null; end;
 perform set_config('test.terms','true',true);
 perform set_config('test.live','false',true);
 begin
  perform cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1);
  raise exception 'Sessão revogada autorizada';
 exception when insufficient_privilege then null; end;
 perform set_config('test.live','true',true);
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal1"}',true);
 begin
  perform cali_workspace.v2_list_pilot_projects(a,1);
  raise exception 'Admin sem MFA autorizado';
 exception when insufficient_privilege then null; end;
 perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000014","aal":"aal2"}',true);
 assert cali_workspace.v2_list_pilot_projects(a,1)->>'total'='2';
 assert cali_workspace.v2_list_pilot_projects(b,1)->>'total'='1';
 payload := cali_workspace.v2_read_pilot_hours(a,'2026-11-01',1);
 assert payload->>'total'='3' and payload->>'minutes'='170' and payload#>>'{entries,1,internal_note}'='Nota interna';
 assert cali_workspace.v2_read_pilot_catalog(a,'notices',null,1)->>'total'='2';
 begin
  perform cali_workspace.v2_read_pilot_catalog(a,'calendar','2026-11-02',1);
  raise exception 'Período inválido autorizado';
 exception when invalid_parameter_value then null; end;
end $$;
rollback;

\ir rollback-read.sql
do $$
begin
 assert to_regprocedure('cali_workspace.v2_read_pilot_project(uuid,uuid,text,integer)') is null;
 assert (select count(*) from cali_workspace.projects)=3;
 assert (select count(*) from cali_workspace.files)=3;
end $$;
\echo Fase 4: projeções, isolamento A/B, visibilidade, sessão e rollback validados.
