-- Ajusta só o filtro de colisão nas duas confirmações existentes do CALI MAPA.
begin;
set local lock_timeout='5s';
do $$
declare
  routine regprocedure;
  definition text;
  previous_clause text;
  fixed_clause text;
begin
  foreach routine in array array[
    'cali_workspace.admin_confirm_extra_visit_v1(uuid,integer)'::regprocedure,
    'cali_workspace.client_accept_extra_visit_proposal_v1(uuid,integer)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(routine);
    previous_clause:=case when routine='cali_workspace.admin_confirm_extra_visit_v1(uuid,integer)'::regprocedure
      then 'where company_id=v_req.company_id and starts_at<v_end and ends_at>v_start'
      else 'where e.company_id=v_req.company_id and e.starts_at<v_end and e.ends_at>v_start' end;
    fixed_clause:=previous_clause||case when routine='cali_workspace.admin_confirm_extra_visit_v1(uuid,integer)'::regprocedure
      then ' and cancelled_at is null' else ' and e.cancelled_at is null' end;
    if strpos(definition,fixed_clause)>0 then continue; end if;
    if (length(definition)-length(replace(definition,previous_clause,'')))/length(previous_clause)<>1 then
      raise exception 'Cláusula de colisão inesperada em %',routine;
    end if;
    execute replace(definition,previous_clause,fixed_clause);
  end loop;
end;
$$;
commit;
