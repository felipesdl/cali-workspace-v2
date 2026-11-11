-- FLOW-17: recibos da devolutiva sintética. A situação da resposta legada é preservada.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_mapa_email (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  record_id uuid not null,
  company_id uuid not null,
  actor_id uuid not null,
  fingerprint bytea not null,
  recipients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  provider_id uuid unique,
  unique(request_id)
);
alter table cali_session_guard.phase4_mapa_email add column if not exists request_id uuid;
alter table cali_session_guard.phase4_mapa_email add column if not exists recipients jsonb not null default '[]'::jsonb;
update cali_session_guard.phase4_mapa_email set request_id=id where request_id is null;
alter table cali_session_guard.phase4_mapa_email alter column request_id set not null;
alter table cali_session_guard.phase4_mapa_email drop constraint if exists phase4_mapa_email_record_id_fingerprint_key;
create unique index if not exists phase4_mapa_email_request_id_key
  on cali_session_guard.phase4_mapa_email(request_id);
alter table cali_session_guard.phase4_mapa_email enable row level security;
revoke all on cali_session_guard.phase4_mapa_email from public,anon,authenticated,service_role;

drop function if exists cali_workspace.v2_prepare_pilot_mapa_email(uuid,uuid,jsonb);
create or replace function cali_workspace.v2_prepare_pilot_mapa_email(
  p_company_id uuid,p_record_id uuid,p_expected jsonb,p_request_id uuid,p_recipients jsonb
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  report jsonb;
  job cali_session_guard.phase4_mapa_email%rowtype;
  fingerprint_value bytea;
begin
  if p_request_id is null or jsonb_typeof(p_recipients) is distinct from 'array' then
    raise exception using errcode='22023',message='Confirme o destino da devolutiva.';
  end if;
  if jsonb_array_length(p_recipients) not between 1 and 20
    or exists(select 1 from jsonb_array_elements(p_recipients) recipient
      where jsonb_typeof(recipient)<>'string' or length(recipient#>>'{}') not between 3 and 320)
  then raise exception using errcode='22023',message='Confirme o destino da devolutiva.'; end if;
  perform 1 from cali_session_guard.phase4_mapa_scope g
  join public.mapa_respostas r on r.id=g.record_id
  where g.record_id=p_record_id and g.company_id=p_company_id and g.operator_id=actor
    and g.expires_at>clock_timestamp() and r.status in ('novo','em_andamento','em_revisao')
  for share of g,r;
  if not found then raise exception using errcode='42501',message='Diagnóstico indisponível.'; end if;
  report:=cali_workspace.v2_read_pilot_mapa_report(p_company_id,p_record_id);
  if report is null or report is distinct from p_expected then
    raise exception using errcode='40001',message='O diagnóstico mudou. Confira a versão atual.';
  end if;
  fingerprint_value:=sha256(convert_to(jsonb_build_array(report,p_recipients)::text,'UTF8'));
  insert into cali_session_guard.phase4_mapa_email(request_id,record_id,company_id,actor_id,fingerprint,recipients)
    values(p_request_id,p_record_id,p_company_id,actor,fingerprint_value,p_recipients)
    on conflict(request_id) do nothing returning * into job;
  if not found then
    select * into strict job from cali_session_guard.phase4_mapa_email where request_id=p_request_id for update;
    if job.record_id is distinct from p_record_id or job.company_id is distinct from p_company_id
      or job.actor_id is distinct from actor or job.fingerprint is distinct from fingerprint_value
      or job.recipients is distinct from p_recipients
    then raise exception using errcode='40001',message='A confirmação já foi usada em outro envio.'; end if;
  end if;
  if job.provider_id is null and job.created_at<=clock_timestamp()-interval '10 minutes' then
    raise exception using errcode='22023',message='Confirmação pendente. Confira o envio antes de repetir.';
  end if;
  return jsonb_build_object('id',job.id,'sent',job.provider_id is not null,
    'report',report,'recipients',job.recipients);
end;
$$;

create or replace function cali_workspace.v2_record_pilot_mapa_email(p_id uuid,p_provider uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  job cali_session_guard.phase4_mapa_email%rowtype;
begin
  if p_provider is null then raise exception using errcode='22023',message='Recibo inválido.'; end if;
  select * into strict job from cali_session_guard.phase4_mapa_email where id=p_id for update;
  if job.provider_id=p_provider then return; end if;
  if job.provider_id is not null then
    raise exception using errcode='40001',message='O recibo já foi registrado.';
  end if;
  update cali_session_guard.phase4_mapa_email set provider_id=p_provider where id=p_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(job.company_id,job.actor_id,'mapa_report_email_test','mapa_record',job.record_id,
      jsonb_build_object('channel','resend_test','receipt',p_provider));
end;
$$;

revoke all on function cali_workspace.v2_prepare_pilot_mapa_email(uuid,uuid,jsonb,uuid,jsonb),
  cali_workspace.v2_record_pilot_mapa_email(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_prepare_pilot_mapa_email(uuid,uuid,jsonb,uuid,jsonb) to authenticated;
grant execute on function cali_workspace.v2_record_pilot_mapa_email(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
