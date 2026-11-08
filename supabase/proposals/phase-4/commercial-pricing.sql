-- FLOW-03. Calculadora CALI Build para a proposta sintética delegada.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_price_pilot_commercial_draft(
  p_company_id uuid,p_proposal_id uuid,p_expected timestamptz,p_extras numeric,p_discount numeric,p_months integer
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_commercial_proposal(p_company_id,p_proposal_id);
  draft public.cali_proposals%rowtype;
  briefing jsonb;
  base numeric;
  people integer;
  size integer;
  fronts integer;
  complete boolean;
  ratio numeric;
  factor numeric;
  subtotal_value numeric;
  final_value numeric;
  months integer;
begin
  if p_expected is null or p_extras is null or p_extras not between 0 and 100000
    or p_discount is null or p_discount not between 0 and 50 or p_months is null or p_months not between 1 and 60
    or p_extras<>round(p_extras,2) or p_discount<>round(p_discount,2) then
    raise exception using errcode='22023',message='Confira adicionais, desconto e duração.';
  end if;
  select p.* into draft from public.cali_proposals p
  join cali_session_guard.phase4_commercial_scope g on g.proposal_id=p.id and g.submission_id=p.submission_id
  where p.id=p_proposal_id for update of p;
  if not found or draft.status<>'rascunho' or draft.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='A proposta mudou. Atualize a consulta.';
  end if;
  select s.answers,g.pilot_price into briefing,base from public.cali_submissions s
  join cali_session_guard.phase4_commercial_scope g on g.submission_id=s.id
  where s.id=draft.submission_id and s.service_slug='cali-build' and draft.service_slug='cali-build'
    and draft.package_code in ('ESSENCIAL','COMPLETO') and g.pilot_price between 50 and 100000
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for share of s;
  if not found then raise exception using errcode='42501',message='Calculadora indisponível.'; end if;

  size:=coalesce(nullif(briefing->>'colaboradores','')::integer,20);
  people:=coalesce(nullif(briefing->>'pessoas_rh','')::integer,0);
  fronts:=case when jsonb_typeof(briefing->'frentes')='array' then jsonb_array_length(briefing->'frentes') else 0 end;
  complete:=draft.package_code='COMPLETO';
  ratio:=case when people>0 then size::numeric/people else size end;
  factor:=1
    +case when size<=50 then 0 when size<=100 then .05 when size<=250 then .12
      when size<=500 then .20 when size<=1000 then .28 else .35 end
    +case briefing->>'escopo_build' when 'rh_completo' then .10 when 'multiplas_frentes' then .07 else 0 end
    +least(.15,greatest(0,fronts-case when complete then 3 else 1 end)*.03)
    +case briefing->>'capacidade_execucao' when 'menos2' then .08 when '2a4' then .05 when '5a8' then .02 else 0 end
    +case when ratio>250 then .10 when ratio>150 then .07 when ratio>100 then .04 else 0 end
    +case briefing->>'cadencia_build' when 'semanal' then .05 when 'quinzenal' then .02 else 0 end
    +case when briefing->>'ponto_partida'='zero' then .04 else 0 end;
  subtotal_value:=round((base*factor+p_extras)/50)*50;
  final_value:=subtotal_value-round(subtotal_value*p_discount/100);
  months:=greatest(p_months,case when complete then 6 else 4 end);

  update public.cali_proposals set base_price=base,extras=p_extras,discount_pct=round(100*(subtotal_value-final_value)/subtotal_value,2),
    subtotal=subtotal_value,final_unit=final_value,total_value=final_value,contract_months=months,
    calculator_data=coalesce(draft.calculator_data,'{}'::jsonb)
      ||jsonb_build_object('pilotBuild',jsonb_build_object('factor',factor,'discount',p_discount)),
    updated_at=clock_timestamp() where id=draft.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'commercial_proposal_edited','commercial_proposal',draft.id,
    jsonb_build_object('version',draft.version,'section','pricing'));
  return draft.id;
end;
$$;
revoke all on function cali_workspace.v2_price_pilot_commercial_draft(uuid,uuid,timestamptz,numeric,numeric,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_price_pilot_commercial_draft(uuid,uuid,timestamptz,numeric,numeric,integer)
  to authenticated;
notify pgrst,'reload schema';
commit;
