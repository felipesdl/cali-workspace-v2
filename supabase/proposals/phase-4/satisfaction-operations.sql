-- FLOW-16. Tratamento administrativo separado das avaliações originais.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_low_feedback(p_company_id uuid)
returns table(source text,response text,title text,score integer,comment text,rated_at timestamptz)
language sql stable set search_path=''
as $$
  select 'record',f.id::text,r.title,f.score::integer,f.comment,f.created_at
  from cali_workspace.account_record_feedback f
  join cali_workspace.account_records r on r.id=f.record_id and r.company_id=f.company_id
  where f.company_id=p_company_id and f.score between 1 and 3
  union all
  select 'deliverable',f.id::text,d.title,f.score::integer,f.comment,f.created_at
  from cali_workspace.nps_responses f
  join cali_workspace.deliverables d on d.id=f.deliverable_id and d.company_id=f.company_id
  where f.company_id=p_company_id and f.score between 1 and 3
  union all
  select 'deliverable','correction:'||f.id,d.title,f.score,f.comment,f.approved_at
  from cali_session_guard.phase4_delivery_corrections f
  join cali_workspace.deliverables d on d.id=f.delivery_id and d.company_id=f.company_id
  where f.company_id=p_company_id and f.score between 1 and 3 and f.approved_at is not null;
$$;

create or replace function cali_workspace.v2_read_pilot_satisfaction(
  p_company_id uuid,p_page integer
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with filtered as (
      select f.* from cali_session_guard.phase4_low_feedback(p_company_id) f
    ), page as (
      select f.source,f.response,f.title,f.score,f.comment,f.rated_at as "ratedAt",
        case when t.id is not null then jsonb_build_object('theme',t.theme,'note',t.note,'handledAt',t.handled_at) end as followup
      from filtered f
      left join cali_workspace.satisfaction_followups t
        on t.company_id=p_company_id and t.source_type=f.source and t.response_id=f.response
      order by f.rated_at desc,f.source,f.response limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'total',(select count(*) from filtered),
      'entries',coalesce((select jsonb_agg(to_jsonb(page) order by "ratedAt" desc,source,response) from page),'[]'::jsonb))
  );
end;
$$;

create or replace function cali_workspace.v2_save_pilot_satisfaction_followup(
  p_company_id uuid,p_source text,p_response text,p_rated_at timestamptz,
  p_expected_followup timestamptz,p_theme text,p_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  previous cali_workspace.satisfaction_followups%rowtype;
  saved uuid;
  followup_note text := nullif(btrim(p_note),'');
begin
  if p_source is null or p_source not in ('record','deliverable')
    or coalesce(length(p_response),0) not between 1 and 64
    or (p_theme is not null and p_theme not in ('prazo','qualidade','comunicacao','atendimento','outro'))
    or length(followup_note)>2000 then
    raise exception using errcode='22023',message='Confira os dados do acompanhamento.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-followup:'||p_source||':'||p_response,0));
  if p_source='record' then
    perform 1 from cali_workspace.account_record_feedback f
    where f.company_id=p_company_id and f.id::text=p_response and f.score between 1 and 3
      and f.created_at=p_rated_at for share;
  elsif p_response like 'correction:%' then
    perform 1 from cali_session_guard.phase4_delivery_corrections f
    where f.company_id=p_company_id and 'correction:'||f.id=p_response and f.score between 1 and 3
      and f.approved_at=p_rated_at for share;
  else
    perform 1 from cali_workspace.nps_responses f
    where f.company_id=p_company_id and f.id::text=p_response and f.score between 1 and 3
      and f.created_at=p_rated_at for share;
  end if;
  if not found or not exists(select 1 from cali_session_guard.phase4_low_feedback(p_company_id) f
    where f.source=p_source and f.response=p_response) then
    raise exception using errcode='40001',message='A avaliação mudou ou está indisponível.';
  end if;
  select * into previous from cali_workspace.satisfaction_followups f
  where f.source_type=p_source and f.response_id=p_response for update;
  if found and previous.company_id is distinct from p_company_id then
    raise exception using errcode='42501',message='Acompanhamento indisponível.';
  end if;
  if previous.id is not null and previous.theme is not distinct from p_theme and previous.note is not distinct from followup_note then
    return previous.id;
  end if;
  if previous.handled_at is distinct from p_expected_followup then
    raise exception using errcode='40001',message='O acompanhamento mudou.';
  end if;
  if previous.id is null then
    insert into cali_workspace.satisfaction_followups(source_type,response_id,company_id,theme,note,handled_by)
    values(p_source,p_response,p_company_id,p_theme,followup_note,actor)
    returning id into saved;
  else
    update cali_workspace.satisfaction_followups set theme=p_theme,note=followup_note,
      handled_by=actor,handled_at=clock_timestamp() where id=previous.id
    returning id into saved;
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'satisfaction_followup_saved','satisfaction_followup',saved,
    jsonb_build_object('source',p_source,'responseId',p_response,'theme',p_theme));
  return saved;
end;
$$;

revoke all on function cali_session_guard.phase4_low_feedback(uuid) from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_read_pilot_satisfaction(uuid,integer),
  cali_workspace.v2_save_pilot_satisfaction_followup(uuid,text,text,timestamptz,timestamptz,text,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_satisfaction(uuid,integer),
  cali_workspace.v2_save_pilot_satisfaction_followup(uuid,text,text,timestamptz,timestamptz,text,text)
  to authenticated;
notify pgrst,'reload schema';
commit;
