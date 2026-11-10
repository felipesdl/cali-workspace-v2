-- Contrato de exclusão conferido no catálogo, dependências de teste explícitas.
create function cali_workspace.is_admin() returns boolean language sql stable as $$
 select exists(select 1 from cali_workspace.profiles where id=auth.uid() and role='admin' and active)
$$;
create function cali_workspace.refresh_project_workstream_ranges(uuid) returns void language sql as $$ select $$;
create trigger fixture_project_touch before update on cali_workspace.projects
for each row execute function cali_workspace.fixture_report_touch();
create trigger fixture_front_touch before update on cali_workspace.project_workstreams
for each row execute function cali_workspace.fixture_report_touch();
create trigger fixture_delivery_touch before update on cali_workspace.deliverables
for each row execute function cali_workspace.fixture_report_touch();
CREATE OR REPLACE FUNCTION cali_workspace.admin_delete_project_workstream(p_workstream_id uuid, p_move_to_workstream_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'cali_workspace'
AS $function$
declare
  v_front cali_workspace.project_workstreams%rowtype;
  v_target cali_workspace.project_workstreams%rowtype;
  v_count integer:=0;
begin
  if not cali_workspace.is_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  select w.* into v_front from cali_workspace.project_workstreams w join cali_workspace.projects p on p.id=w.project_id where w.id=p_workstream_id and p.planning_status='draft';
  if v_front.id is null then raise exception 'A frente só pode ser excluída enquanto o projeto está em rascunho.'; end if;

  select count(*) into v_count from cali_workspace.deliverables d where d.project_id=v_front.project_id and d.status<>'cancelled' and (d.workstream_id=v_front.id or (d.workstream_id is null and lower(trim(coalesce(d.workstream,'')))=lower(trim(v_front.name))));

  if v_count>0 then
    if p_move_to_workstream_id is null then raise exception 'Esta frente possui % entregável(is). Escolha outra frente para transferi-los antes de excluir.',v_count; end if;
    select * into v_target from cali_workspace.project_workstreams where id=p_move_to_workstream_id and project_id=v_front.project_id and id<>v_front.id and status<>'cancelled';
    if v_target.id is null then raise exception 'Frente de destino inválida.'; end if;
    update cali_workspace.deliverables set workstream_id=v_target.id,workstream=v_target.name,updated_at=now() where project_id=v_front.project_id and status<>'cancelled' and (workstream_id=v_front.id or (workstream_id is null and lower(trim(coalesce(workstream,'')))=lower(trim(v_front.name))));
  end if;

  delete from cali_workspace.project_workstreams where id=v_front.id;
  perform cali_workspace.refresh_project_workstream_ranges(v_front.project_id);
  return jsonb_build_object('deleted_workstream_id',v_front.id,'moved_deliverables',v_count,'destination_workstream_id',p_move_to_workstream_id);
end;
$function$
;
