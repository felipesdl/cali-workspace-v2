-- FLOW-17: leitura do diagnóstico, sob a mesma delegação da triagem.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_mapa_average(p_values jsonb)
returns numeric language sql immutable set search_path='' as $$
  select avg((item#>>'{}')::numeric) * 2
  from jsonb_array_elements(case jsonb_typeof(p_values)
    when 'array' then p_values when 'number' then jsonb_build_array(p_values) else '[]'::jsonb end) item
  where case when jsonb_typeof(item)='number' then (item#>>'{}')::numeric between 0 and 5 else false end;
$$;
revoke all on function cali_session_guard.phase4_mapa_average(jsonb) from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_read_pilot_mapa_report(p_company_id uuid,p_record_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  r public.mapa_respostas%rowtype;
  diagnosis jsonb;
  protocol_version integer;
  dimensions numeric[];
  subscores numeric[];
  a numeric;
  b numeric;
  c numeric;
  d numeric;
  score numeric;
begin
  select response.* into r from cali_session_guard.phase4_mapa_scope g
  join public.mapa_respostas response on response.id=g.record_id
  where g.company_id=p_company_id and g.record_id=p_record_id and g.operator_id=actor
    and g.expires_at>statement_timestamp() and response.protocolo like 'CALI-QA-V2-MAPA-%'
    and response.c_email like '%@example.invalid';
  if not found then return null; end if;
  diagnosis:=r.diagnostico_v2;
  if diagnosis->'version'='2'::jsonb then
    protocol_version:=2;
    subscores:=array[
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d1,processos}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d1,estrutura}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d1,governanca}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d2,comportamento}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d2,valores,cultura_decisao}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d2,desenvolvimento}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d3,indicadores}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d3,decisao}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d3,tecnologia}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d4,tamanho}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d4,vinculos,gestao}'),
      cali_session_guard.phase4_mapa_average(diagnosis#>'{d4,rotatividade}')
    ];
    if array_position(subscores,null) is not null then return null; end if;
    select array_agg(value order by dimension) into dimensions from (
      select (position-1)/3 as dimension,avg(value) as value
      from unnest(subscores) with ordinality as inputs(value,position) group by 1
    ) sub;
  else
    protocol_version:=1;
    dimensions:=array[
      cali_session_guard.phase4_mapa_average(jsonb_build_array(r.d1_rh_hoje,r.d1_processos,r.d1_cargos_salarios)),
      cali_session_guard.phase4_mapa_average(jsonb_build_array(r.d2_valores,r.d2_lideres_preparo,r.d2_comportamento_dono,r.d2_sucessao)),
      cali_session_guard.phase4_mapa_average(jsonb_build_array(r.d3_indicadores,r.d3_decisao,r.d3_custo)),
      cali_session_guard.phase4_mapa_average(jsonb_build_array(r.d4_colaboradores,r.d4_unidades,r.d4_turnover))
    ];
    if array_position(dimensions,null) is not null then return null; end if;
  end if;
  a:=dimensions[1]; b:=dimensions[2]; c:=dimensions[3]; d:=dimensions[4];
  score:=a*.25+b*.30+c*.20+d*.25;
  return jsonb_build_object('companyId',p_company_id,'recordId',p_record_id,'version',protocol_version,
    'dimensions',dimensions,'subscores',subscores,'score',round(score,1));
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_mapa_report(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_mapa_report(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
