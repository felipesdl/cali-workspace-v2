-- A avaliação opcional nasce quando uma ocorrência visível é finalizada.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_satisfaction_requests (
  record_id uuid primary key references cali_workspace.account_records(id) on delete cascade,
  requested_at timestamptz not null,
  closed_at timestamptz,
  closed_by uuid,
  check ((closed_at is null) = (closed_by is null))
);
alter table cali_session_guard.phase4_satisfaction_requests enable row level security;
revoke all on cali_session_guard.phase4_satisfaction_requests from public,anon,authenticated,service_role;

create or replace function cali_session_guard.track_phase4_satisfaction_request()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.workflow_status='completed' and new.visibility='client' and new.closed_at is not null then
    insert into cali_session_guard.phase4_satisfaction_requests(record_id,requested_at)
    values(new.id,new.closed_at) on conflict(record_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.track_phase4_satisfaction_request() from public,anon,authenticated,service_role;
drop trigger if exists phase4_track_satisfaction_request on cali_workspace.account_records;
create trigger phase4_track_satisfaction_request
after insert or update of workflow_status,visibility,closed_at on cali_workspace.account_records
for each row execute function cali_session_guard.track_phase4_satisfaction_request();

-- Só preencher histórico com evidência da solicitação e de sua data.
insert into cali_session_guard.phase4_satisfaction_requests(record_id,requested_at)
select id,closed_at from cali_workspace.account_records
where workflow_status='completed' and visibility='client' and closed_at is not null
on conflict(record_id) do nothing;

create or replace function cali_workspace.v2_read_satisfaction_requests(p_company uuid,p_month date,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_pilot_admin_session();
begin
  if (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true' then
    raise exception using errcode='42501',message='Satisfação indisponível.';
  end if;
  if p_page is null or p_page not between 1 and 10000
    or (p_month is not null and (p_month not between date '1900-01-01' and date '9999-12-01'
      or extract(day from p_month)<>1)) then
    raise exception using errcode='22023',message='Recorte inválido.';
  end if;
  return (
    with requests as (
      select r.id,r.title,s.requested_at,
        case when exists(
          select 1 from cali_workspace.account_record_feedback f
          where f.record_id=r.id and f.company_id=r.company_id and f.created_at>=s.requested_at
        ) then 'answered'
        when s.closed_at is not null then 'unanswered'
        when r.workflow_status='completed' then 'waiting' end as status
      from cali_session_guard.phase4_satisfaction_requests s
      join cali_workspace.account_records r on r.id=s.record_id
      where r.visibility='client' and (p_company is null or r.company_id=p_company)
        and (p_month is null or (s.requested_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
          and s.requested_at < ((p_month+interval '1 month') at time zone 'America/Sao_Paulo')))
    ), waiting_page as (
      select id,title,requested_at as "requestedAt" from requests where status='waiting' and p_company is not null
      order by requested_at desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company,'month',p_month,
      'answered',count(*) filter(where status='answered'),
      'waiting',count(*) filter(where status='waiting'),
      'unanswered',count(*) filter(where status='unanswered'),
      'requests',coalesce((select jsonb_agg(to_jsonb(w) order by w."requestedAt" desc,w.id) from waiting_page w),'[]'::jsonb))
    from requests
  );
end;
$$;

create or replace function cali_workspace.v2_close_satisfaction_request(p_company uuid,p_record uuid,p_requested_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  perform 1 from cali_workspace.account_records r
  where r.id=p_record and r.company_id=p_company and r.visibility='client' and r.workflow_status='completed'
  for update;
  if not found then raise exception using errcode='42501',message='Solicitação indisponível.'; end if;
  if exists(select 1 from cali_session_guard.phase4_satisfaction_requests
    where record_id=p_record and requested_at=p_requested_at and closed_at is not null) then return; end if;
  update cali_session_guard.phase4_satisfaction_requests s
  set closed_at=clock_timestamp(),closed_by=actor
  where s.record_id=p_record and s.requested_at=p_requested_at and s.closed_at is null
    and not exists(select 1 from cali_workspace.account_record_feedback f
      where f.record_id=p_record and f.company_id=p_company and f.created_at>=s.requested_at);
  if not found then raise exception using errcode='40001',message='A solicitação mudou. Atualize a lista.'; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company,actor,'satisfaction_closed_unanswered','account_record',p_record,'{}'::jsonb);
end;
$$;

revoke all on function cali_workspace.v2_read_satisfaction_requests(uuid,date,integer),
  cali_workspace.v2_close_satisfaction_request(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_satisfaction_requests(uuid,date,integer),
  cali_workspace.v2_close_satisfaction_request(uuid,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
