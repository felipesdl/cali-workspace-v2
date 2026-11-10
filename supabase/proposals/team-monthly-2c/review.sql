-- Confirmação separada do cadastro e das métricas. Preimagem inclui o quadro e as vagas.
begin;
set local lock_timeout='5s';
create function cali_session_guard.team_review_token(p_company_id uuid,p_month date)
returns text language sql stable security definer set search_path=''
as $$
 select encode(sha256(convert_to(jsonb_build_array(p_company_id,p_month,
  (select coalesce(jsonb_agg(jsonb_build_array(id,updated_at) order by id),'[]')
    from cali_workspace.team_members where company_id=p_company_id),
  (select coalesce(jsonb_agg(jsonb_build_array(id,updated_at) order by id),'[]')
    from cali_workspace.team_vacancies where company_id=p_company_id),
  (select revision from cali_workspace.team_month_reviews where company_id=p_company_id and reference_month=p_month),
  (select updated_at from cali_workspace.team_month_metrics where company_id=p_company_id and reference_month=p_month)
 )::text,'UTF8')),'hex');
$$;
revoke all on function cali_session_guard.team_review_token(uuid,date) from public,anon,authenticated,service_role;

create function cali_workspace.v2_read_pilot_team_review(p_company_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 result jsonb;
 current_month date:=date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date;
 month_end date:=(p_month+interval '1 month'-interval '1 day')::date;
begin
 perform cali_session_guard.require_pilot_team_actor(p_company_id);
 if p_month is null or extract(day from p_month)<>1 or p_month>current_month then
  raise exception using errcode='22023',message='Selecione um mês válido até a referência atual.';
 end if;
 with periods as (
  select m.reference_month,m.revision,m.confirmed_at from cali_workspace.team_months m
   where m.company_id=p_company_id and m.reference_month between (p_month-interval '11 months')::date and p_month
 ), series as (
  select p.reference_month,p.revision,p.confirmed_at,
   (select count(*) from cali_workspace.team_month_snapshots s
     where s.company_id=p_company_id and s.reference_month=p.reference_month and s.status='active'
       and (p.reference_month<>current_month or not exists(select 1 from cali_workspace.team_members m where m.id=s.member_id and m.archived_at is not null))) as active,
   (select count(*) from cali_workspace.team_changes t where t.company_id=p_company_id and t.change_type='admission'
     and left(t.after_state->>'admission_date',7)=to_char(p.reference_month,'YYYY-MM')) as admissions,
   (select count(*) from cali_workspace.team_changes t where t.company_id=p_company_id and t.change_type='termination'
     and left(t.after_state->>'termination_date',7)=to_char(p.reference_month,'YYYY-MM')) as exits,
   (select count(*) from cali_workspace.team_changes t where t.company_id=p_company_id and t.reference_month=p.reference_month
     and t.change_type in ('promotion','transfer','manager_change')) as moves
  from periods p
 )
 select jsonb_build_object('companyId',p_company_id,'referenceMonth',p_month,
  'token',cali_session_guard.team_review_token(p_company_id,p_month),
  'draftPeople',(select count(*) from cali_workspace.team_members where company_id=p_company_id and archived_at is null and admission_date<=month_end),
  'vacancyTotal',(select count(*) from cali_workspace.team_vacancies where company_id=p_company_id and opened_on<=month_end and (closed_on is null or closed_on>=p_month)),
  'vacancies',coalesce((select jsonb_agg(to_jsonb(v) order by v.vacancy_code) from (
    select vacancy_code,title,department,opened_on,status,closed_on from cali_workspace.team_vacancies
    where company_id=p_company_id and opened_on<=month_end and (closed_on is null or closed_on>=p_month)
    order by vacancy_code limit 200
  ) v),'[]'::jsonb),
  'summary',(select jsonb_build_object('active',s.active,'moves',s.moves,
    'admissions',(select count(*) from cali_workspace.team_changes t where t.company_id=p_company_id and t.change_type='admission'
      and left(t.after_state->>'admission_date',7)=to_char(p_month,'YYYY-MM')
      and (p_month<>current_month or not exists(select 1 from cali_workspace.team_members m where m.id=t.member_id and m.archived_at is not null))),
    'exits',(select count(*) from cali_workspace.team_changes t where t.company_id=p_company_id and t.change_type='termination'
      and left(t.after_state->>'termination_date',7)=to_char(p_month,'YYYY-MM')
      and (p_month<>current_month or not exists(select 1 from cali_workspace.team_members m where m.id=t.member_id and m.archived_at is not null)))
  ) from series s where s.reference_month=p_month),
  'series',coalesce((select jsonb_agg(to_jsonb(s) order by s.reference_month) from series s),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;

create function cali_workspace.v2_confirm_pilot_team_month(
 p_company_id uuid,p_month date,p_expected_token text,p_vacancies jsonb,p_reason text,p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=cali_session_guard.require_pilot_team_write(p_company_id,p_month);
 command cali_session_guard.team_month_events;
 fingerprint text:=encode(sha256(convert_to(jsonb_build_array('review',p_month,p_expected_token,p_vacancies,p_reason)::text,'UTF8')),'hex');
 previous cali_workspace.team_month_reviews;
 saved cali_workspace.team_month_reviews;
 vacancy cali_workspace.team_vacancies;
 prior_vacancy cali_workspace.team_vacancies;
 item jsonb;
 before_snapshots jsonb;
 after_snapshots jsonb;
 result jsonb;
 answers jsonb;
 month_end date:=(p_month+interval '1 month'-interval '1 day')::date;
 today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date;
 revision integer;
 allowed constant text[]:=array['vacancy_code','title','department','opened_on','status','closed_on'];
begin
 if p_request_id is null then raise exception using errcode='22023',message='Identificação da operação ausente.'; end if;
 select * into command from cali_session_guard.team_month_events where company_id=p_company_id and request_id=p_request_id;
 if command.id is not null then
  if command.actor_id<>actor or command.fingerprint<>fingerprint then
   raise exception using errcode='22023',message='Identificação já usada por outra operação.';
  end if;
  return command.result;
 end if;
 if p_expected_token is null or p_expected_token is distinct from cali_session_guard.team_review_token(p_company_id,p_month) then
  raise exception using errcode='40001',message='A equipe ou os dados do mês mudaram. Recarregue antes de confirmar.';
 end if;
 if p_vacancies is null or jsonb_typeof(p_vacancies)<>'array' or jsonb_array_length(p_vacancies)>200 then
  raise exception using errcode='22023',message='Confira até 200 vagas por confirmação.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_vacancies) x
  group by btrim(x.value->>'vacancy_code') having count(*)>1) then
  raise exception using errcode='22023',message='Há códigos de vaga repetidos.';
 end if;
 select * into previous from cali_workspace.team_month_reviews where company_id=p_company_id and reference_month=p_month for update;
 if length(coalesce(p_reason,''))>500 or (previous.company_id is not null
  and exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin')
  and length(btrim(coalesce(p_reason,'')))<3) then
  raise exception using errcode='22023',message='Informe um motivo de revisão, entre 3 e 500 caracteres.';
 end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.member_id),'[]') into before_snapshots
  from cali_workspace.team_month_snapshots s where s.company_id=p_company_id and s.reference_month=p_month;
 for item in select value from jsonb_array_elements(p_vacancies) loop
  if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k<>all(allowed)) then
   raise exception using errcode='22023',message='Campos de vaga inválidos.';
  end if;
  select * into vacancy from jsonb_populate_record(null::cali_workspace.team_vacancies,item);
  vacancy.vacancy_code:=btrim(vacancy.vacancy_code);
  vacancy.title:=btrim(vacancy.title);
  vacancy.department:=nullif(btrim(vacancy.department),'');
  if vacancy.vacancy_code is null or length(vacancy.vacancy_code) not between 1 and 80
   or vacancy.title is null or length(vacancy.title) not between 2 and 180
   or length(coalesce(vacancy.department,''))>180 or vacancy.opened_on is null
   or vacancy.opened_on>least(today,month_end) or vacancy.status is null or vacancy.status not in ('open','filled','cancelled')
   or (vacancy.status='open' and vacancy.closed_on is not null)
   or (vacancy.status<>'open' and (vacancy.closed_on is null or vacancy.closed_on<vacancy.opened_on or vacancy.closed_on>today)) then
   raise exception using errcode='22023',message='Confira código, título, datas e situação da vaga.';
  end if;
  select * into prior_vacancy from cali_workspace.team_vacancies where company_id=p_company_id and vacancy_code=vacancy.vacancy_code for update;
  if prior_vacancy.id is not null and prior_vacancy.opened_on<>vacancy.opened_on then
   raise exception using errcode='22023',message='A abertura da vaga existente deve ser preservada.';
  end if;
  if prior_vacancy.id is null or (to_jsonb(prior_vacancy)-array['id','company_id','created_at','updated_at','updated_by']) is distinct from
   jsonb_build_object('vacancy_code',vacancy.vacancy_code,'title',vacancy.title,'department',vacancy.department,'opened_on',vacancy.opened_on,'status',vacancy.status,'closed_on',vacancy.closed_on) then
   insert into cali_workspace.team_vacancies(company_id,vacancy_code,title,department,opened_on,status,closed_on,updated_by)
   values(p_company_id,vacancy.vacancy_code,vacancy.title,vacancy.department,vacancy.opened_on,vacancy.status,vacancy.closed_on,actor)
   on conflict(company_id,vacancy_code) do update set title=excluded.title,department=excluded.department,status=excluded.status,closed_on=excluded.closed_on,updated_by=actor
   returning * into vacancy;
   insert into cali_workspace.team_vacancy_events(vacancy_id,company_id,before_state,after_state,actor_user_id)
   values(vacancy.id,p_company_id,case when prior_vacancy.id is null then null else to_jsonb(prior_vacancy) end,to_jsonb(vacancy),actor);
  end if;
 end loop;
 insert into cali_workspace.team_months(company_id,reference_month,confirmed_by)
 values(p_company_id,p_month,actor) on conflict(company_id,reference_month) do update
  set confirmed_by=actor,confirmed_at=clock_timestamp(),revision=cali_workspace.team_months.revision+1
 returning cali_workspace.team_months.revision into revision;
 delete from cali_workspace.team_month_snapshots where company_id=p_company_id and reference_month=p_month;
 insert into cali_workspace.team_month_snapshots(company_id,reference_month,member_id,status,department,manager_code,job_title,seniority,employment_type,admission_date,termination_date)
 select company_id,p_month,id,
  case when status='terminated' and termination_date>month_end then 'active' else status end,
  department,manager_code,job_title,seniority,employment_type,admission_date,
  case when termination_date>month_end then null else termination_date end
 from cali_workspace.team_members where company_id=p_company_id and archived_at is null and admission_date<=month_end;
 select jsonb_build_object(
  'admissions',count(*) filter(where change_type='admission' and left(after_state->>'admission_date',7)=to_char(p_month,'YYYY-MM')),
  'departures',count(*) filter(where change_type='termination' and left(after_state->>'termination_date',7)=to_char(p_month,'YYYY-MM')),
  'changes',count(*) filter(where reference_month=p_month and change_type in ('promotion','transfer','manager_change')),
  'vacancies',(select count(*) from cali_workspace.team_vacancies where company_id=p_company_id and opened_on<=month_end and (closed_on is null or closed_on>=p_month))
 ) into answers from cali_workspace.team_changes where company_id=p_company_id;
 insert into cali_workspace.team_month_reviews(company_id,reference_month,answers,confirmed_by,revision)
 values(p_company_id,p_month,answers,actor,revision) on conflict(company_id,reference_month) do update
 set answers=excluded.answers,confirmed_by=actor,confirmed_at=clock_timestamp(),revision=excluded.revision returning * into saved;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.member_id),'[]') into after_snapshots
  from cali_workspace.team_month_snapshots s where s.company_id=p_company_id and s.reference_month=p_month;
 result:=jsonb_build_object('updatedAt',saved.confirmed_at,'revision',revision);
 insert into cali_session_guard.team_month_events(company_id,reference_month,domain,revision,actor_id,reason,request_id,fingerprint,before_state,after_state,result)
 values(p_company_id,p_month,'review',revision,actor,nullif(btrim(p_reason),''),p_request_id,fingerprint,
  case when previous.company_id is null then null else jsonb_build_object('review',to_jsonb(previous),'snapshots',before_snapshots) end,
  jsonb_build_object('review',to_jsonb(saved),'snapshots',after_snapshots),result);
 return result;
exception when invalid_datetime_format or datetime_field_overflow then
 raise exception using errcode='22023',message='Data da vaga inválida.';
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_team_review(uuid,date),
 cali_workspace.v2_confirm_pilot_team_month(uuid,date,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_team_review(uuid,date),
 cali_workspace.v2_confirm_pilot_team_month(uuid,date,text,jsonb,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
