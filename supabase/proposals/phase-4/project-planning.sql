-- FLOW-05. Edição explícita antes do compartilhamento ou durante análise do ajuste.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_edit_pilot_plan(
  p_company_id uuid,p_project_id uuid,p_item_id uuid,p_kind text,p_expected timestamptz,
  p_action text,p_name text,p_description text,p_start date,p_due timestamp without time zone,
  p_workstream_id uuid,p_complexity text,p_position integer
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  plan cali_workspace.projects%rowtype;
  front cali_workspace.project_workstreams%rowtype;
  delivery cali_workspace.deliverables%rowtype;
  before_value jsonb;
  front_name text;
begin
  select * into plan from cali_workspace.projects
  where id=p_project_id and company_id=p_company_id for update;
  if not found or plan.planning_status not in ('draft','adjustment_requested') or plan.execution_status<>'normal' then
    raise exception using errcode='40001',message='O planejamento não está disponível para edição.';
  end if;
  if p_kind is null or p_kind not in ('project','workstream','deliverable')
    or p_action is null or p_action not in ('save','remove') or p_expected is null
    or (p_action='remove' and (plan.planning_status<>'draft' or p_kind='project')) then
    raise exception using errcode='22023',message='Ação indisponível para este planejamento.';
  end if;
  if p_action='save' and (
    coalesce(length(btrim(p_name)),0) not between 2 and 180 or length(p_description)>8000
    or (p_kind<>'project' and (p_position is null or p_position not between 1 and 100000))
    or (p_complexity is not null and p_complexity not in ('MC1','MC2','MC3'))
  ) then raise exception using errcode='22023',message='Revise nome, descrição, ordem e complexidade.'; end if;

  case p_kind
    when 'project' then
      if p_item_id is distinct from p_project_id or plan.updated_at is distinct from p_expected then
        raise exception using errcode='40001',message='O projeto mudou. Recarregue o planejamento.';
      end if;
      if p_start is null or not isfinite(p_start) then
        raise exception using errcode='22023',message='Informe o início planejado.';
      end if;
      before_value := jsonb_build_object('name',plan.name,'description',plan.description,'start',plan.start_date);
      update cali_workspace.projects set name=btrim(p_name),description=nullif(btrim(p_description),''),
        start_date=p_start,roadmap_start_date=p_start where id=p_project_id;
    when 'workstream' then
      select * into front from cali_workspace.project_workstreams where id=p_item_id
        and company_id=p_company_id and project_id=p_project_id and status<>'cancelled' for update;
      if not found or front.updated_at is distinct from p_expected then
        raise exception using errcode='40001',message='A frente mudou. Recarregue o planejamento.';
      end if;
      before_value := jsonb_build_object('name',front.name,'objective',front.objective,'position',front.sort_order);
      if p_action='remove' then
        -- O contrato legado exige destino quando existem entregáveis vinculados.
        perform cali_workspace.admin_delete_project_workstream(p_item_id,p_workstream_id);
      else
        update cali_workspace.deliverables set workstream=btrim(p_name)
        where project_id=p_project_id and company_id=p_company_id and status<>'cancelled'
          and (workstream_id=p_item_id or (workstream_id is null
            and lower(btrim(coalesce(workstream,'')))=lower(btrim(front.name))));
        update cali_workspace.project_workstreams set name=btrim(p_name),objective=nullif(btrim(p_description),''),
          sort_order=p_position where id=p_item_id;
      end if;
    when 'deliverable' then
      select * into delivery from cali_workspace.deliverables where id=p_item_id
        and company_id=p_company_id and project_id=p_project_id and status='not_started' for update;
      if not found or delivery.updated_at is distinct from p_expected then
        raise exception using errcode='40001',message='O entregável mudou. Recarregue o planejamento.';
      end if;
      before_value := jsonb_build_object('title',delivery.title,'description',delivery.description,'due',delivery.due_at,
        'workstreamId',delivery.workstream_id,'complexity',delivery.complexity,'position',delivery.sort_order);
      if p_action='remove' then
        -- Retirada preserva registro e trilha; compartilhar ignora os itens cancelados.
        update cali_workspace.deliverables set status='cancelled',client_visible=false,
          cancelled_at=clock_timestamp(),cancellation_reason='Retirado do rascunho' where id=p_item_id;
      else
        if p_due is null or not isfinite(p_due) then
          raise exception using errcode='22023',message='Informe o prazo do entregável.';
        end if;
        if p_workstream_id is not null then
          select name into front_name from cali_workspace.project_workstreams where id=p_workstream_id
            and company_id=p_company_id and project_id=p_project_id and status<>'cancelled';
          if not found then raise exception using errcode='42501',message='Frente indisponível.'; end if;
        end if;
        update cali_workspace.deliverables set title=btrim(p_name),description=nullif(btrim(p_description),''),
          due_at=p_due at time zone 'America/Sao_Paulo',workstream_id=p_workstream_id,workstream=front_name,
          complexity=p_complexity,sort_order=p_position where id=p_item_id;
      end if;
  end case;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'project_plan_'||p_action,p_kind,p_item_id,
    jsonb_build_object('project_id',p_project_id,'before',before_value,'name',p_name,'description',p_description,
      'start',p_start,'due',p_due,'workstreamId',p_workstream_id,'complexity',p_complexity,'position',p_position));
  return p_item_id;
end;
$$;
revoke all on function cali_workspace.v2_edit_pilot_plan(uuid,uuid,uuid,text,timestamptz,text,text,text,date,timestamp without time zone,uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_edit_pilot_plan(uuid,uuid,uuid,text,timestamptz,text,text,text,date,timestamp without time zone,uuid,text,integer)
  to authenticated;
notify pgrst,'reload schema';
commit;
