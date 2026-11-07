-- Estrutura mínima para as projeções. Sessão, termos e auxiliares do legado são fixtures.
\ir ../team/monthly-context.sql
create table cali_workspace.projects(id uuid primary key,company_id uuid,name text,protocol text,
 description text,planning_status text,execution_status text,roadmap_start_date date,roadmap_end_date date,status text);
create table cali_workspace.project_workstreams(id uuid,company_id uuid,project_id uuid,name text,
 protocol text,status text,execution_status text,sort_order integer);
create table cali_workspace.project_review_requests(id uuid,company_id uuid,project_id uuid,status text,
 request_number integer,response_due_at timestamptz,created_at timestamptz,response_note text);
create table cali_workspace.deliverables(id uuid,company_id uuid,project_id uuid,title text,protocol text,
 status text,execution_status text,due_at timestamptz,sort_order integer,client_visible boolean,updated_at timestamptz default clock_timestamp());
create table cali_workspace.hour_entries(id uuid,company_id uuid,project_id uuid,work_date date,
 minutes integer,description text,category text,internal_note text,client_visible boolean);
create table cali_workspace.events(id uuid,company_id uuid,title text,protocol text,event_type text,
 starts_at timestamptz,ends_at timestamptz,cancelled_at timestamptz,visibility text);
create table cali_workspace.event_outcomes(
  event_id uuid primary key,company_id uuid,outcome text,reason_category text,justified boolean,note text,replacement_allowed boolean
);
create table cali_workspace.account_records(id uuid,company_id uuid,title text,protocol text,
 workflow_status text,occurred_at timestamptz,visibility text);
create table cali_workspace.files(id uuid,company_id uuid,title text,protocol text,status text,
 published_at timestamptz,client_visible boolean,deliverable_id uuid);
create table cali_workspace.notices(id uuid,title text,protocol text,status text,published_at timestamptz,
 notice_date date,body text,audience text);
create table cali_workspace.notice_targets(notice_id uuid,company_id uuid);
create table cali_workspace.notice_acknowledgements(notice_id uuid,user_id uuid,company_id uuid,primary key(notice_id,user_id));
create table cali_workspace.reports(id uuid,company_id uuid,title text,protocol text,status text,
 published_at timestamptz,period_start date,executive_summary text, revision_parent_id uuid,version integer default 1, acknowledged_at timestamptz,updated_at timestamptz default clock_timestamp());
create table cali_workspace.front_catalog(code text primary key,title text,description text);
create table cali_workspace.company_fronts(id uuid,company_id uuid,scope_label text,front_code text,status text,started_at date,mode text,ends_at date);
create table cali_workspace.capacity_events(id uuid default gen_random_uuid(),company_id uuid,month date,kind text,
 percent numeric,occurrence_number integer,created_at timestamptz);
create table cali_workspace.capacity_pauses(company_id uuid,month date,resumed_at timestamptz,note text);
insert into cali_workspace.capacity_events(company_id,month,kind,percent,occurrence_number,created_at) values
 ('9c5ab148-78b8-4410-9338-58c44222a5db','2026-11-01','m75',75,null,'2026-11-02Z'),
 ('9c5ab148-78b8-4410-9338-58c44222a5db','2026-11-01','review',120,3,'2026-11-03Z'),
 ('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76','2026-11-01','excess',101,1,'2026-11-04Z');
insert into cali_workspace.capacity_pauses values
 ('9c5ab148-78b8-4410-9338-58c44222a5db','2026-11-01',null,'Motivo reservado');
alter table cali_workspace.capacity_pauses add column paused_at timestamptz not null default '2026-11-01Z',
  add column paused_by uuid,add column resumed_by uuid,add unique(company_id,month);

create function cali_workspace.current_company_id() returns uuid language sql stable as $$
 select company_id from cali_workspace.profiles where id=auth.uid() and active
$$;
create function cali_workspace.client_can_view_project(project uuid) returns boolean language sql stable as $$
 select exists(select 1 from cali_workspace.projects where id=project and company_id=cali_workspace.current_company_id()
  and planning_status in ('client_review','adjustment_requested','approved','active','rebriefing','closed'))
$$;
create function cali_workspace.client_can_view_deliverable(deliverable uuid) returns boolean language sql stable as $$
 select exists(select 1 from cali_workspace.deliverables where id=deliverable
   and company_id=cali_workspace.current_company_id() and client_visible and status<>'cancelled'
   and cali_workspace.client_can_view_project(project_id))
$$;
create function cali_workspace.client_hours_enabled_for_period(company uuid,month date) returns boolean
language sql stable as $$ select company='9c5ab148-78b8-4410-9338-58c44222a5db' and month='2026-11-01'::date $$;
create function cali_workspace.hour_project_operational(project uuid) returns boolean language sql stable as $$
 select project is null or exists(select 1 from cali_workspace.projects where id=project and status<>'cancelled'
  and (planning_status in ('approved','active','rebriefing','closed') or (planning_status is null and status='active')))
$$;
create function cali_workspace.capacity_month(p_company_id uuid,p_month date)
returns table(contracted_minutes integer,used_minutes integer) language sql stable as $$
 select case when p_company_id='9c5ab148-78b8-4410-9338-58c44222a5db' and p_month='2026-11-01'
   then 60 when p_company_id='9c5ab148-78b8-4410-9338-58c44222a5db' then 120 else 0 end,
   coalesce(sum(h.minutes),0)::integer
 from cali_workspace.hour_entries h
 where h.company_id=p_company_id and h.work_date>=p_month
   and h.work_date<(p_month+interval '1 month')::date and cali_workspace.hour_project_operational(h.project_id)
