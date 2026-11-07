-- FLOW-18. Gerencia vínculos de Frentes no piloto. A guarda legada valida plano e vagas.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_list_pilot_front_options(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  plan text;
begin
  select c.service_plan into plan from cali_workspace.companies c where c.id=p_company_id;
  return (
    select jsonb_build_object('hasPlan',coalesce(plan in ('partner','full','build_essential','build_complete'),false),
      'occupiedModes',coalesce((select jsonb_agg(distinct active.mode)
        from cali_workspace.company_fronts active where active.company_id=p_company_id
          and active.status='active' and (active.ends_at is null or active.ends_at>=current_date)
          and ((plan='full' and active.mode in ('slot_included','slot_paid'))
            or (plan='partner' and active.mode='slot_paid')
            or (plan='build_essential' and active.mode='build_assisted'))),'[]'::jsonb),
      'options',coalesce(jsonb_agg(jsonb_build_object('code',f.code,'title',f.title,'mode',m.mode)
        order by f.display_order,f.code,m.mode),'[]'::jsonb))
    from cali_workspace.front_catalog f
    cross join lateral (
      select 'slot_included' as mode where plan='full' and f.full_slot
      union all select 'slot_paid' where (plan='partner' and f.partner_slot) or (plan='full' and f.full_slot)
      union all select 'addon' where plan in ('partner','full') and f.category in ('addon','project')
      union all select 'build_assisted' where plan in ('build_essential','build_complete') and f.build_allowed
    ) m
    where f.active and not (f.partner_core and plan in ('partner','full') or f.full_core and plan='full')
  );
end;
$$;

create or replace function cali_workspace.v2_activate_pilot_front(
  p_company_id uuid,p_request_id uuid,p_code text,p_mode text,p_scope text,p_start date,p_end date
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  scope text := nullif(btrim(p_scope),'');
  fingerprint bytea;
  previous uuid;
begin
  if coalesce(length(p_code),0) not between 1 and 100
    or p_mode is null or p_mode not in ('slot_included','slot_paid','addon','build_assisted')
    or coalesce(length(scope),0)>240 or (p_code='selection_vacancy' and scope is null)
    or p_start is null or not isfinite(p_start) or (p_end is not null and (not isfinite(p_end) or p_end<p_start)) then
    raise exception using errcode='22023',message='Confira a frente, o escopo e as datas.';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array('front-activate',p_code,p_mode,scope,p_start,p_end)::text,'UTF8'));
  previous := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,fingerprint);
  if previous is not null then return previous; end if;
  perform 1 from cali_workspace.companies c where c.id=p_company_id
    and c.status::text='active' and c.service_plan in ('partner','full','build_essential','build_complete') for update;
  if not found then raise exception using errcode='P4F01',message='Defina um plano ativo antes de ativar a frente.'; end if;
  insert into cali_workspace.company_fronts(id,company_id,front_code,mode,scope_label,started_at,ends_at,status,activated_by_user_id)
  values(p_request_id,p_company_id,p_code,p_mode,scope,p_start,p_end,'active',actor);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'company_front_activated','company_front',p_request_id,jsonb_build_object('code',p_code,'mode',p_mode));
  insert into cali_session_guard.phase4_operation_receipts(actor_id,company_id,request_id,fingerprint,result_id)
  values(actor,p_company_id,p_request_id,fingerprint,p_request_id);
  return p_request_id;
end;
$$;

create or replace function cali_workspace.v2_end_pilot_front(p_company_id uuid,p_front_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  current_status text;
begin
  perform 1 from cali_workspace.companies c where c.id=p_company_id for update;
  select f.status into current_status from cali_workspace.company_fronts f
    where f.company_id=p_company_id and f.id=p_front_id for update;
  if not found then raise exception using errcode='42501',message='Frente indisponível.'; end if;
  if current_status='ended' then return p_front_id; end if;
  update cali_workspace.company_fronts set status='ended' where id=p_front_id and company_id=p_company_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'company_front_ended','company_front',p_front_id,'{}');
  return p_front_id;
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_front_options(uuid),
  cali_workspace.v2_activate_pilot_front(uuid,uuid,text,text,text,date,date),
  cali_workspace.v2_end_pilot_front(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_front_options(uuid),
  cali_workspace.v2_activate_pilot_front(uuid,uuid,text,text,text,date,date),
  cali_workspace.v2_end_pilot_front(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
