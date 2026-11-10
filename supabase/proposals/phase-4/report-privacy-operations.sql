-- FLOW-12/18. Ciência inicial e solicitações de direitos, com vínculo explícito.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_acknowledge_pilot_report(p_company_id uuid,p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  acknowledgment jsonb;
begin
  perform 1 from cali_workspace.reports r where r.id=p_report_id and r.company_id=p_company_id
    and r.status in ('sent','published') and r.revision_parent_id is null and coalesce(r.version,1)=1
  for update;
  if not found then raise exception using errcode='42501', message='Ciência indisponível para este relatório.'; end if;
  acknowledgment := cali_workspace.acknowledge_report_v55(p_report_id);
  return jsonb_build_object('at',acknowledgment->>'acknowledged_at',
    'protocol',acknowledgment->>'acknowledgement_protocol');
end;
$$;

create function cali_workspace.v2_pilot_report_readiness(p_company_id uuid,p_period date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  readiness jsonb;
begin
  if p_period is null or not isfinite(p_period) or extract(day from p_period)<>1 then
    raise exception using errcode='22023', message='Mês inválido.';
  end if;
  readiness := cali_workspace.report_generation_readiness_v61(
    p_company_id,'monthly',p_period,(p_period+interval '1 month'-interval '1 day')::date
  );
  return jsonb_build_object('mode',readiness->>'mode','collected',readiness->'collected_days',
    'required',readiness->'required_days','availableOn',readiness->>'available_on');
end;
$$;

create function cali_workspace.v2_list_pilot_privacy_requests(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id),'[]'::jsonb) from (
      select r.id,r.kind,r.details,r.status,r.answer,r.created_at
      from cali_workspace.data_subject_requests r where r.company_id=p_company_id and (admin or r.user_id=actor)
      order by r.created_at desc,r.id limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

create function cali_workspace.v2_submit_pilot_privacy_request(
  p_company_id uuid,p_request_id uuid,p_kind text,p_details text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
  signature bytea;
  result_id uuid;
begin
  if p_kind is null or p_kind not in ('access','correction','deletion','other')
    or coalesce(length(btrim(p_details)),0) not between 5 and 2000 then
    raise exception using errcode='22023', message='Informe o tipo e descreva o pedido.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('privacy',p_kind,btrim(p_details))::text,'UTF8'));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;
  result_id := cali_workspace.request_data_subject_right(p_kind,btrim(p_details));
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

create function cali_workspace.v2_answer_pilot_privacy_request(
  p_company_id uuid,p_subject_request_id uuid,p_answer text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  current_status text;
begin
  if coalesce(length(btrim(p_answer)),0) not between 5 and 4000 then
    raise exception using errcode='22023', message='Informe a resposta.';
  end if;
  select r.status into current_status from cali_workspace.data_subject_requests r
  where r.id=p_subject_request_id and r.company_id=p_company_id for update;
  if not found then raise exception using errcode='42501', message='Pedido indisponível.'; end if;
  if current_status is distinct from 'open' then
    raise exception using errcode='40001', message='O pedido já mudou de estado.';
  end if;
  perform cali_workspace.admin_answer_data_subject_request(p_subject_request_id,btrim(p_answer));
  return p_subject_request_id;
end;
$$;

revoke all on function cali_workspace.v2_acknowledge_pilot_report(uuid,uuid),
  cali_workspace.v2_pilot_report_readiness(uuid,date),
  cali_workspace.v2_list_pilot_privacy_requests(uuid,integer),
  cali_workspace.v2_submit_pilot_privacy_request(uuid,uuid,text,text),
  cali_workspace.v2_answer_pilot_privacy_request(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_acknowledge_pilot_report(uuid,uuid),
  cali_workspace.v2_pilot_report_readiness(uuid,date),
  cali_workspace.v2_list_pilot_privacy_requests(uuid,integer),
  cali_workspace.v2_submit_pilot_privacy_request(uuid,uuid,text,text),
  cali_workspace.v2_answer_pilot_privacy_request(uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