$$;
create function cali_workspace.can_read_notice(notice uuid) returns boolean language sql stable as $$
 select exists(select 1 from cali_workspace.notices n where n.id=notice and n.status='published'
   and cali_workspace.current_company_id() is not null
   and (n.audience='all' or exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id
     and t.company_id=cali_workspace.current_company_id())))
$$;

do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 pa constant uuid := '10000000-0000-4000-8000-000000000001';
 pb constant uuid := '10000000-0000-4000-8000-000000000002';
 pd constant uuid := '10000000-0000-4000-8000-000000000003';
 d1 uuid := gen_random_uuid();
 d2 uuid := gen_random_uuid();
 nb uuid := gen_random_uuid();
begin
 insert into cali_workspace.projects values
  (pa,a,'Projeto A','PA','Descrição','active','active','2026-11-01',null,'active'),
  (pb,b,'Projeto B','PB',null,'active','active',null,null,'active'),
  (pd,a,'Rascunho','PD',null,'draft','draft',null,null,'draft');
 insert into cali_workspace.project_workstreams values
  (gen_random_uuid(),a,pa,'Frente do projeto','WS','active','active',1);
 insert into cali_workspace.project_review_requests values
  (gen_random_uuid(),a,pa,'approved',1,'2026-11-04Z','2026-11-01Z',null),
  (gen_random_uuid(),a,pa,'pending',2,'2026-11-14Z','2026-11-11Z',null);
 insert into cali_workspace.deliverables values
  (d1,a,pa,'Entrega pública','E1','in_progress','active','2026-11-05Z',1,true,default),
  (d2,a,pa,'Entrega interna','E2','in_progress','active',null,2,false,default);
 insert into cali_workspace.hour_entries values
  (gen_random_uuid(),a,pa,'2026-11-01',30,'Trabalho','planning','Nota interna',true),
  (gen_random_uuid(),a,pa,'2026-11-02',50,'Trabalho interno','planning','Nota interna',false),
  (gen_random_uuid(),a,pd,'2026-11-03',90,'Projeto em rascunho','planning',null,true),
  (gen_random_uuid(),b,pb,'2026-11-01',100,'Outra empresa','planning',null,true);
 insert into cali_workspace.events values
  (gen_random_uuid(),a,'Cruza início do mês','A','meeting','2026-11-01 02:00Z','2026-11-01 04:00Z',null,'client'),
  (gen_random_uuid(),a,'Termina no limite','B','meeting','2026-11-01 02:00Z','2026-11-01 03:00Z',null,'client'),
  (gen_random_uuid(),a,'Privado','C','meeting','2026-11-01 04:00Z','2026-11-01 05:00Z',null,'admin'),
  (gen_random_uuid(),a,'Cancelado','D','meeting','2026-11-02 04:00Z','2026-11-02 05:00Z','2026-11-01Z','client');
 insert into cali_workspace.account_records values
  (gen_random_uuid(),a,'Visível','O1','open','2026-11-01Z','client'),
  (gen_random_uuid(),a,'Interna','O2','open','2026-11-01Z','admin');
 insert into cali_workspace.files values
  (gen_random_uuid(),a,'Publicado','F1','published','2026-11-01Z',true,d1),
  (gen_random_uuid(),a,'Rascunho','F2','draft',null,true,null),
  (gen_random_uuid(),a,'Ligado a entrega interna','F3','published','2026-11-01Z',true,d2);
 insert into cali_workspace.notices values
  (gen_random_uuid(),'Geral','N1','published','2026-11-01Z','2026-11-01','Mensagem','all'),
  (gen_random_uuid(),'Rascunho','N2','draft',null,'2026-11-01','Reservado','all'),
  (nb,'Outra empresa','N3','published','2026-11-01Z','2026-11-01','Mensagem','targeted');
 insert into cali_workspace.notice_targets values (nb,b);
 insert into cali_workspace.reports values
  (gen_random_uuid(),a,'Publicado','R1','published','2026-11-01Z','2026-11-01','Resumo',null,1,null,default),
  (gen_random_uuid(),a,'Rascunho','R2','draft',null,'2026-11-01','Resumo interno',null,1,null,default);
 insert into cali_workspace.front_catalog values
  ('F1','Frente ativa','Descrição de catálogo'),
  ('F2','Frente encerrada','Descrição anterior');
 insert into cali_workspace.company_fronts values
  (gen_random_uuid(),a,'Escopo ativo','F1','active','2026-11-01','slot_included','2026-11-30'),
  (gen_random_uuid(),a,'Escopo encerrado','F2','ended','2026-11-01','addon','2026-11-12');
end $$;

-- Campos efetivos usados pelo editor de planejamento e pela projeção estendida.
alter table cali_workspace.projects add column updated_at timestamptz default clock_timestamp();
alter table cali_workspace.project_workstreams add column updated_at timestamptz default clock_timestamp(), add column objective text;
alter table cali_workspace.deliverables add column description text,add column complexity text,
  add column workstream_id uuid,add column cancelled_at timestamptz,add column cancellation_reason text;
alter table cali_workspace.project_review_requests add column requested_changes jsonb not null default '{}'::jsonb;
