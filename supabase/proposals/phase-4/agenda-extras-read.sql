-- FLOW-09. Projeta pedidos extras e os valores registrados sem ações financeiras.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_list_pilot_agenda_extras(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select r.id,r.title,r.status,r.created_at as "requestedAt",
        case when r.extra_visit then 'in_person' else 'remote' end as mode,
        case when r.extra_visit then r.extra_visit_fee_cents else r.online_extra_quote_cents end as "amountCents",
        case when r.extra_visit then r.billing_acknowledged_at
          else r.online_extra_quote_accepted_at end as "acceptedAt",
        case when r.extra_visit then r.extra_visit_cancellation_fee_cents end as "cancellationCents",
        case when eligibility.allowed then r.billing_notice end as "quoteTerms",
        case when eligibility.allowed then encode(sha256(convert_to(
          jsonb_build_array(r.online_extra_quote_cents,r.billing_notice)::text,'UTF8')),'hex') end as "quoteVersion",
        case when actions.enabled then r.updated_at end as version,
        (actions.enabled and admin and not r.extra_visit and r.online_extra_requested
          and r.request_mode='remote' and r.online_extra_quote_accepted_at is null
          and r.status in ('submitted','client_review')
          and to_regprocedure('cali_workspace.v2_quote_pilot_extra(uuid,uuid,uuid,timestamptz,integer,text)') is not null) as "canQuote",
        (actions.enabled and admin and r.extra_visit and r.status='completed'
          and exists(select 1 from cali_workspace.event_outcomes o
            where o.event_id=r.confirmed_event_id and o.outcome='occurred')
          and to_regprocedure('cali_workspace.v2_record_pilot_extra_expense(uuid,uuid,uuid,text,integer,text,numeric,text)') is not null) as "canRecordExpense",
        case when actions.enabled and admin then r.requested_slots end as "requestedSlots",
        case when actions.enabled and not admin then r.admin_proposed_slots end as "offeredSlots",
        case when actions.enabled then array_remove(array[
          case when admin and r.extra_visit and r.status in ('submitted','reschedule_review') then 'book-visit' end,
          case when admin and r.status in ('submitted','reschedule_review') then 'offer' end,
          case when admin and r.status in ('submitted','reschedule_review') then 'decline' end,
          case when admin and r.extra_visit and r.extra_visit_change_kind is not null
            and r.extra_visit_cancellation_fee_cents is null
            and r.status in ('cancelled','reschedule_review','confirmed','completed') then 'fee' end,
          case when not admin and r.status='client_review'
            and (r.extra_visit or r.online_extra_quote_accepted_at is not null) then 'confirm' end,
          case when not admin and r.extra_visit and r.status='client_review' then 'counter' end,
          case when not admin and r.extra_visit and r.status in ('submitted','client_review','reschedule_review','confirmed') then 'cancel' end,
          case when not admin and r.extra_visit and r.status in ('submitted','client_review','reschedule_review','confirmed') then 'reschedule' end
        ],null) end as actions
      from cali_workspace.scheduling_requests r
      cross join lateral (select r.requested_by=actor and r.online_extra_requested and not r.extra_visit
          and r.request_mode='remote' and r.online_extra_quote_cents>0 and r.online_extra_quote_accepted_at is null
          and r.status in ('submitted','client_review')
          and to_regprocedure('cali_workspace.v2_accept_pilot_online_extra_quote(uuid,uuid,text)') is not null as allowed) eligibility
      cross join lateral (select r.extra_visit<>r.online_extra_requested and (admin or r.requested_by=actor)
        and to_regprocedure('cali_workspace.v2_act_pilot_extra_appointment(uuid,uuid,uuid,timestamptz,text,integer,text,jsonb,boolean)') is not null
        and exists(select 1 from cali_session_guard.phase4_agenda_qa q
          where q.company_id=r.company_id and q.title=r.title) as enabled) actions
      where r.company_id=p_company_id and (r.extra_visit or r.online_extra_requested)
    ), page as (
      select * from matched order by "requestedAt" desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),
      'canRequest',not admin and to_regprocedure(
        'cali_workspace.v2_request_pilot_extra_appointment(uuid,uuid,text,text,text,text,jsonb,integer,text,boolean)') is not null,
      'entries',coalesce(
      (select jsonb_agg(to_jsonb(page) order by "requestedAt" desc,id) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_agenda_extras(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_agenda_extras(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
