-- FLOW-06. Subtarefas, conversa e dependências nas tabelas operacionais instaladas.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_pilot_delivery_collaboration(
  p_company_id uuid,p_project_id uuid,p_delivery_id uuid,p_request_id uuid,p_action text,p_fields jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  actor_role text := (select role::text from cali_workspace.profiles where id=actor and active);
  admin boolean := actor_role='admin';
  delivery cali_workspace.deliverables%rowtype;
  task cali_workspace.deliverable_tasks%rowtype;
  task_id uuid := (p_fields->>'task')::uuid;
  expected timestamptz := (p_fields->>'expected')::timestamptz;
  item_id uuid := (p_fields->>'item')::uuid;
  note text := nullif(btrim(p_fields->>'note'),'');
  clean_title text := nullif(btrim(p_fields->>'title'),'');
  next_status text := p_fields->>'status';
  due timestamptz := (p_fields->>'due')::timestamp at time zone 'America/Sao_Paulo';
  due_day date := (p_fields->>'day')::date;
  task_complexity text := p_fields->>'complexity';
  assignee uuid := (p_fields->>'assignee')::uuid;
  estimate integer := coalesce((p_fields->>'estimatedMinutes')::integer,0);
  visible boolean := coalesce((p_fields->>'visible')::boolean,false);
  internal boolean := coalesce((p_fields->>'internal')::boolean,false);
  cause text := p_fields->>'cause';
  position integer;
  signature bytea;
  result uuid;
  timer_id uuid;
  changed_at timestamptz;
begin
  if p_action is null or p_action not in ('task-save','task-status','task-approve','task-adjust',
    'message','dependency-create','dependency-state','deadline') or p_fields is null
    or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>20000 then
    raise exception using errcode='22023',message='Revise os dados da operação.';
  end if;
  if actor_role is null or actor_role not in ('admin','client')
    or (p_action in ('task-approve','task-adjust') and admin)
    or (p_action not in ('task-approve','task-adjust','message') and not admin)
    or (internal and not admin) then
    raise exception using errcode='42501',message='Operação indisponível para este perfil.';
  end if;
  signature := sha256(convert_to(jsonb_build_array(p_project_id,p_delivery_id,p_action,p_fields)::text,'UTF8'));
  result := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result is not null then return result; end if;

  perform 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
    and p.planning_status in ('active','rebriefing') and p.execution_status='normal' for update;
  if not found then raise exception using errcode='42501',message='Projeto indisponível para execução.'; end if;
  select * into delivery from cali_workspace.deliverables d where d.id=p_delivery_id
    and d.company_id=p_company_id and d.project_id=p_project_id and d.execution_status='normal' for update;
  if not found or delivery.status in ('approved','cancelled')
    or (not admin and not cali_workspace.client_can_view_deliverable(p_delivery_id)) then
    raise exception using errcode='42501',message='Entregável indisponível para esta ação.';
  end if;
  if task_id is not null then
    select * into task from cali_workspace.deliverable_tasks t where t.id=task_id
      and t.company_id=p_company_id and t.deliverable_id=p_delivery_id for update;
    if not found or (not admin and not task.client_visible) then
      raise exception using errcode='42501',message='Subtarefa indisponível.';
    end if;
    if task.status in ('approved','done','cancelled') then
      raise exception using errcode='40001',message='A subtarefa já foi encerrada.';
    end if;
    if p_action<>'message' and task.updated_at is distinct from expected then
      raise exception using errcode='40001',message='A subtarefa mudou. Recarregue o projeto.';
    end if;
  end if;

  case p_action
    when 'task-save' then
      if coalesce(length(clean_title),0) not between 2 and 200 or length(note)>8000
        or estimate not between 0 and 100000 or (due is not null and not isfinite(due))
        or (due is not null and delivery.due_at is not null and due>delivery.due_at)
        or (task_complexity is not null and task_complexity not in ('MC1','MC2','MC3'))
        or (assignee is not null and (task_id is null or assignee is distinct from task.assigned_user_id)
          and not exists(select 1 from cali_workspace.profiles
          where id=assignee and active and role::text='admin')) then
        raise exception using errcode='22023',message='Revise prazo, título, complexidade e responsável.';
      end if;
      if task_id is null then
        select coalesce(max(sort_order),0)+1 into position from cali_workspace.deliverable_tasks where deliverable_id=p_delivery_id;
        insert into cali_workspace.deliverable_tasks(id,company_id,deliverable_id,title,description,due_at,
          client_visible,sort_order,created_by,estimated_minutes,complexity,assigned_user_id)
        values(p_request_id,p_company_id,p_delivery_id,clean_title,note,due,visible,position,actor,estimate,task_complexity,assignee)
        returning id into result;
      else
        if task.status='client_review' then raise exception using errcode='40001',message='Subtarefa está em revisão Cliente.'; end if;
        update cali_workspace.deliverable_tasks set title=clean_title,description=note,due_at=due,
          client_visible=visible,estimated_minutes=estimate,complexity=task_complexity,assigned_user_id=assignee
        where id=task_id;
        result:=task_id;
      end if;
    when 'task-status' then
      if task_id is null or next_status is null or next_status not in ('todo','doing','standby','internal_review','client_review','done','cancelled')
        or next_status=task.status or (next_status='client_review' and (not task.client_visible or not delivery.client_visible)) then
        raise exception using errcode='22023',message='A situação exige uma subtarefa visível e disponível.';
      end if;
      changed_at:=clock_timestamp();
      if next_status in ('done','cancelled') then
        for timer_id in select id from cali_workspace.work_timers where company_id=p_company_id
          and work_timers.task_id=task.id and status in ('active','paused') for update
        loop
          perform cali_workspace.close_timer_session_at(timer_id,changed_at,'timer_closed_by_task_completion',actor);
        end loop;
      end if;
      update cali_workspace.deliverable_tasks set status=next_status,
        started_at=case when next_status='doing' then coalesce(started_at,changed_at) else started_at end,
        completed_at=case when next_status='done' then changed_at end,
        work_closed_at=case when next_status in ('done','cancelled') then changed_at end,
        work_close_reason=case next_status when 'done' then 'admin_finalized' when 'cancelled' then 'cancelled' end,
        work_closed_by=case when next_status in ('done','cancelled') then actor end where id=task_id;
      result:=task_id;
    when 'task-approve' then
      if task_id is null or task.status<>'client_review' then
        raise exception using errcode='40001',message='Subtarefa não está em revisão.';
      end if;
      perform cali_workspace.client_approve_task(task_id);
      result:=task_id;
    when 'task-adjust' then
      if task_id is null or task.status<>'client_review' then
        raise exception using errcode='40001',message='Subtarefa não está em revisão.';
      end if;
      if coalesce(task.adjustment_count,0)>=2 or coalesce(length(note),0) not between 10 and 4000 then
        raise exception using errcode='22023',message='Descreva o ajuste. O limite é de dois pedidos por subtarefa.';
      end if;
      perform cali_workspace.client_request_task_adjustment(task_id,note);
      result:=task_id;
    when 'message' then
      if coalesce(length(note),0) not between 1 and 5000
        or (not internal and (not delivery.client_visible or (task_id is not null and not task.client_visible))) then
        raise exception using errcode='22023',message='Conversa indisponível ou mensagem inválida.';
      end if;
      if task_id is null then
        insert into cali_workspace.comments(id,company_id,target_type,target_id,author_user_id,body,client_visible,source_actor)
        values(p_request_id,p_company_id,'deliverable',p_delivery_id,actor,note,not internal,actor_role);
      else
        insert into cali_workspace.task_messages(id,task_id,deliverable_id,company_id,author_user_id,author_role,body,client_visible)
        values(p_request_id,task.id,p_delivery_id,p_company_id,actor,actor_role,note,not internal);
      end if;
      result:=p_request_id;
    when 'dependency-create' then
      if coalesce(length(clean_title),0) not between 1 and 200 or due_day is null or not isfinite(due_day)
        or not delivery.client_visible then
        raise exception using errcode='22023',message='Informe uma pendência e o prazo para o Cliente.';
      end if;
      insert into cali_workspace.deliverable_client_dependencies(id,company_id,deliverable_id,title,due_date,created_by)
      values(p_request_id,p_company_id,p_delivery_id,clean_title,due_day,actor);
      result:=p_request_id;
    when 'dependency-state' then
      if next_status is null or next_status not in ('received','cancelled') then
        raise exception using errcode='22023',message='Situação da dependência inválida.';
      end if;
      update cali_workspace.deliverable_client_dependencies set status=next_status,
        received_at=case when next_status='received' then clock_timestamp() end
      where id=item_id and company_id=p_company_id and deliverable_id=p_delivery_id and status='pending';
      if not found then raise exception using errcode='40001',message='A dependência mudou.'; end if;
      result:=item_id;
    when 'deadline' then
      if delivery.updated_at is distinct from expected then
        raise exception using errcode='40001',message='O entregável mudou. Recarregue o projeto.';
      end if;
      if due is null or not isfinite(due) or due is not distinct from delivery.due_at
        or coalesce(length(note),0) not between 1 and 1000 or cause is null
        or cause not in ('client_dependency','scope','internal','other')
        or exists(select 1 from cali_workspace.deliverable_tasks t where t.deliverable_id=p_delivery_id
          and t.company_id=p_company_id and t.status not in ('cancelled','done','approved') and t.due_at>due) then
        raise exception using errcode='22023',message='Revise a nova data, motivo e os prazos das subtarefas.';
      end if;
      insert into cali_workspace.deliverable_due_revisions(id,company_id,deliverable_id,previous_due,new_due,cause,reason,created_by)
      values(p_request_id,p_company_id,p_delivery_id,delivery.due_at,due,cause,note,actor);
      update cali_workspace.deliverables set due_at=due,original_due_at=coalesce(original_due_at,delivery.due_at) where id=p_delivery_id;
      result:=p_request_id;
  end case;
  if p_action not in ('message','task-approve','task-adjust') then
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'delivery_'||replace(p_action,'-','_'),'deliverable',p_delivery_id,
      jsonb_build_object('item_id',result,'status',next_status));
  end if;
  insert into cali_session_guard.phase4_operation_receipts(actor_id,company_id,request_id,fingerprint,result_id)
  values(actor,p_company_id,p_request_id,signature,result);
  return result;
