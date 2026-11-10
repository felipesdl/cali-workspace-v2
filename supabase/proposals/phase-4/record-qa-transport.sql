-- QA de ocorrências: preserva o aviso no app e bloqueia despacho só do assunto inscrito.
begin;
set local lock_timeout='5s';
create table cali_session_guard.phase4_record_qa (
  company_id uuid not null,
  title text not null check (title like '[TESTE V2] %'),
  enrolled_at timestamptz not null default clock_timestamp(),
  primary key(company_id,title)
);
alter table cali_session_guard.phase4_record_qa enable row level security;
revoke all on cali_session_guard.phase4_record_qa from public,anon,authenticated,service_role;

create function cali_session_guard.phase4_record_qa_in_app()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.entity_type='account_record' and exists(select 1 from cali_workspace.account_records r
    join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
    where r.id=new.entity_id and r.company_id=new.company_id) then
    new.email_required:=false;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_record_qa_in_app() from public,anon,authenticated,service_role;
create trigger zz_phase4_record_qa_in_app before insert or update of email_required
on cali_workspace.notifications for each row execute function cali_session_guard.phase4_record_qa_in_app();
commit;
