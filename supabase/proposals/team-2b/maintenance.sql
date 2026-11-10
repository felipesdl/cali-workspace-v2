-- Cadastro e movimentações. A confirmação mensal tem operação própria na 2C.
begin;
set local lock_timeout = '5s';

create function cali_session_guard.require_pilot_team_write(p_company_id uuid,p_month date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  current_month date := date_trunc('month',statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if p_month is null or p_month not in (current_month,(current_month-interval '1 month')::date) then
    raise exception using errcode='22023', message='Selecione o mês atual ou o anterior.';
  end if;
  -- Todos os escritores V2 usam o mesmo lock de empresa. CAS cobre atualizações legadas por linha.
  perform pg_advisory_xact_lock(hashtextextended('cali:v2:team:'||p_company_id::text,0));
  perform cali_session_guard.require_pilot_team_actor(p_company_id);
  if not exists (select 1 from cali_workspace.companies where id=p_company_id and status::text='active') then
    raise exception using errcode='42501', message='Equipe indisponível para edição.';
  end if;
  return actor;
end;
$$;

create function cali_workspace.v2_save_pilot_team(p_company_id uuid,p_month date,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_write(p_company_id,p_month);
  input jsonb;
  patch jsonb;
  expected timestamptz;
  original cali_workspace.team_members;
  proposed cali_workspace.team_members;
  previous jsonb;
  latest jsonb;
  kind text;
  saved_ids uuid[] := array[]::uuid[];
  checked_managers text[] := array[]::text[];
  added integer := 0;
  changed integer := 0;
  permitted constant text[] := array[
    'employee_code','full_name','work_email','work_phone','admission_date','job_title',
    'seniority','department','team_area','manager_code','is_leader','employment_type',
    'weekly_hours','work_model','location','status','leave_reason','leave_start_date',
    'expected_return_date','termination_date','termination_initiative','termination_reason','notice_type'
  ];
  ignored constant text[] := array['id','company_id','created_at','updated_at','archived_by','avatar_style'];
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception using errcode='22023', message='Lote de Equipe inválido.';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception using errcode='22023', message='Envie de 1 a 2.000 fichas.';
  end if;
  if (select count(distinct btrim(item->'fields'->>'employee_code')) from jsonb_array_elements(p_rows) item)
    <> jsonb_array_length(p_rows) then
    raise exception using errcode='22023', message='Código ausente ou duplicado no lote.';
  end if;
  for input in select value from jsonb_array_elements(p_rows) order by btrim(value->'fields'->>'employee_code') loop
    patch := input->'fields';
    if jsonb_typeof(input)<>'object' or not (input ?& array['fields','expectedAt'])
      or input - array['fields','expectedAt'] <> '{}'::jsonb
      or jsonb_typeof(patch) is distinct from 'object'
      or patch - permitted <> '{}'::jsonb then
      raise exception using errcode='22023', message='Campos de Equipe inválidos.';
    end if;
    expected := (input->>'expectedAt')::timestamptz;
    select * into original from cali_workspace.team_members
      where company_id=p_company_id and employee_code=btrim(patch->>'employee_code') for update;
    if original.updated_at is distinct from expected then
      raise exception using errcode='40001', message='Ficha mudou. Atualize a prévia ou recarregue.';
    end if;

    select * into proposed from jsonb_populate_record(original,patch);
    proposed.employee_code := btrim(proposed.employee_code);
    proposed.full_name := btrim(proposed.full_name);
    proposed.job_title := btrim(proposed.job_title);
    proposed.department := btrim(proposed.department);
    proposed.manager_code := nullif(btrim(proposed.manager_code),'');
    proposed.status := coalesce(proposed.status,'active');
    proposed.employment_type := coalesce(nullif(btrim(proposed.employment_type),''),'clt');
    proposed.is_leader := coalesce(proposed.is_leader,false);
    proposed.archived_at := null;

    if coalesce(length(proposed.employee_code),0) not between 1 and 60
      or coalesce(length(proposed.full_name),0) not between 2 and 180
      or coalesce(length(proposed.job_title),0) not between 1 and 180
      or coalesce(length(proposed.department),0) not between 1 and 180
      or proposed.admission_date is null
      or proposed.manager_code=proposed.employee_code
      or proposed.status not in ('active','leave','terminated')
      or (proposed.weekly_hours is not null and proposed.weekly_hours not between 0 and 80) then
      raise exception using errcode='22023', message='Confira identificação, vínculo e gestão direta.';
    end if;
    if proposed.status <> 'leave' then
      proposed.leave_reason := null;
      proposed.leave_start_date := null;
      proposed.expected_return_date := null;
    elsif proposed.leave_start_date is null or proposed.leave_start_date<proposed.admission_date
      or proposed.expected_return_date<proposed.leave_start_date then
      raise exception using errcode='22023', message='Confira as datas do afastamento.';
    end if;
    if proposed.status <> 'terminated' then
      proposed.termination_date := null;
      proposed.termination_initiative := null;
      proposed.termination_reason := null;
      proposed.notice_type := null;
    elsif proposed.termination_date is null or proposed.termination_date<proposed.admission_date then
      raise exception using errcode='22023', message='Confira a data de desligamento.';
    end if;

    previous := case when original.id is not null then to_jsonb(original)-ignored end;
    latest := to_jsonb(proposed)-ignored;
    if previous is not distinct from latest then
      saved_ids := array_append(saved_ids,original.id);
      continue;
    end if;
    if proposed.manager_code is distinct from original.manager_code or original.archived_at is not null then
      checked_managers := array_append(checked_managers,proposed.employee_code);
    end if;

    if original.id is null then
      insert into cali_workspace.team_members(company_id,employee_code,full_name,work_email,work_phone,
        admission_date,job_title,seniority,department,team_area,manager_code,is_leader,employment_type,
        weekly_hours,work_model,location,status,leave_reason,leave_start_date,expected_return_date,
        termination_date,termination_initiative,termination_reason,notice_type)
      values(p_company_id,proposed.employee_code,proposed.full_name,proposed.work_email,proposed.work_phone,
        proposed.admission_date,proposed.job_title,proposed.seniority,proposed.department,proposed.team_area,
        proposed.manager_code,proposed.is_leader,proposed.employment_type,proposed.weekly_hours,proposed.work_model,
        proposed.location,proposed.status,proposed.leave_reason,proposed.leave_start_date,proposed.expected_return_date,
        proposed.termination_date,proposed.termination_initiative,proposed.termination_reason,proposed.notice_type)
      returning id into proposed.id;
      added := added+1;
    else
      update cali_workspace.team_members set full_name=proposed.full_name,work_email=proposed.work_email,
        work_phone=proposed.work_phone,admission_date=proposed.admission_date,job_title=proposed.job_title,
        seniority=proposed.seniority,department=proposed.department,team_area=proposed.team_area,
        manager_code=proposed.manager_code,is_leader=proposed.is_leader,employment_type=proposed.employment_type,
        weekly_hours=proposed.weekly_hours,work_model=proposed.work_model,location=proposed.location,status=proposed.status,
        leave_reason=proposed.leave_reason,leave_start_date=proposed.leave_start_date,expected_return_date=proposed.expected_return_date,
        termination_date=proposed.termination_date,termination_initiative=proposed.termination_initiative,
        termination_reason=proposed.termination_reason,notice_type=proposed.notice_type,archived_at=null,archived_by=null
      where id=original.id and company_id=p_company_id;
    end if;

    kind := case
      when original.id is null then 'admission'
      when original.status<>'terminated' and proposed.status='terminated' then 'termination'
      when original.status='active' and proposed.status='leave' then 'leave'
      when original.status='leave' and proposed.status='active' then 'return'
      when original.department is distinct from proposed.department then 'transfer'
      when original.job_title is distinct from proposed.job_title or original.seniority is distinct from proposed.seniority then 'promotion'
      when original.manager_code is distinct from proposed.manager_code then 'manager_change'
      when original.employment_type is distinct from proposed.employment_type then 'contract_change'
      else 'correction' end;
    insert into cali_workspace.team_changes(company_id,member_id,reference_month,change_type,before_state,after_state,actor_user_id)
      values(p_company_id,proposed.id,p_month,kind,previous,latest,actor);
    changed := changed+1;
    saved_ids := array_append(saved_ids,proposed.id);
  end loop;

  if exists (
    select 1 from cali_workspace.team_members m
    where m.company_id=p_company_id and m.employee_code=any(checked_managers)
      and m.manager_code is not null and not exists (
        select 1 from cali_workspace.team_members g where g.company_id=p_company_id
          and g.employee_code=m.manager_code and g.archived_at is null
      )
  ) then
    raise exception using errcode='22023', message='Gestor direto não encontrado nesta equipe.';
  end if;
  if exists (
    with recursive chain(code,manager) as (
      select employee_code,manager_code from cali_workspace.team_members
      where company_id=p_company_id and employee_code=any(checked_managers)
      union all
      select g.employee_code,g.manager_code from chain
      join cali_workspace.team_members g on g.company_id=p_company_id
        and g.employee_code=chain.manager and g.archived_at is null
    ) cycle code set cyclic using visited
    select 1 from chain where cyclic
  ) then
    raise exception using errcode='22023', message='Gestão direta forma um ciclo.';
  end if;
  return jsonb_build_object('ids',saved_ids,'added',added,'changed',changed);
end;
$$;

create function cali_workspace.v2_archive_pilot_team_member(
  p_company_id uuid,p_member_id uuid,p_month date,p_expected_at timestamptz
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_write(p_company_id,p_month);
  archived timestamptz;
begin
  update cali_workspace.team_members set archived_at=clock_timestamp(), archived_by=actor
  where id=p_member_id and company_id=p_company_id and archived_at is null and updated_at=p_expected_at
  returning archived_at into archived;
  if not found then
    raise exception using errcode='40001', message='Ficha mudou. Recarregue antes de arquivar.';
  end if;
  insert into cali_workspace.team_changes(company_id,member_id,reference_month,change_type,before_state,after_state,actor_user_id)
    values(p_company_id,p_member_id,p_month,'correction','{"archived_at":null}'::jsonb,
      jsonb_build_object('archived_at',archived),actor);
  return p_member_id;
end;
$$;

revoke all on function cali_session_guard.require_pilot_team_write(uuid,date),
  cali_workspace.v2_save_pilot_team(uuid,date,jsonb),
  cali_workspace.v2_archive_pilot_team_member(uuid,uuid,date,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_pilot_team(uuid,date,jsonb),
  cali_workspace.v2_archive_pilot_team_member(uuid,uuid,date,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
