-- Somente projetos sintéticos inscritos por operação administrativa explícita.
begin;
set local lock_timeout = '5s';
create table cali_session_guard.phase4_project_qa (
  project_id uuid primary key references cali_workspace.projects(id),
  company_id uuid not null,
  enrolled_at timestamptz not null default clock_timestamp()
);
alter table cali_session_guard.phase4_project_qa enable row level security;
revoke all on cali_session_guard.phase4_project_qa from public,anon,authenticated,service_role;

create function cali_session_guard.phase4_project_qa_in_app()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from cali_session_guard.phase4_project_qa q
    join cali_workspace.projects p on p.id=q.project_id and p.company_id=q.company_id
    where q.company_id=new.company_id and (
      (new.entity_type='project' and new.entity_id=q.project_id)
      or (new.entity_type='deliverable' and exists (
        select 1 from cali_workspace.deliverables d where d.id=new.entity_id
          and d.company_id=q.company_id and d.project_id=q.project_id
      ))
    )
  ) then new.email_required:=false; end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_project_qa_in_app() from public,anon,authenticated,service_role;
-- Último BEFORE INSERT, depois dos preparadores legados e antes do disparo AFTER.
create trigger zz_phase4_project_qa_in_app before insert or update of email_required
on cali_workspace.notifications for each row execute function cali_session_guard.phase4_project_qa_in_app();
commit;
