-- Colunas usadas pela colaboração; os auxiliares de Cliente preservam o contrato conferido no CALI MAPA.
alter table cali_workspace.project_review_requests add column resolution_note text;
alter table cali_workspace.deliverables add column original_due_at timestamptz;
alter table cali_workspace.work_timers add column task_id uuid;
alter table cali_workspace.notifications add column user_id uuid,add column title text,add column body text,
 add column action_url text,add column relevance text;
alter table cali_workspace.deliverable_tasks add column id uuid primary key,add column company_id uuid,
 add column title text,add column description text,add column due_at timestamptz,add column client_visible boolean default false,
 add column sort_order integer default 0,add column created_by uuid,add column estimated_minutes integer default 0,
 add column complexity text,add column assigned_user_id uuid,add column started_at timestamptz,
 add column work_closed_by uuid,add column adjustment_count integer default 0,
 add column created_at timestamptz default clock_timestamp(),add column updated_at timestamptz default clock_timestamp();
alter table cali_workspace.deliverable_tasks alter column status set default 'todo';
create trigger fixture_task_touch before update on cali_workspace.deliverable_tasks
for each row execute function cali_workspace.fixture_report_touch();
create table cali_workspace.task_messages(id uuid primary key default gen_random_uuid(),task_id uuid,deliverable_id uuid,
 company_id uuid,author_user_id uuid,author_role text,body text,client_visible boolean,created_at timestamptz default clock_timestamp());
create table cali_workspace.comments(id uuid primary key,company_id uuid,target_type text,target_id uuid,
 author_user_id uuid,body text,client_visible boolean,source_actor text,created_at timestamptz default clock_timestamp());
create table cali_workspace.deliverable_client_dependencies(id uuid primary key,company_id uuid,deliverable_id uuid,title text,
 due_date date,status text default 'pending',received_at timestamptz,created_by uuid,created_at timestamptz default clock_timestamp());
create table cali_workspace.deliverable_due_revisions(id uuid primary key,company_id uuid,deliverable_id uuid,previous_due timestamptz,
 new_due timestamptz,cause text,reason text,created_by uuid,created_at timestamptz default clock_timestamp());
create table cali_workspace.deliverable_status_history(id bigint primary key,company_id uuid,deliverable_id uuid,
 to_status text,note text,created_at timestamptz default clock_timestamp());
create table cali_workspace.project_lifecycle_events(id uuid primary key,company_id uuid,project_id uuid,action text,
 scope_label text,reason text,resume_date date,client_visible boolean,created_at timestamptz default clock_timestamp());

CREATE OR REPLACE FUNCTION cali_workspace.client_visible_task(p_task_id uuid)
 RETURNS cali_workspace.deliverable_tasks
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'cali_workspace'
AS $function$
declare v_task cali_workspace.deliverable_tasks%rowtype;
begin
  select * into v_task from cali_workspace.deliverable_tasks where id = p_task_id;
  if not found or v_task.company_id is distinct from cali_workspace.current_company_id() or not v_task.client_visible or not cali_workspace.client_can_view_deliverable(v_task.deliverable_id) then
    raise exception 'Subtarefa não disponível.' using errcode = '42501';
  end if;
  return v_task;
end;
$function$
;

CREATE OR REPLACE FUNCTION cali_workspace.client_approve_task(p_task_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'cali_workspace'
AS $function$
declare v_task cali_workspace.deliverable_tasks%rowtype := cali_workspace.client_visible_task(p_task_id);
begin
  if v_task.status <> 'client_review' then raise exception 'Esta subtarefa não está aguardando a sua aprovação.'; end if;
  update cali_workspace.deliverable_tasks set status = 'approved', completed_at = now() where id = v_task.id;
  insert into cali_workspace.activity_log (company_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_task.company_id, auth.uid(), 'client_task_approved', 'deliverable', v_task.deliverable_id, jsonb_build_object('task_id', v_task.id, 'title', v_task.title));
  insert into cali_workspace.notifications (company_id, user_id, notification_type, title, body, entity_type, entity_id, action_url, relevance, email_required)
  select v_task.company_id, p.id, 'client_task_approved', 'Cliente aprovou uma subtarefa', left('“' || v_task.title || '” foi aprovada pelo cliente.', 400), 'deliverable', v_task.deliverable_id, '/admin/projetos?deliverable=' || v_task.deliverable_id::text, 'high', false
    from cali_workspace.profiles p where p.role = 'admin' and p.active;
end;
$function$
;

CREATE OR REPLACE FUNCTION cali_workspace.client_request_task_adjustment(p_task_id uuid, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'cali_workspace'
AS $function$
declare v_task cali_workspace.deliverable_tasks%rowtype := cali_workspace.client_visible_task(p_task_id); v_text text := left(btrim(coalesce(p_body, '')), 4000); v_next integer;
begin
  if v_task.status <> 'client_review' then raise exception 'Esta subtarefa não está aguardando a sua aprovação.'; end if;
  if coalesce(v_task.adjustment_count, 0) >= 2 then raise exception 'Os 2 ajustes desta parte já foram usados. Fale com a CALI pela conversa.'; end if;
  if char_length(v_text) < 10 then raise exception 'Descreva o ajuste com um pouco mais de detalhe.'; end if;
  v_next := coalesce(v_task.adjustment_count, 0) + 1;
  update cali_workspace.deliverable_tasks set status = 'doing', adjustment_count = v_next where id = v_task.id;
  insert into cali_workspace.task_messages (task_id, deliverable_id, company_id, author_user_id, author_role, body, client_visible)
  values (v_task.id, v_task.deliverable_id, v_task.company_id, auth.uid(), 'client', 'Pedido de ajuste ' || v_next || '/2: ' || v_text, true);
  insert into cali_workspace.activity_log (company_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_task.company_id, auth.uid(), 'client_task_adjustment_requested', 'deliverable', v_task.deliverable_id, jsonb_build_object('task_id', v_task.id, 'title', v_task.title, 'request', left(v_text, 500), 'number', v_next));
  insert into cali_workspace.notifications (company_id, user_id, notification_type, title, body, entity_type, entity_id, action_url, relevance, email_required)
  select v_task.company_id, p.id, 'client_task_adjustment_requested', 'Cliente pediu ajuste em uma subtarefa (' || v_next || '/2)', left('“' || v_task.title || '”: ' || v_text, 400), 'deliverable', v_task.deliverable_id, '/admin/projetos?deliverable=' || v_task.deliverable_id::text, 'high', false
    from cali_workspace.profiles p where p.role = 'admin' and p.active;
end;
$function$
;
