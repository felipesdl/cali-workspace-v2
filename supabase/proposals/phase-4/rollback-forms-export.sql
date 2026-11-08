begin;
set local lock_timeout='5s';
drop function if exists cali_workspace.v2_export_pilot_form_responses(uuid,uuid);
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_list_pilot_forms(uuid,integer)'::regprocedure);
  previous constant text := 'as "publicTextLink",';
  next constant text := previous||
    ' (f.status=''closed'' and (cali_session_guard.phase4_public_text_form(f.slug)).id is not null) as "textExportAvailable",';
begin
  if strpos(definition,next)>0 then execute replace(definition,next,previous); end if;
end;
$$;
notify pgrst,'reload schema';
commit;
