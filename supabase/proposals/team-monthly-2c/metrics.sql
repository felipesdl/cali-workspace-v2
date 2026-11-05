-- FLOW-08 / DEC-10. Endpoints e auditoria próprios; proteção da escrita direta só no piloto.
begin;
set local lock_timeout='5s';

create table cali_session_guard.team_month_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references cali_workspace.companies(id),
  reference_month date not null,
  domain text not null check(domain in ('metrics','review')),
  revision integer not null check(revision>0),
  actor_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  reason text,
  request_id uuid not null,
  fingerprint text not null,
  before_state jsonb,
  after_state jsonb not null,
  result jsonb not null,
  unique(company_id,request_id),
  unique(company_id,reference_month,domain,revision)
);
alter table cali_session_guard.team_month_events enable row level security;
revoke all on cali_session_guard.team_month_events from public,anon,authenticated,service_role;

create function cali_session_guard.team_month_legacy_allowed(p_company_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select not exists(select 1 from cali_session_guard.pilot_companies where company_id=p_company_id); $$;
revoke all on function cali_session_guard.team_month_legacy_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_session_guard.team_month_legacy_allowed(uuid) to authenticated;
create policy v2_pilot_metrics_insert on cali_workspace.team_month_metrics
  as restrictive for insert to authenticated
  with check(cali_session_guard.team_month_legacy_allowed(company_id));
create policy v2_pilot_metrics_update on cali_workspace.team_month_metrics
  as restrictive for update to authenticated
  using(cali_session_guard.team_month_legacy_allowed(company_id))
  with check(cali_session_guard.team_month_legacy_allowed(company_id));

create function cali_workspace.v2_read_pilot_team_month(p_company_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  if p_month is null or extract(day from p_month)<>1
    or p_month>date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode='22023',message='Selecione um mês válido até a referência atual.';
  end if;
  select jsonb_build_object('companyId',p_company_id,'referenceMonth',p_month,
    'metrics',(select to_jsonb(m) from cali_workspace.team_month_metrics m where m.company_id=p_company_id and m.reference_month=p_month),
    'review',(select jsonb_build_object('revision',r.revision,'confirmedAt',r.confirmed_at,'answers',r.answers)
      from cali_workspace.team_month_reviews r where r.company_id=p_company_id and r.reference_month=p_month),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at desc,e.id) from (
      select id,domain,revision,actor_id,recorded_at,reason
      from cali_session_guard.team_month_events
      where company_id=p_company_id and reference_month=p_month
      order by recorded_at desc,id limit 50
    ) e),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function cali_workspace.v2_write_pilot_team_metrics(
  p_company_id uuid,p_month date,p_expected_at timestamptz,p_fields jsonb,p_reason text,p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=cali_session_guard.require_pilot_team_write(p_company_id,p_month);
  previous cali_workspace.team_month_metrics;
  proposed cali_workspace.team_month_metrics;
  saved cali_workspace.team_month_metrics;
  command cali_session_guard.team_month_events;
  admin boolean;
  fingerprint text:=encode(sha256(convert_to(jsonb_build_array('metrics',p_month,p_expected_at,p_fields,p_reason)::text,'UTF8')),'hex');
  revision integer;
  result jsonb;
  key text;
  allowed constant text[]:=array['planned_hours','absence_medical_hours','absence_leave_hours','absence_unjustified_hours',
    'absence_accident_hours','overtime_hours','hour_bank_balance','approved_headcount','enps_score','climate_score','climate_participation','notes'];
begin
  if p_request_id is null then raise exception using errcode='22023',message='Identificação da operação ausente.'; end if;
  select * into command from cali_session_guard.team_month_events where company_id=p_company_id and request_id=p_request_id;
  if command.id is not null then
    if command.actor_id<>actor or command.fingerprint<>fingerprint then
      raise exception using errcode='22023',message='Identificação já usada por outra operação.';
    end if;
    return command.result;
  end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object'
    or exists(select 1 from jsonb_object_keys(p_fields) k where k<>all(allowed)) then
    raise exception using errcode='22023',message='Campos mensais inválidos.';
  end if;
  select * into previous from cali_workspace.team_month_metrics
    where company_id=p_company_id and reference_month=p_month for update;
  select role::text='admin' into admin from cali_workspace.profiles where id=actor;
  if previous.company_id is null and admin then
    raise exception using errcode='42501',message='O primeiro lançamento é realizado pelo Cliente.';
  end if;
  if previous.company_id is not null and not admin then
    raise exception using errcode='42501',message='Após gravado, solicite a correção à CALI.';
  end if;
  if previous.updated_at is distinct from p_expected_at then
    raise exception using errcode='40001',message='Dados mensais alterados. Recarregue antes de salvar.';
  end if;
  if admin and (length(btrim(coalesce(p_reason,''))) not between 3 and 500) then
    raise exception using errcode='22023',message='Informe o motivo da correção, entre 3 e 500 caracteres.';
  end if;
  if length(coalesce(p_reason,''))>500 then
    raise exception using errcode='22023',message='O motivo deve ter até 500 caracteres.';
  end if;
  -- Validação anterior ao cast evita arredondamento silencioso e tipos JSON ambíguos.
  foreach key in array allowed loop
    if key=any(array['approved_headcount','notes']) then continue; end if;
    if p_fields ? key and jsonb_typeof(p_fields->key) not in ('null','number') then
      raise exception using errcode='22023',message='Use números nos campos mensais.';
    end if;
    if p_fields->>key is not null and (
      (key<>all(array['hour_bank_balance','enps_score']) and (p_fields->>key)::numeric<0)
      or (key='enps_score' and (p_fields->>key)::numeric not between -100 and 100)
      or (key='climate_score' and (p_fields->>key)::numeric>10)
      or (key='climate_participation' and (p_fields->>key)::numeric>100)
    ) then
      raise exception using errcode='22023',message='Confira os limites dos dados mensais.';
    end if;
  end loop;
  if p_fields ? 'enps_score' and p_fields->>'enps_score' is not null
    and (p_fields->>'enps_score')::numeric<>trunc((p_fields->>'enps_score')::numeric) then
    raise exception using errcode='22023',message='Informe eNPS inteiro, entre -100 e 100.';
  end if;
  if p_fields ? 'notes' and jsonb_typeof(p_fields->'notes') not in ('null','string') then
    raise exception using errcode='22023',message='Observação mensal inválida.';
  end if;
  select * into proposed from jsonb_populate_record(previous,p_fields);
  proposed.approved_headcount:=coalesce(proposed.approved_headcount,'{}'::jsonb);
  if jsonb_typeof(proposed.approved_headcount)<>'object' then
    raise exception using errcode='22023',message='Informe o quadro aprovado por departamento.';
  end if;
  if exists(select 1 from jsonb_each(proposed.approved_headcount) e
    where length(btrim(e.key)) not between 1 and 180 or jsonb_typeof(e.value)<>'number') then
    raise exception using errcode='22023',message='Departamento ou quadro aprovado inválido.';
  end if;
  if exists(select 1 from jsonb_each_text(proposed.approved_headcount) e
    where e.value::numeric<0 or e.value::numeric<>trunc(e.value::numeric)) then
    raise exception using errcode='22023',message='Quadro aprovado deve conter contagens inteiras não negativas.';
  end if;
  if length(coalesce(proposed.notes,''))>5000 then
    raise exception using errcode='22023',message='A observação deve ter até 5.000 caracteres.';
  end if;
  insert into cali_workspace.team_month_metrics(
    company_id,reference_month,planned_hours,absence_medical_hours,absence_leave_hours,absence_unjustified_hours,
    absence_accident_hours,overtime_hours,hour_bank_balance,approved_headcount,enps_score,climate_score,climate_participation,notes,updated_by
  ) values(
    p_company_id,p_month,proposed.planned_hours,proposed.absence_medical_hours,proposed.absence_leave_hours,proposed.absence_unjustified_hours,
    proposed.absence_accident_hours,proposed.overtime_hours,proposed.hour_bank_balance,proposed.approved_headcount,proposed.enps_score,
    proposed.climate_score,proposed.climate_participation,nullif(btrim(proposed.notes),''),actor
  ) on conflict(company_id,reference_month) do update set
    planned_hours=excluded.planned_hours,absence_medical_hours=excluded.absence_medical_hours,
    absence_leave_hours=excluded.absence_leave_hours,absence_unjustified_hours=excluded.absence_unjustified_hours,
    absence_accident_hours=excluded.absence_accident_hours,overtime_hours=excluded.overtime_hours,
    hour_bank_balance=excluded.hour_bank_balance,approved_headcount=excluded.approved_headcount,enps_score=excluded.enps_score,
    climate_score=excluded.climate_score,climate_participation=excluded.climate_participation,notes=excluded.notes,updated_by=actor
  returning * into saved;
  select coalesce(max(e.revision),0)+1 into revision from cali_session_guard.team_month_events e
    where e.company_id=p_company_id and e.reference_month=p_month and e.domain='metrics';
  result:=jsonb_build_object('updatedAt',saved.updated_at,'revision',revision);
  insert into cali_session_guard.team_month_events(company_id,reference_month,domain,revision,actor_id,reason,request_id,fingerprint,before_state,after_state,result)
    values(p_company_id,p_month,'metrics',revision,actor,nullif(btrim(p_reason),''),p_request_id,fingerprint,
      case when previous.company_id is null then null else to_jsonb(previous) end,to_jsonb(saved),result);
  return result;
exception when check_violation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='Confira os limites das horas, do eNPS e da pesquisa de clima.';
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_team_month(uuid,date),
  cali_workspace.v2_write_pilot_team_metrics(uuid,date,timestamptz,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_team_month(uuid,date),
  cali_workspace.v2_write_pilot_team_metrics(uuid,date,timestamptz,jsonb,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
