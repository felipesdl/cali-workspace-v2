alter table cali_workspace.notifications add column id uuid not null default gen_random_uuid(),
  add column created_at timestamptz not null default now();
\ir admin-daily-preview.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  old_company constant uuid:='00000000-0000-4000-8000-000000000003';
  instant constant timestamptz:='2026-11-07 22:00Z'; -- sábado, 19h Brasília
  receiver uuid;
  client uuid;
  payload jsonb;
begin
  select id into receiver from cali_workspace.profiles where role='admin' limit 1;
  select id into client from cali_workspace.profiles where role='client' and company_id=a limit 1;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,entity_type,entity_id,created_at,action_url)
  select a,receiver,'review_response','Ação '||i,repeat('x',181),'project',null,
    '2026-11-07 03:00Z'::timestamptz+i*interval '1 minute','/admin/projetos?section=deliverables'
  from generate_series(1,13) i;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,entity_type,entity_id,created_at)
  values (a,receiver,'review_response','Ação 1',repeat('x',181),'project',null,'2026-11-07 18:00Z'),
    (a,client,'deliverable_status','Entrega','Texto','deliverable',null,'2026-11-07 19:00Z'),
    (a,receiver,'record_message','Chat excluído','Texto','account_record',null,'2026-11-07 20:00Z'),
    (a,receiver,'staff_hours_edited','Staff excluído','Texto','hour_entry',null,'2026-11-07 20:00Z'),
    (a,receiver,'review_response','Anterior ao dia','Texto','project',null,'2026-11-07 02:59Z'),
    (a,receiver,'review_response','Após o corte','Texto','project',null,'2026-11-07 22:01Z'),
    (old_company,receiver,'review_response','Fora do piloto','Texto','project',null,'2026-11-07 19:00Z');
  insert into cali_workspace.hour_entries(id,company_id,work_date,minutes,description,client_visible)
  values(gen_random_uuid(),b,'2026-11-07',35,'Dia só com horas',false),
    (gen_random_uuid(),b,'2026-11-06',99,'Dia anterior',false),
    (gen_random_uuid(),old_company,'2026-11-07',99,'Fora do piloto',false);
  payload:=cali_session_guard.phase4_build_admin_daily_preview(instant);
  assert payload->>'day'='2026-11-07' and payload->>'clientTotal'='13' and payload->>'caliTotal'='1';
  assert payload->>'minutes'='35' and jsonb_array_length(payload->'companies')=2;
  assert payload#>>'{companies,0,id}'=a::text and payload#>>'{companies,1,id}'=b::text;
  assert jsonb_array_length(payload#>'{companies,0,client,items}')=12;
  assert length(payload#>>'{companies,0,client,items,0,excerpt}')=180;
  assert payload#>>'{companies,0,client,items,0,title}'='Ação 1';
  assert payload#>>'{companies,1,client,total}'='0';
  assert payload::text not like '%Chat excluído%' and payload::text not like '%Staff excluído%';
  assert cali_session_guard.phase4_build_admin_daily_preview('2026-11-08 22:00Z')->'companies'='[]'::jsonb;
  insert into cali_workspace.notifications(company_id,user_id,notification_type,title,body,created_at)
  select a,receiver,'review_response','Volume '||i,'Fixture','2026-11-09 04:00Z'::timestamptz
  from generate_series(1,2101) i;
  payload:=cali_session_guard.phase4_build_admin_daily_preview('2026-11-09 22:00Z');
  assert payload->>'clientTotal'='2101';
  assert jsonb_array_length(payload#>'{companies,0,client,items}')=12;
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_admin_daily_preview();
    raise exception 'Prévia abriu para Cliente';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_read_pilot_admin_daily_preview();
    raise exception 'Prévia abriu sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_read_pilot_admin_daily_preview() is not null;
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_admin_daily_preview()','execute');
end $$;
rollback;
\ir rollback-admin-daily-preview.sql
\echo Fase 4C: resumo Admin com corte Brasília, exclusões, totais e limite visual.
