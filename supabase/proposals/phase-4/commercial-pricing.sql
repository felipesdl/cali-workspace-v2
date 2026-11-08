-- FLOW-03. Calculadora do Portal para proposta sintética delegada.
begin;
set local lock_timeout='5s';

-- Tabela de faixas da revisão bd2e965 do Portal. A base continua sintética.
create or replace function cali_session_guard.phase4_commercial_price_band(p_service text,p_package text)
returns table(minimum numeric,maximum numeric,recurring boolean,min_months integer)
language sql immutable set search_path='' as $$
  select lo,hi,monthly,months from (values
    ('cali-build','ESSENCIAL',null::numeric,null::numeric,true,4),
    ('cali-build','COMPLETO',null,null,true,6),
    ('assessoria-estrategica','PARTNER',3900,5800,true,8),
    ('assessoria-estrategica','FULL',6500,8000,true,12),
    ('mentoria-rh','ESSENCIAL',1500,1800,false,1),
    ('mentoria-rh','AMPLIADO',2200,2400,false,1),
    ('diagnostico-executivo','ESSENCIAL',2800,3000,false,1),
    ('diagnostico-executivo','COMPLETO',4000,4500,false,1),
    ('cultura-direcao','PROJETO',3800,4000,false,1),
    ('shadowing-lideranca','CICLO',3500,4000,false,1),
    ('treinamentos','PALESTRA',1800,2500,false,1),
    ('treinamentos','WORKSHOP',2800,3800,false,1),
    ('treinamentos','TREINAMENTO',4000,5000,false,1),
    ('treinamentos','PROGRAMA',null,null,false,1),
    ('marca-empregadora','PROJETO',3800,4000,false,1),
    ('marca-empregadora','RECORRENTE',3200,4000,true,1),
    ('solucao-personalizada','SOB_MEDIDA',2800,null,false,1)
  ) t(service,package,lo,hi,monthly,months) where service=p_service and package=p_package;
$$;

create or replace function cali_session_guard.phase4_price_number(p_value text,p_default numeric)
returns numeric language sql immutable set search_path='' as $$
  select case when btrim(p_value)~'^[+-]?[0-9]{1,10}([.][0-9]{1,10})?$'
    then coalesce(nullif(greatest(0,btrim(p_value)::numeric),0),p_default) else p_default end;
