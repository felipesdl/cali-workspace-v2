-- FLOW-09. Projeta pedidos extras e os valores registrados sem ações financeiras.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_list_pilot_agenda_extras(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
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
        case when r.extra_visit then r.extra_visit_cancellation_fee_cents end as "cancellationCents"
      from cali_workspace.scheduling_requests r
      where r.company_id=p_company_id and (r.extra_visit or r.online_extra_requested)
    ), page as (
      select * from matched order by "requestedAt" desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),'entries',coalesce(
      (select jsonb_agg(to_jsonb(page) order by "requestedAt" desc,id) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_agenda_extras(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_agenda_extras(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
