-- FLOW-17. Jornada de sessões sintéticas explicitamente delegadas ao operador.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_mapa_journey_scope (
  session_id uuid primary key,
  company_id uuid not null,
  operator_id uuid not null,
  expires_at timestamptz not null
);
alter table cali_session_guard.phase4_mapa_journey_scope enable row level security;
revoke all on cali_session_guard.phase4_mapa_journey_scope from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_list_pilot_mapa_journeys(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select encode(sha256(convert_to(p_company_id::text||':'||s.session_id::text,'UTF8')),'hex') as id,
        j.accessed_at as "accessedAt",j.last_seen_at as "lastSeenAt",
        greatest(0,least(7,coalesce(j.max_step,0))) as step,
        coalesce(j.started,false) as started,coalesce(j.copy_events,0) as copies,
        j.device_type as device,j.referrer_host as referrer,
        case when j.submitted then 'completed'
          when j.last_seen_at>=statement_timestamp()-interval '15 minutes' then 'in_progress'
          else 'abandoned' end as status
      from cali_session_guard.phase4_mapa_journey_scope s
      join public.mapa_sessoes_resumo j on j.session_id=s.session_id
      where s.company_id=p_company_id and s.operator_id=actor and s.expires_at>statement_timestamp()
        and j.accessed_at is not null and j.last_seen_at is not null
    ), selected as (
      select * from matched order by "accessedAt" desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(selected) order by "accessedAt" desc,id) from selected),'[]'::jsonb))
  );
end;
$$;
revoke all on function cali_workspace.v2_list_pilot_mapa_journeys(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_mapa_journeys(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
