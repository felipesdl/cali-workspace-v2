-- Agenda sintética. Não interfere na fila de outros pedidos ou empresas.
begin;
set local lock_timeout='5s';
create table cali_session_guard.phase4_agenda_qa (
  company_id uuid not null,
  title text not null check (title like '[TESTE V2] %'),
  enrolled_at timestamptz not null default clock_timestamp(),
  primary key(company_id,title)
);
alter table cali_session_guard.phase4_agenda_qa enable row level security;
revoke all on cali_session_guard.phase4_agenda_qa from public,anon,authenticated,service_role;

create function cali_session_guard.phase4_agenda_qa_in_app()
returns trigger language plpgsql security definer set search_path=''
as $$
declare appointment uuid;
begin
  case new.entity_type
    when 'scheduling_request' then appointment:=new.entity_id;
    when 'event' then
      select e.source_entity_id into appointment from cali_workspace.events e
      where e.id=new.entity_id and e.company_id=new.company_id and e.source_type='scheduling_request';
    else return new;
  end case;
  if exists(select 1 from cali_workspace.scheduling_requests r join cali_session_guard.phase4_agenda_qa q
    on q.company_id=r.company_id and q.title=r.title
    where r.id=appointment and r.company_id=new.company_id) then
    new.email_required:=false;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_agenda_qa_in_app() from public,anon,authenticated,service_role;
create trigger zz_phase4_agenda_qa_in_app before insert or update of email_required
on cali_workspace.notifications for each row execute function cali_session_guard.phase4_agenda_qa_in_app();
commit;