end;
$$;
revoke all on function cali_workspace.v2_pilot_delivery_collaboration(uuid,uuid,uuid,uuid,text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_delivery_collaboration(uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
create function cali_workspace.v2_pilot_project_item_lifecycle(
  p_company_id uuid,p_project_id uuid,p_item_id uuid,p_kind text,p_expected timestamptz,
  p_action text,p_note text,p_resume date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  execution text;
  version timestamptz;
begin
  if p_kind is null or p_kind not in ('front','deliverable') or p_action is null
    or p_action not in ('pause','suspend','cancel','resume') or p_expected is null
    or coalesce(length(btrim(p_note)),0) not between 4 and 4000
    or (p_resume is not null and not isfinite(p_resume)) then
    raise exception using errcode='22023',message='Confira os dados da execução.';
  end if;
  perform 1 from cali_workspace.projects where id=p_project_id and company_id=p_company_id
    and planning_status in ('active','rebriefing') and execution_status='normal' for update;
  if not found then raise exception using errcode='42501',message='Retome a execução do projeto primeiro.'; end if;
  if p_kind='front' then
    select execution_status,updated_at into execution,version from cali_workspace.project_workstreams
    where id=p_item_id and company_id=p_company_id and project_id=p_project_id
      and status not in ('completed','cancelled') for update;
  else
    select d.execution_status,d.updated_at into execution,version from cali_workspace.deliverables d
    where d.id=p_item_id and d.company_id=p_company_id and d.project_id=p_project_id
      and d.status not in ('approved','cancelled') and not exists(select 1 from cali_workspace.project_workstreams w
        where w.id=d.workstream_id and w.company_id=p_company_id and w.project_id=p_project_id and w.execution_status<>'normal') for update;
  end if;
  if not found then raise exception using errcode='42501',message='Item indisponível para execução.'; end if;
  if version is distinct from p_expected or execution='cancelled'
    or (p_action='resume' and execution not in ('paused','suspended'))
    or (p_action in ('pause','suspend') and execution<>'normal') then
    raise exception using errcode='40001',message='A execução mudou de estado.';
  end if;
  perform cali_workspace.admin_set_project_lifecycle_v44(p_project_id,p_action,p_kind,p_item_id,btrim(p_note),p_resume);
  return p_item_id;
end;
$$;
revoke all on function cali_workspace.v2_pilot_project_item_lifecycle(uuid,uuid,uuid,text,timestamptz,text,text,date)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_pilot_project_item_lifecycle(uuid,uuid,uuid,text,timestamptz,text,text,date)
  to authenticated;
notify pgrst,'reload schema';
commit;
