-- DEC-29: resumo por mês ou histórico completo para a tela e o PDF de satisfação.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_read_pilot_satisfaction_period(
  p_company_id uuid,p_month date,p_page integer
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000
    or (p_month is not null and (p_month not between date '1900-01-01' and date '9999-12-01'
      or extract(day from p_month)<>1)) then
    raise exception using errcode='22023',message='Recorte inválido.';
  end if;
  return (
    with all_feedback as (
      select 'record'::text source,f.id::text response,r.title,f.score::integer score,
        f.comment,f.created_at rated_at
      from cali_workspace.account_record_feedback f
      join cali_workspace.account_records r on r.id=f.record_id and r.company_id=f.company_id
      where f.company_id=p_company_id and f.score between 1 and 5
      union all
      select 'deliverable',f.id::text,d.title,f.score::integer,f.comment,f.created_at
      from cali_workspace.nps_responses f
      join cali_workspace.deliverables d on d.id=f.deliverable_id and d.company_id=f.company_id
      where f.company_id=p_company_id and f.score between 1 and 5
      union all
      select 'deliverable','correction:'||f.id,d.title,f.score,f.comment,f.approved_at
      from cali_session_guard.phase4_delivery_corrections f
      join cali_workspace.deliverables d on d.id=f.delivery_id and d.company_id=f.company_id
      where f.company_id=p_company_id and f.score between 1 and 5 and f.approved_at is not null
    ), filtered as (
      select * from all_feedback f where p_month is null or
        (f.rated_at >= (p_month::timestamp at time zone 'America/Sao_Paulo') and
         f.rated_at < ((p_month+interval '1 month') at time zone 'America/Sao_Paulo'))
    ), trend as (
      select date_trunc('month',rated_at at time zone 'America/Sao_Paulo')::date as month_start,
        count(*)::integer total,round(avg(score)::numeric,2) average,
        count(*) filter(where score<=3)::integer attention,
        count(*) filter(where score>=4)::integer positive
      from filtered group by 1
    ), selected as (
      select f.*,case when t.id is not null then jsonb_build_object(
        'theme',t.theme,'note',t.note,'handledAt',t.handled_at) end followup
      from filtered f left join cali_workspace.satisfaction_followups t
        on t.company_id=p_company_id and t.source_type=f.source and t.response_id=f.response
      where f.score<=3
      order by f.rated_at desc,f.source,f.response limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object(
      'companyId',p_company_id,'month',p_month,
      'average',(select round(avg(score)::numeric,2) from filtered),
      'total',(select count(*) from filtered),
      'attentionTotal',(select count(*) from filtered where score<=3),
      'distribution',(select jsonb_agg(jsonb_build_object('score',s.score,'total',coalesce(d.total,0)) order by s.score)
        from generate_series(1,5) s(score) left join (select score,count(*) total from filtered group by score) d using(score)),
      'trend',coalesce((select jsonb_agg(jsonb_build_object('month',t.month_start,'total',t.total,
        'average',t.average,'attention',t.attention,'positive',t.positive) order by t.month_start)
        from trend t),'[]'::jsonb),
      'entries',coalesce((select jsonb_agg(jsonb_build_object('source',source,'response',response,'title',title,
        'score',score,'comment',comment,'ratedAt',rated_at,'followup',followup)
        order by rated_at desc,source,response) from selected),'[]'::jsonb)
    )
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_satisfaction_period(uuid,date,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_satisfaction_period(uuid,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
