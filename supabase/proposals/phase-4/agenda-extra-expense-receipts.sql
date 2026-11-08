-- Comprovantes internos das despesas do piloto.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_extra_expense_pdf (
  expense_id uuid primary key references cali_workspace.extra_visit_expenses(id),
  file_name text not null,
  content bytea not null check (octet_length(content) between 8 and 2097152),
  saved_by uuid not null,
  saved_at timestamptz not null default clock_timestamp()
);
alter table cali_session_guard.phase4_extra_expense_pdf enable row level security;
revoke all on cali_session_guard.phase4_extra_expense_pdf from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_require_extra_expense(p_company_id uuid,p_expense_id uuid)
returns uuid language plpgsql stable set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if not exists (
    select 1 from cali_workspace.extra_visit_expenses x
    join cali_workspace.scheduling_requests r on r.id=x.request_id and r.company_id=x.company_id
    join cali_session_guard.phase4_agenda_qa q on q.company_id=r.company_id and q.title=r.title
    where x.id=p_expense_id and x.company_id=p_company_id and r.extra_visit and r.status='completed'
      and exists(select 1 from cali_workspace.event_outcomes o
        where o.event_id=r.confirmed_event_id and o.company_id=r.company_id and o.outcome='occurred')
  ) then raise exception using errcode='42501',message='Despesa indisponível.'; end if;
  return actor;
end;
$$;
revoke all on function cali_session_guard.phase4_require_extra_expense(uuid,uuid)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_save_pilot_extra_expense_pdf(
  p_company_id uuid,p_expense_id uuid,p_request_id uuid,p_file_name text,p_pdf_base64 text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.phase4_require_extra_expense(p_company_id,p_expense_id);
  label text := btrim(p_file_name);
  bytes bytea;
  signature bytea;
  saved uuid;
begin
  if p_request_id is null or coalesce(length(label),0) not between 5 and 180
    or lower(right(label,4))<>'.pdf' or label ~ '[/[:cntrl:]]' or position(chr(92) in label)>0
    or coalesce(length(p_pdf_base64),0) not between 12 and 2796204 then
    raise exception using errcode='22023',message='Selecione um PDF de até 2 MiB.';
  end if;
  bytes:=decode(p_pdf_base64,'base64');
  if octet_length(bytes) not between 8 and 2097152 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
    raise exception using errcode='22023',message='PDF inválido.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('extra-expense-pdf',p_expense_id,label,
    encode(sha256(bytes),'hex'))::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  insert into cali_session_guard.phase4_extra_expense_pdf(expense_id,file_name,content,saved_by)
    values(p_expense_id,label,bytes,actor) on conflict (expense_id) do nothing;
  if not found then raise exception using errcode='40001',message='Esta despesa já tem comprovante.'; end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,p_expense_id);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    select p_company_id,actor,'extra_visit_expense_receipt_attached','scheduling_request',x.request_id,
      jsonb_build_object('expense_id',x.id) from cali_workspace.extra_visit_expenses x where x.id=p_expense_id;
  return p_expense_id;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_extra_expense_pdf(p_company_id uuid,p_expense_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  payload jsonb;
begin
  perform cali_session_guard.phase4_require_extra_expense(p_company_id,p_expense_id);
  select jsonb_build_object('id',expense_id,'fileName',file_name,'content',encode(content,'base64'),
    'sha256',encode(sha256(content),'hex')) into payload
  from cali_session_guard.phase4_extra_expense_pdf where expense_id=p_expense_id;
  if payload is null then raise exception using errcode='42501',message='Comprovante indisponível.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return payload;
end;
$$;

revoke all on function cali_workspace.v2_save_pilot_extra_expense_pdf(uuid,uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_extra_expense_pdf(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_pilot_extra_expense_pdf(uuid,uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_extra_expense_pdf(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
