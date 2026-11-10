-- Restaura somente a linha legada; reintroduz a recusa na pausa/retomada.
begin;
set local lock_timeout = '5s';
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.admin_set_project_lifecycle_v44(uuid,text,text,uuid,text,date)'::regprocedure);
  fixed_line constant text := 'select cali_workspace.refresh_project_forecast(p_project_id) into v_forecast;';
  legacy_line constant text := 'perform cali_workspace.refresh_project_forecast(p_project_id) into v_forecast;';
begin
  if length(definition)-length(replace(definition,fixed_line,''))<>length(fixed_line) then
    raise exception 'Reconciliar a função de ciclo antes da reversão de forecast.';
  end if;
  execute replace(definition,fixed_line,legacy_line);
end $$;
commit;
