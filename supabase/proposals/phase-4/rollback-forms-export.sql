begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_export_pilot_form_responses(uuid,uuid);
drop function if exists cali_workspace.v2_list_pilot_form_attachments(uuid,uuid,uuid);
do $$
declare
  definition text;
  list_previous constant text := 'as "publicTextLink",';
  exportable constant text := list_previous||
    ' (f.status in (''open'',''closed'') and (not exists(select 1 from cali_workspace.activity_log l where l.company_id=f.company_id and l.entity_type=''form'' and l.entity_id=f.id and l.event_type=''form_draft_created'') or (cali_session_guard.phase4_public_text_form(f.slug)).id is not distinct from f.id)) as "textExportAvailable",';
  triage_previous constant text := 'select r.id,r.respondent_name,r.submitted_at,r.stage,r.owner';
  triage_added constant text := triage_previous||
    ', exists(select 1 from cali_session_guard.phase4_form_pdfs p where p.response_id=r.id) as "pdfAvailable", exists(select 1 from jsonb_array_elements(f.questions) q where q->>''kind''=''file'' and r.answers ? (q->>''id'')) as "attachmentsAvailable"';
begin
  definition:=pg_get_functiondef('cali_workspace.v2_list_pilot_forms(uuid,integer)'::regprocedure);
  if strpos(definition,exportable)>0 then execute replace(definition,exportable,list_previous); end if;
  definition:=pg_get_functiondef('cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer)'::regprocedure);
  if strpos(definition,triage_added)>0 then execute replace(definition,triage_added,triage_previous); end if;
end;
$$;
notify pgrst,'reload schema';
commit;
