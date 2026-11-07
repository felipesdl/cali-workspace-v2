-- Preserva assinatura, dono, GRANTs e comportamento de pausa/retomada do legado.
-- PERFORM ... INTO tenta criar uma tabela, em vez de atribuir a previsão à variável.
begin;
set local lock_timeout = '5s';
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.admin_set_project_lifecycle_v44(uuid,text,text,uuid,text,date)'::regprocedure);
  before_line constant text := 'perform cali_workspace.refresh_project_forecast(p_project_id) into v_forecast;';
  after_line constant text := 'select cali_workspace.refresh_project_forecast(p_project_id) into v_forecast;';
begin
  if length(definition)-length(replace(definition,before_line,''))<>length(before_line) then
    raise exception 'Reconciliar a função de ciclo antes da correção de forecast.';
  end if;
  execute replace(definition,before_line,after_line);
end $$;
commit;
