-- FLOW-18. O legado avisa todos os Admins; a fixture inscrita não gera comunicação.
begin;
set local lock_timeout='5s';
create table cali_session_guard.phase4_privacy_qa (
  company_id uuid not null,
  details text not null check (details like '[TESTE V2] %'),
  primary key(company_id,details)
);
alter table cali_session_guard.phase4_privacy_qa enable row level security;
revoke all on cali_session_guard.phase4_privacy_qa from public,anon,authenticated,service_role;

create function cali_session_guard.phase4_suppress_privacy_qa_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.entity_type='data_subject_request'
    and new.notification_type in ('privacy_request','privacy_answer')
    and exists(select 1 from cali_workspace.data_subject_requests r
      join cali_session_guard.phase4_privacy_qa q on q.company_id=r.company_id and q.details=r.details
      where r.id=new.entity_id and r.company_id=new.company_id) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_suppress_privacy_qa_notification()
from public,anon,authenticated,service_role;
create trigger zz_phase4_privacy_qa_notification before insert on cali_workspace.notifications
for each row when (new.entity_type='data_subject_request')
execute function cali_session_guard.phase4_suppress_privacy_qa_notification();
commit;
