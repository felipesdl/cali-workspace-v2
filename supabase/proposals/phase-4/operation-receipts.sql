begin;

create table if not exists cali_session_guard.phase4_operation_receipts (
  actor_id uuid not null,
  company_id uuid not null,
  request_id uuid not null,
  fingerprint bytea not null,
  result_id uuid not null,
  primary key(actor_id, company_id, request_id)
);
revoke all on table cali_session_guard.phase4_operation_receipts from public,anon,authenticated,service_role;

create function cali_session_guard.read_phase4_receipt(
  p_actor uuid,p_company uuid,p_request uuid,p_signature bytea
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  receipt cali_session_guard.phase4_operation_receipts%rowtype;
begin
  if p_request is null then raise exception using errcode='22023', message='Solicitação inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-receipt:'||p_actor::text||':'||p_company::text||':'||p_request::text,0));
  select * into receipt from cali_session_guard.phase4_operation_receipts r
  where r.actor_id=p_actor and r.company_id=p_company and r.request_id=p_request;
  if found and receipt.fingerprint<>p_signature then
    raise exception using errcode='40001', message='A solicitação já foi usada.';
  end if;
  return receipt.result_id;
end;
$$;
revoke all on function cali_session_guard.read_phase4_receipt(uuid,uuid,uuid,bytea)
  from public,anon,authenticated,service_role;
commit;