$$;
revoke all on function cali_session_guard.phase4_commercial_price_band(text,text),
  cali_session_guard.phase4_price_number(text,numeric) from public,anon,authenticated,service_role;

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
  people numeric;
  size numeric;
  participants numeric;
  duration numeric;
  groups numeric;
  meetings numeric;
  interviews numeric;
  units numeric;
  effective_extras numeric := p_extras;
  band record;
  calculation jsonb;
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
  where s.id=draft.submission_id and s.service_slug=draft.service_slug
    and (draft.service_slug='cali-build' or g.pilot_package=draft.package_code) and g.pilot_price between 50 and 100000
    and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid'
  for share of s;
  if not found then raise exception using errcode='42501',message='Calculadora indisponível.'; end if;

  select * into band from cali_session_guard.phase4_commercial_price_band(draft.service_slug,draft.package_code);
  if not found then raise exception using errcode='42501',message='Pacote indisponível.'; end if;
  factor:=1;
  case draft.service_slug
    when 'cali-build' then
      size:=cali_session_guard.phase4_price_number(briefing->>'colaboradores',20);
      people:=cali_session_guard.phase4_price_number(briefing->>'pessoas_rh',0);
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
    when 'assessoria-estrategica' then
      size:=cali_session_guard.phase4_price_number(briefing->>'colaboradores',20);
      fronts:=case when jsonb_typeof(briefing->'frentes')='array' then greatest(jsonb_array_length(briefing->'frentes'),1) else 1 end;
      factor:=(case when size<=20 then 1 when size<=50 then 1.08 when size<=100 then 1.15 else 1.22 end)
        *(1+greatest(0,fronts-case when draft.package_code='FULL' then 2 else 1 end)*.06)
        *(case briefing->>'frequencia' when 'semanal' then 1.14 when 'quinzenal' then 1.06 else 1 end);
    when 'treinamentos' then
      groups:=cali_session_guard.phase4_price_number(briefing->>'turmas',1);
      meetings:=cali_session_guard.phase4_price_number(briefing->>'encontros',1);
      participants:=cali_session_guard.phase4_price_number(briefing->>'participantes',20);
      duration:=cali_session_guard.phase4_price_number(briefing->>'carga_horaria',1.5);
      factor:=(1+greatest(0,groups-1)*.18)
        *(1+greatest(0,meetings-case draft.package_code when 'PROGRAMA' then 4 when 'TREINAMENTO' then 3 else 1 end)*.12)
        *(case briefing->>'formato' when 'presencial' then 1.15 when 'hibrido' then 1.2 else 1 end)
        *(case when participants>150 then 1.18 when participants>40 then 1.08 else 1 end)
        *(case when duration<=1 then 1 when duration<=1.5 then 1.05 when duration<=2 then 1.12 when duration<=4 then 1.2 else 1.3 end)
        *(case briefing->>'nivel_interacao' when 'dinamica' then 1.15 when 'interacao' then 1.08 when 'perguntas' then 1.03 else 1 end);
      if briefing->>'materiais'='sim' then effective_extras:=effective_extras+least(participants*groups*25,500); end if;
    when 'mentoria-rh' then
      participants:=case when briefing->>'modalidade'='grupo'
        then cali_session_guard.phase4_price_number(briefing->>'participantes',2) else 1 end;
      factor:=(1+greatest(0,participants-1)*.12)
        *(case briefing->>'duracao_sessao' when '90' then 1.25 else 1 end)
        *(case briefing->>'suporte' when 'proximo' then 1.2 when 'mensagens' then 1.1 else 1 end);
    when 'diagnostico-executivo' then
      people:=case when draft.package_code='COMPLETO' then 6 else 3 end;
      interviews:=cali_session_guard.phase4_price_number(briefing->>'entrevistas',people);
      units:=cali_session_guard.phase4_price_number(briefing->>'unidades',1);
      factor:=(1+greatest(0,interviews-people)*.03)*(1+greatest(0,units-1)*.05)
        *(case briefing->>'documentos' when 'desorganizada' then 1.2 when 'parcial' then 1.1 else 1 end);
    when 'cultura-direcao' then
      interviews:=cali_session_guard.phase4_price_number(briefing->>'entrevistas',4);
      groups:=cali_session_guard.phase4_price_number(briefing->>'grupos',1);
      meetings:=cali_session_guard.phase4_price_number(briefing->>'workshops',1);
      factor:=1+greatest(0,interviews-4)*.03+greatest(0,groups-1)*.06+greatest(0,meetings-1)*.08;
    when 'shadowing-lideranca' then
      factor:=greatest(1,cali_session_guard.phase4_price_number(briefing->>'horas',4)/4);
    when 'marca-empregadora' then
      units:=cali_session_guard.phase4_price_number(briefing->>'unidades',1);
      participants:=cali_session_guard.phase4_price_number(briefing->>'personas',2);
      fronts:=case when jsonb_typeof(briefing->'ativos')='array' then jsonb_array_length(briefing->'ativos') else 1 end;
      factor:=(1+greatest(0,units-1)*.08)*(1+greatest(0,participants-2)*.05)*(1+greatest(0,fronts-3)*.06);
    else null; -- Solução personalizada usa a base e os adicionais.
  end case;
  subtotal_value:=round((base*factor+effective_extras)/50)*50;
  if band.minimum is not null then subtotal_value:=greatest(band.minimum,subtotal_value); end if;
  if band.maximum is not null then subtotal_value:=least(band.maximum,subtotal_value); end if;
  final_value:=subtotal_value-round(subtotal_value*p_discount/100);
  if band.minimum is not null then final_value:=greatest(band.minimum,final_value); end if;
  months:=greatest(p_months,band.min_months);
  calculation:=jsonb_build_object('factor',factor,'discount',p_discount,'manualExtras',p_extras);

  update public.cali_proposals set base_price=base,extras=effective_extras,discount_pct=round(100*(subtotal_value-final_value)/subtotal_value,2),
    subtotal=subtotal_value,final_unit=final_value,total_value=final_value,contract_months=months,
    calculator_data=coalesce(draft.calculator_data,'{}'::jsonb)
      ||jsonb_build_object(case when draft.service_slug='cali-build' then 'pilotBuild' else 'pilotPortfolio' end,calculation),
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
