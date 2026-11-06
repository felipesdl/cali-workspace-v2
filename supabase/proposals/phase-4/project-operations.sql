-- FLOW-05/06. Preparado para homologação com transporte isolado.
begin;
set local lock_timeout = '5s';

create function cali_session_guard.require_phase4_role(p_company_id uuid, p_role text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
begin
  if not exists(select 1 from cali_workspace.profiles where id=actor and active and role::text=p_role) then
    raise exception using errcode='42501', message='Operação indisponível para este perfil.';
  end if;
  return actor;
end;
$$;

create function cali_workspace.v2_create_pilot_project(
  p_company_id uuid, p_project_id uuid, p_name text, p_description text, p_start date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  project_id uuid;
  clean_name text := nullif(btrim(p_name),'');
  clean_description text := nullif(btrim(p_description),'');
begin
  if p_project_id is null or clean_name is null or length(clean_name)>180
    or length(clean_description)>8000 or p_start is null or not isfinite(p_start) then
    raise exception using errcode='22023', message='Revise os dados do projeto.';
  end if;
  insert into cali_workspace.projects(id,company_id,name,description,start_date,roadmap_start_date,planning_status)
  values(p_project_id,p_company_id,clean_name,clean_description,p_start,p_start,'draft')
  on conflict(id) do nothing returning id into project_id;

  if project_id is null then
    if exists(select 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
      and p.name=clean_name and p.description is not distinct from clean_description and p.start_date=p_start) then
      return p_project_id;
    end if;
    raise exception using errcode='40001', message='Já existe um projeto com este identificador.';
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'project_draft_created','project',project_id,'{}'::jsonb);
  return project_id;
end;
$$;

create function cali_workspace.v2_add_pilot_project_item(
  p_company_id uuid, p_project_id uuid, p_item_id uuid, p_kind text, p_name text,
  p_workstream_id uuid, p_due timestamp without time zone
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  item_id uuid;
  position integer;
  clean_name text := nullif(btrim(p_name),'');
  workstream_name text;
  deadline timestamptz;
begin
  if p_item_id is null or clean_name is null or length(clean_name)>180
    or p_kind is null or p_kind not in ('workstream','deliverable') then
    raise exception using errcode='22023', message='Revise os dados do item.';
  end if;
  perform 1 from cali_workspace.projects p where p.id=p_project_id and p.company_id=p_company_id
    and p.planning_status='draft' for update;
  if not found then
    raise exception using errcode='40001', message='O projeto não está disponível como rascunho.';
  end if;
  if p_kind='workstream' then
    select coalesce(max(w.sort_order),0)+1 into position from cali_workspace.project_workstreams w
    where w.project_id=p_project_id;
    insert into cali_workspace.project_workstreams(id,company_id,project_id,name,sort_order,status)
    values(p_item_id,p_company_id,p_project_id,clean_name,position,'planned')
    on conflict(id) do nothing returning id into item_id;
    if item_id is null and exists(select 1 from cali_workspace.project_workstreams w where w.id=p_item_id
      and w.company_id=p_company_id and w.project_id=p_project_id and w.name=clean_name) then return p_item_id; end if;
  else
    if p_due is null or not isfinite(p_due) then
      raise exception using errcode='22023', message='Informe o prazo do entregável.';
    end if;
    if p_workstream_id is not null then
      select w.name into workstream_name from cali_workspace.project_workstreams w
      where w.id=p_workstream_id and w.company_id=p_company_id and w.project_id=p_project_id and w.status<>'cancelled';
      if not found then raise exception using errcode='42501', message='Frente indisponível.'; end if;
    end if;
    deadline := p_due at time zone 'America/Sao_Paulo';
    select coalesce(max(d.sort_order),0)+1 into position from cali_workspace.deliverables d
    where d.project_id=p_project_id;
    insert into cali_workspace.deliverables(id,company_id,project_id,workstream_id,workstream,title,due_at,sort_order,client_visible,status)
    values(p_item_id,p_company_id,p_project_id,p_workstream_id,workstream_name,clean_name,deadline,position,true,'not_started')
    on conflict(id) do nothing returning id into item_id;
    if item_id is null and exists(select 1 from cali_workspace.deliverables d where d.id=p_item_id
      and d.company_id=p_company_id and d.project_id=p_project_id and d.title=clean_name
      and d.workstream_id is not distinct from p_workstream_id and d.due_at=deadline) then
      return p_item_id;
    end if;
  end if;
  if item_id is null then raise exception using errcode='40001', message='Identificador de item já utilizado.'; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'project_draft_item_added',p_kind,item_id,jsonb_build_object('project_id',p_project_id));
  return item_id;
end;
$$;

create function cali_workspace.v2_share_pilot_schedule(p_company_id uuid, p_project_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  review_id uuid;
begin
  -- Os gatilhos legados validam a composição e abrem a revisão com o prazo instalado.
  update cali_workspace.projects set planning_status='client_review'
  where id=p_project_id and company_id=p_company_id and planning_status='draft';
  if not found then
    raise exception using errcode='40001', message='Atualize o projeto antes de compartilhar.';
  end if;
  select id into strict review_id from cali_workspace.project_review_requests
  where company_id=p_company_id and project_id=p_project_id and request_number=1 and status='pending';
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'project_schedule_shared','project',p_project_id,jsonb_build_object('review_id',review_id));
  return review_id;
end;
$$;

create function cali_workspace.v2_respond_pilot_schedule(
  p_company_id uuid, p_project_id uuid, p_review_id uuid, p_action text, p_note text,
  p_target_type text default null, p_target_id uuid default null, p_item_action text default null,
  p_requested_date date default null, p_swap_id uuid default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid;
  planning text;
  review_status text;
  review_number integer;
begin
  if p_action is null or p_action not in ('approve','request_adjustment','accept_adjustment','reject_adjustment')
    or (p_action<>'approve' and coalesce(length(btrim(p_note)),0) not between 3 and 4000) then
    raise exception using errcode='22023', message='Confira a ação e a justificativa.';
  end if;
  actor := cali_session_guard.require_phase4_role(p_company_id,
    case when p_action in ('approve','request_adjustment') then 'client' else 'admin' end);
  select p.planning_status into planning from cali_workspace.projects p
  where p.id=p_project_id and p.company_id=p_company_id for update;
  if not found then raise exception using errcode='42501', message='Projeto indisponível.'; end if;

  select r.status,r.request_number into review_status,review_number
  from cali_workspace.project_review_requests r
  where r.id=p_review_id and r.company_id=p_company_id and r.project_id=p_project_id
    and not exists(select 1 from cali_workspace.project_review_requests later
      where later.project_id=r.project_id and later.request_number>r.request_number)
  for update;
  if not found or (
    case when p_action in ('approve','request_adjustment')
      then planning<>'client_review' or review_status<>'pending'
      else planning<>'adjustment_requested' or review_status<>'adjustment_requested'
    end
  ) then raise exception using errcode='40001', message='A revisão mudou. Recarregue o projeto.'; end if;

  case p_action
    when 'approve' then perform cali_workspace.client_approve_project_schedule(p_project_id);
    when 'request_adjustment' then
      if review_number>2 or p_target_type is null or p_target_type not in ('project','workstream','deliverable')
        or (p_target_type='deliverable' and (p_item_action is null or p_item_action not in ('reschedule','swap_order','change_proposal')))
        or (p_target_type='deliverable' and not cali_workspace.client_can_view_deliverable(p_target_id))
        or (p_item_action='swap_order' and not cali_workspace.client_can_view_deliverable(p_swap_id)) then
        raise exception using errcode='22023', message='Ajuste indisponível nesta revisão ou para este item.';
      end if;
      perform cali_workspace.client_request_project_schedule_adjustment_v39(
        p_project_id,p_target_type,p_target_id,btrim(p_note),null,p_item_action,p_requested_date,p_swap_id
      );
    else perform cali_workspace.admin_resolve_project_schedule_adjustment(
      p_review_id,p_action='accept_adjustment',btrim(p_note)
    );
  end case;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'project_schedule_'||p_action,'project',p_project_id,jsonb_build_object('review_id',p_review_id));
  return p_review_id;
end;
$$;

revoke all on function cali_session_guard.require_phase4_role(uuid,text) from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_create_pilot_project(uuid,uuid,text,text,date),
  cali_workspace.v2_add_pilot_project_item(uuid,uuid,uuid,text,text,uuid,timestamp without time zone),
  cali_workspace.v2_share_pilot_schedule(uuid,uuid),
  cali_workspace.v2_respond_pilot_schedule(uuid,uuid,uuid,text,text,text,uuid,text,date,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_create_pilot_project(uuid,uuid,text,text,date),
  cali_workspace.v2_add_pilot_project_item(uuid,uuid,uuid,text,text,uuid,timestamp without time zone),
  cali_workspace.v2_share_pilot_schedule(uuid,uuid),
  cali_workspace.v2_respond_pilot_schedule(uuid,uuid,uuid,text,text,text,uuid,text,date,uuid)
  to authenticated;
notify pgrst, 'reload schema';
commit;
