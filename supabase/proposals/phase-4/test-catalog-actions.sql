begin;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 form_id constant uuid := '40000000-0000-4000-8000-000000000001';
 notice_id uuid := gen_random_uuid();
 report_id uuid := gen_random_uuid();
 expected timestamptz;
begin
 set local role authenticated;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_publish_pilot_notice(a,notice_id,'comunicado','Aviso QA','Texto do piloto','2026-11-09');
 perform cali_workspace.v2_publish_pilot_notice(a,notice_id,'comunicado','Aviso QA','Texto do piloto','2026-11-09');
 perform cali_workspace.v2_set_pilot_form_state(a,form_id,'draft','open');
 assert cali_workspace.v2_list_pilot_forms(a,1)#>>'{0,status}'='open';
 assert cali_workspace.v2_list_pilot_forms(b,1)='[]'::jsonb;
 perform cali_workspace.v2_set_pilot_form_state(a,form_id,'open','closed');
 begin
  perform cali_workspace.v2_create_pilot_report_draft(a,report_id,'2026-11-01','Relatório QA','Resumo do período');
  raise exception 'Relatório criado sem prontidão';
 exception when serialization_failure then null; end;
 perform cali_workspace.v2_create_pilot_report_draft(a,report_id,'2026-10-01','Relatório QA','Resumo do período');
 expected := (select (e->>'reportUpdatedAt')::timestamptz from jsonb_array_elements(
  cali_workspace.v2_read_pilot_catalog(a,'reports',null,1)->'entries') e where e->>'id'=report_id::text);
 perform cali_workspace.v2_update_pilot_report_draft(a,report_id,expected,'review');
 begin
  perform cali_workspace.v2_update_pilot_report_draft(a,report_id,expected,'approve');
  raise exception 'Versão obsoleta aprovada';
 exception when serialization_failure then null; end;
 expected := (select (e->>'reportUpdatedAt')::timestamptz from jsonb_array_elements(
  cali_workspace.v2_read_pilot_catalog(a,'reports',null,1)->'entries') e where e->>'id'=report_id::text);
 perform cali_workspace.v2_update_pilot_report_draft(a,report_id,expected,'approve');

 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_read_pilot_catalog(a,'calendar','2026-11-01',1)::text like '%Aviso QA%';
 assert cali_workspace.v2_read_pilot_catalog(a,'reports',null,1)::text not like '%Relatório QA%';
 perform cali_workspace.v2_ack_pilot_notice(a,notice_id,true);
 assert exists(select 1 from jsonb_array_elements(cali_workspace.v2_read_pilot_catalog(a,'notices',null,1)->'entries') e
  where e->>'id'=notice_id::text and (e->>'noticeAcknowledged')::boolean);
 perform cali_workspace.v2_ack_pilot_notice(a,notice_id,false);
 perform cali_workspace.fixture_as('clientB');
 assert cali_workspace.v2_read_pilot_catalog(b,'notices',null,1)::text not like '%Aviso QA%';
 begin
  perform cali_workspace.v2_ack_pilot_notice(b,notice_id,true);
  raise exception 'Ciência de aviso de outro público';
 exception when insufficient_privilege then null; end;
 begin
  perform cali_workspace.v2_list_pilot_forms(b,1);
  raise exception 'Administração de forms disponível ao Cliente';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_set_pilot_notice_state(a,notice_id,'published','archived');
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_read_pilot_catalog(a,'calendar','2026-11-01',1)::text not like '%Aviso QA%';
 reset role;
 assert (select count(*) from cali_workspace.notifications where entity_id=notice_id)=1;
 assert (select source_snapshot->>'company' from cali_workspace.reports where id=report_id)=a::text;
end $$;
rollback;
\echo Fase 4: público e ciência do mural, rascunho/aprovação do relatório e estado de Forms validados no cenário local.
