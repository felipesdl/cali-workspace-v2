-- DEC-29. Parecer Mapa do Partner é privado e só existe por atribuição Admin.
-- Aplicar após phase-4/mapa-operations.sql, mapa-report-read.sql e phase-5/partner-pilot.sql.
begin;
set local lock_timeout='5s';

create table cali_session_guard.phase5_partner_mapa_assignments (
  record_id uuid primary key references cali_session_guard.phase4_mapa_scope(record_id) on delete cascade,
  company_id uuid not null,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  assigned_by uuid not null,
  assigned_at timestamptz not null default clock_timestamp(),
  revision integer not null default 1 check(revision>0)
);
alter table cali_session_guard.phase5_partner_mapa_assignments enable row level security;
revoke all on cali_session_guard.phase5_partner_mapa_assignments from public,anon,authenticated,service_role;

create table cali_session_guard.phase5_partner_mapa_opinions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references cali_session_guard.phase4_mapa_scope(record_id) on delete cascade,
  company_id uuid not null,
  invite_id uuid not null references cali_session_guard.phase4_staff_invites(id),
  assignment_revision integer not null check(assignment_revision>0),
  scope_revision integer not null check(scope_revision>=0),
  opinion text not null default '' check(length(opinion)<=4000),
  status text not null check(status in ('draft','submitted','approved','returned','superseded')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_note text,
  decision_request_id uuid unique,
  decision_signature bytea,
  unique(record_id,assignment_revision)
);
alter table cali_session_guard.phase5_partner_mapa_opinions enable row level security;
revoke all on cali_session_guard.phase5_partner_mapa_opinions from public,anon,authenticated,service_role;

-- Só Admin pode atribuir, e somente para um convite staff sintético ainda válido.
create or replace function cali_workspace.v2_list_pilot_mapa_partners(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  return jsonb_build_object('partners',coalesce((
    select jsonb_agg(jsonb_build_object('inviteId',i.id,'name',left(m.full_name,250)) order by m.full_name,i.id)
    from cali_session_guard.phase4_staff_invites i
    join cali_workspace.staff_members m on m.id=i.member_id and m.updated_at=i.member_revision and m.active
    join cali_workspace.staff_company_assignments a on a.staff_id=m.id and a.company_id=i.company_id
    join cali_workspace.companies c on c.id=i.company_id and c.status::text in ('active','paused')
    join auth.users u on u.id=i.target_user_id and u.email_confirmed_at is not null and not u.is_anonymous
    where i.company_id=p_company and i.revoked_at is null
      and (i.accepted_at is not null or i.expires_at>statement_timestamp())
      and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,i.target_user_id)
      and exists(select 1 from cali_session_guard.pilot_companies pc where pc.company_id=p_company)
  ),'[]'::jsonb));
end;
$$;

create or replace function cali_workspace.v2_read_pilot_mapa_assignment(p_company uuid,p_record uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  if not exists(select 1 from cali_session_guard.phase4_mapa_scope g
    join public.mapa_respostas r on r.id=g.record_id
    where g.company_id=p_company and g.record_id=p_record and g.operator_id=actor
      and g.expires_at>statement_timestamp() and r.protocolo like 'CALI-QA-V2-MAPA-%'
      and r.c_email like '%@example.invalid') then
    raise exception using errcode='42501',message='Registro Mapa indisponível.';
  end if;
  return (select jsonb_build_object('recordId',g.record_id,'revision',a.revision,
    'inviteId',a.invite_id,'partnerName',left(m.full_name,250),'draftStatus',d.status)
    from cali_session_guard.phase4_mapa_scope g
    left join cali_session_guard.phase5_partner_mapa_assignments a on a.record_id=g.record_id
    left join cali_session_guard.phase4_staff_invites i on i.id=a.invite_id
    left join cali_workspace.staff_members m on m.id=i.member_id
    left join cali_session_guard.phase5_partner_mapa_opinions d
      on d.record_id=a.record_id and d.assignment_revision=a.revision
    where g.company_id=p_company and g.record_id=p_record and g.operator_id=actor);
end;
$$;

create or replace function cali_workspace.v2_assign_pilot_mapa_partner(
  p_company uuid,p_record uuid,p_scope_revision integer,p_invite uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  scope_revision integer;
  current_assignment cali_session_guard.phase5_partner_mapa_assignments;
  next_revision integer;
begin
  if p_scope_revision is null or p_invite is null then
    raise exception using errcode='22023',message='Confira a atribuição Mapa.';
  end if;
  select g.revision into scope_revision from cali_session_guard.phase4_mapa_scope g
  join public.mapa_respostas r on r.id=g.record_id
  where g.company_id=p_company and g.record_id=p_record and g.operator_id=actor
    and g.expires_at>statement_timestamp() and r.protocolo like 'CALI-QA-V2-MAPA-%'
    and r.c_email like '%@example.invalid' for update of g,r;
  if not found then raise exception using errcode='42501',message='Registro Mapa indisponível.'; end if;
  if scope_revision is distinct from p_scope_revision then
    raise exception using errcode='40001',message='O registro mudou. Atualize a atribuição.';
  end if;
  if not exists(select 1 from cali_session_guard.phase4_staff_invites i
    join cali_workspace.staff_members m on m.id=i.member_id and m.updated_at=i.member_revision and m.active
    join cali_workspace.staff_company_assignments a on a.staff_id=m.id and a.company_id=i.company_id
    join cali_workspace.companies c on c.id=i.company_id and c.status::text in ('active','paused')
    join auth.users u on u.id=i.target_user_id and u.email_confirmed_at is not null and not u.is_anonymous
    where i.id=p_invite and i.company_id=p_company and i.revoked_at is null
      and (i.accepted_at is not null or i.expires_at>statement_timestamp())
      and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,i.target_user_id)
      and exists(select 1 from cali_session_guard.pilot_companies pc where pc.company_id=p_company)) then
    raise exception using errcode='42501',message='O Partner não tem uma atribuição sintética válida nesta empresa.';
  end if;
  select * into current_assignment from cali_session_guard.phase5_partner_mapa_assignments
    where record_id=p_record for update;
  if current_assignment.record_id is not null and current_assignment.invite_id=p_invite then
    return p_record;
  end if;
  next_revision:=coalesce(current_assignment.revision,0)+1;
  if current_assignment.record_id is not null then
    update cali_session_guard.phase5_partner_mapa_opinions set status='superseded',updated_at=clock_timestamp()
      where record_id=p_record and assignment_revision=current_assignment.revision
        and status in ('draft','submitted','returned');
    update cali_session_guard.phase5_partner_mapa_assignments set invite_id=p_invite,assigned_by=actor,
      assigned_at=clock_timestamp(),revision=next_revision where record_id=p_record;
  else
    insert into cali_session_guard.phase5_partner_mapa_assignments
      (record_id,company_id,invite_id,assigned_by,revision)
      values(p_record,p_company,p_invite,actor,next_revision);
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,actor,'partner_mapa_assigned','mapa_record',p_record,
      jsonb_build_object('invite_id',p_invite,'assignment_revision',next_revision));
  return p_record;
end;
$$;

-- Cálculo interno iguala a projeção Admin sem expor os campos de contato/observações alheias.
create or replace function cali_session_guard.phase5_partner_mapa_context(p_company uuid,p_record uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  r public.mapa_respostas%rowtype;
  diagnosis jsonb;
  protocol_version integer;
  dimensions numeric[];
  subscores numeric[];
  a numeric; b numeric; c numeric; d numeric; score numeric; maturity numeric;
  suggested_service text;
begin
  select response.* into r from cali_session_guard.phase4_mapa_scope g
  join public.mapa_respostas response on response.id=g.record_id
  where g.company_id=p_company and g.record_id=p_record and g.expires_at>statement_timestamp()
    and response.protocolo like 'CALI-QA-V2-MAPA-%' and response.c_email like '%@example.invalid';
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
  maturity:=(a+b+c)/3;
  suggested_service:=case
    when maturity<5 and d<5 then 'Diagnóstico Executivo de People'
    when maturity<5 then 'Projeto de Cultura e Direção'
    when d<5 then 'Assessoria Estratégica Mensal — CALI Partner'
    else 'Assessoria Estratégica Mensal — CALI Full' end;
  return jsonb_build_object('version',protocol_version,'dimensions',dimensions,'score',round(score,1),
    'protocol',r.protocolo,'createdAt',r.created_at,
    'observations',jsonb_build_array(left(r.observacoes->>'d1_obs',4000),left(r.observacoes->>'d2_obs',4000),
      left(r.observacoes->>'d3_obs',4000),left(r.observacoes->>'d4_obs',4000)),
    'recommendedService',coalesce(nullif(left(r.observacoes->>'servico_recomendado',250),''),suggested_service));
end;
$$;

create or replace function cali_workspace.v2_list_partner_mapa_opinions(p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
begin
  if access->>'status' is distinct from 'ready' or invite.id is null then
    raise exception using errcode='42501',message='Pareceres Mapa indisponíveis.';
  end if;
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select a.record_id,a.company_id,a.revision as assignment_revision,g.revision as scope_revision,
        r.protocolo as protocol,r.status as record_status,r.created_at as "createdAt",
        d.id,d.status as draft_status,d.opinion,d.decision_note,d.submitted_at,
        cali_session_guard.phase5_partner_mapa_context(a.company_id,a.record_id) as diagnostic
      from cali_session_guard.phase5_partner_mapa_assignments a
      join cali_session_guard.phase4_mapa_scope g on g.record_id=a.record_id and g.company_id=a.company_id
      join public.mapa_respostas r on r.id=a.record_id
      left join cali_session_guard.phase5_partner_mapa_opinions d
        on d.record_id=a.record_id and d.assignment_revision=a.revision
      where a.company_id=(access->>'company')::uuid and a.invite_id=invite.id
        and g.expires_at>statement_timestamp() and r.protocolo like 'CALI-QA-V2-MAPA-%'
        and r.c_email like '%@example.invalid'
        and r.status in ('novo','em_andamento','em_revisao','cancelado')
    ), selected as (
      select * from matched where diagnostic is not null
      order by "createdAt" desc,record_id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched where diagnostic is not null),
      'entries',coalesce((select jsonb_agg(to_jsonb(selected) order by "createdAt" desc,record_id) from selected),'[]'::jsonb))
  );
end;
$$;

create or replace function cali_workspace.v2_save_partner_mapa_opinion(
  p_record uuid,p_assignment_revision integer,p_request uuid,p_action text,p_opinion text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
  invite cali_session_guard.phase4_staff_invites:=cali_session_guard.phase5_partner_invite();
  assignment cali_session_guard.phase5_partner_mapa_assignments;
  current_scope_revision integer;
  current_opinion cali_session_guard.phase5_partner_mapa_opinions;
  body text:=btrim(coalesce(p_opinion,''));
  result uuid;
begin
  if access->>'status' is distinct from 'ready' or invite.id is null then
    raise exception using errcode='42501',message='Parecer Mapa indisponível.';
  end if;
  if p_record is null or p_request is null or p_assignment_revision is null
    or p_action is null or p_action not in ('save','submit') or length(body)>4000
    or (p_action='submit' and length(body)<1) then
    raise exception using errcode='22023',message='Confira o parecer antes de salvar.';
  end if;
  select * into assignment from cali_session_guard.phase5_partner_mapa_assignments a
    where a.record_id=p_record and a.company_id=(access->>'company')::uuid
      and a.invite_id=invite.id and a.revision=p_assignment_revision for update;
  if not found or not exists(select 1 from cali_session_guard.phase4_mapa_scope g
    join public.mapa_respostas r on r.id=g.record_id
    where g.record_id=p_record and g.company_id=assignment.company_id and g.expires_at>statement_timestamp()
      and r.protocolo like 'CALI-QA-V2-MAPA-%' and r.c_email like '%@example.invalid'
      and r.status in ('novo','em_andamento','em_revisao','cancelado')) then
    raise exception using errcode='42501',message='A atribuição Mapa não está mais disponível.';
  end if;
  select g.revision into current_scope_revision from cali_session_guard.phase4_mapa_scope g
    join public.mapa_respostas r on r.id=g.record_id where g.record_id=p_record for update of g,r;
  if cali_session_guard.phase5_partner_mapa_context(assignment.company_id,p_record) is null then
    raise exception using errcode='42501',message='O diagnóstico não está disponível para parecer.';
  end if;
  select * into current_opinion from cali_session_guard.phase5_partner_mapa_opinions d
    where d.record_id=p_record and d.assignment_revision=p_assignment_revision for update;
  if current_opinion.id is not null and current_opinion.status in ('submitted','approved','superseded') then
    if current_opinion.status='submitted' and current_opinion.opinion=body and p_action='submit' then
      return current_opinion.id;
    end if;
    raise exception using errcode='40001',message='Este parecer já foi enviado para revisão.';
  end if;
  if current_opinion.id is null then
    insert into cali_session_guard.phase5_partner_mapa_opinions
      (record_id,company_id,invite_id,assignment_revision,scope_revision,opinion,status,submitted_at)
    values(p_record,assignment.company_id,invite.id,p_assignment_revision,current_scope_revision,body,
      case when p_action='submit' then 'submitted' else 'draft' end,
      case when p_action='submit' then clock_timestamp() end) returning id into result;
  else
    update cali_session_guard.phase5_partner_mapa_opinions set scope_revision=current_scope_revision,
      opinion=body,status=case when p_action='submit' then 'submitted' else 'draft' end,
      submitted_at=case when p_action='submit' then clock_timestamp() else null end,
      updated_at=clock_timestamp(),reviewed_by=null,reviewed_at=null,decision_note=null,
      decision_request_id=null,decision_signature=null
      where id=current_opinion.id returning id into result;
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(assignment.company_id,auth.uid(),case when p_action='submit'
      then 'partner_mapa_opinion_submitted' else 'partner_mapa_opinion_saved' end,
      'mapa_record',p_record,jsonb_build_object('assignment_revision',p_assignment_revision,'scope_revision',current_scope_revision));
  return result;
end;
$$;

create or replace function cali_workspace.v2_list_pilot_mapa_opinion_drafts(p_company uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    with matched as (
      select d.id,d.record_id as "recordId",d.assignment_revision as "assignmentRevision",
        d.scope_revision as "scopeRevision",g.revision as "currentScopeRevision",
        r.protocolo as protocol,r.status as "recordStatus",left(m.full_name,250) as "partnerName",
        d.opinion,d.status,d.submitted_at as "submittedAt",d.decision_note as "decisionNote"
      from cali_session_guard.phase5_partner_mapa_opinions d
      join cali_session_guard.phase5_partner_mapa_assignments a on a.record_id=d.record_id
        and a.revision=d.assignment_revision and a.invite_id=d.invite_id
      join cali_session_guard.phase4_mapa_scope g on g.record_id=d.record_id and g.company_id=d.company_id
      join cali_session_guard.phase4_staff_invites i on i.id=d.invite_id
      join cali_workspace.staff_members m on m.id=i.member_id
      join public.mapa_respostas r on r.id=d.record_id
      where d.company_id=p_company and d.status='submitted' and g.operator_id=actor
        and g.expires_at>statement_timestamp() and r.protocolo like 'CALI-QA-V2-MAPA-%'
        and r.c_email like '%@example.invalid'
    ), selected as (
      select * from matched order by "submittedAt" desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(selected) order by "submittedAt" desc,id) from selected),'[]'::jsonb))
  );
end;
$$;

create or replace function cali_workspace.v2_decide_pilot_mapa_opinion(
  p_company uuid,p_record uuid,p_assignment_revision integer,p_scope_revision integer,
  p_request uuid,p_decision text,p_status text,p_note text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_phase4_role(p_company,'admin');
  assignment cali_session_guard.phase5_partner_mapa_assignments;
  draft cali_session_guard.phase5_partner_mapa_opinions;
  note text:=nullif(btrim(p_note),'');
  signature bytea;
  scope_revision integer;
begin
  if p_request is null or p_decision is null or p_decision not in ('apply','return')
    or (p_decision='apply' and (p_status is null or p_status not in ('novo','em_andamento','cancelado')))
    or (p_decision='return' and coalesce(length(note),0)<3) or length(note)>1000 then
    raise exception using errcode='22023',message='Confira a decisão do parecer.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array(p_company,p_record,p_assignment_revision,p_scope_revision,
    p_decision,p_status,note)::text,'UTF8'));
  select * into draft from cali_session_guard.phase5_partner_mapa_opinions d
    where d.record_id=p_record and d.company_id=p_company and d.assignment_revision=p_assignment_revision
    for update;
  if not found then raise exception using errcode='42501',message='Parecer indisponível.'; end if;
  if draft.status in ('approved','returned') then
    if draft.decision_request_id=p_request and draft.decision_signature=signature then return p_record; end if;
    raise exception using errcode='40001',message='O parecer já recebeu decisão.';
  end if;
  if draft.status<>'submitted' then raise exception using errcode='40001',message='Parecer não está aguardando revisão.'; end if;
  select * into assignment from cali_session_guard.phase5_partner_mapa_assignments a
    where a.record_id=p_record and a.company_id=p_company and a.revision=p_assignment_revision
      and a.invite_id=draft.invite_id for update;
  if not found or not exists(select 1 from cali_session_guard.phase4_staff_invites i
    join cali_workspace.staff_members m on m.id=i.member_id and m.updated_at=i.member_revision and m.active
    join cali_workspace.staff_company_assignments a on a.staff_id=m.id and a.company_id=i.company_id
    join auth.users u on u.id=i.target_user_id and u.email_confirmed_at is not null and not u.is_anonymous
    where i.id=assignment.invite_id and i.company_id=p_company and i.revoked_at is null
      and (i.accepted_at is not null or i.expires_at>statement_timestamp())
      and cali_session_guard.phase4_staff_binding(i.company_id,i.member_id,i.member_revision,i.target_user_id)) then
    raise exception using errcode='42501',message='A atribuição ou o convite do Partner mudou.';
  end if;
  select g.revision into scope_revision from cali_session_guard.phase4_mapa_scope g
    join public.mapa_respostas r on r.id=g.record_id
    where g.record_id=p_record and g.company_id=p_company and g.operator_id=actor
      and g.expires_at>statement_timestamp() and r.protocolo like 'CALI-QA-V2-MAPA-%'
      and r.c_email like '%@example.invalid' for update of g,r;
  if not found then raise exception using errcode='42501',message='Registro Mapa indisponível.'; end if;
  if p_decision='apply' then
    if p_scope_revision is distinct from draft.scope_revision or scope_revision is distinct from draft.scope_revision then
      raise exception using errcode='40001',message='O registro mudou. Reabra o parecer e confira o diagnóstico.';
    end if;
    perform cali_workspace.v2_review_pilot_mapa(p_company,p_record,draft.scope_revision,p_status,draft.opinion);
  end if;
  update cali_session_guard.phase5_partner_mapa_opinions set status=case when p_decision='apply' then 'approved' else 'returned' end,
    reviewed_by=actor,reviewed_at=clock_timestamp(),decision_note=note,
    decision_request_id=p_request,decision_signature=signature,updated_at=clock_timestamp()
    where id=draft.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company,actor,case when p_decision='apply' then 'partner_mapa_opinion_applied' else 'partner_mapa_opinion_returned' end,
      'mapa_record',p_record,jsonb_build_object('assignment_revision',p_assignment_revision,
        'scope_revision',draft.scope_revision,'decision',p_decision));
  return p_record;
end;
$$;

revoke all on function cali_session_guard.phase5_partner_mapa_context(uuid,uuid),
  cali_workspace.v2_list_pilot_mapa_partners(uuid),
  cali_workspace.v2_read_pilot_mapa_assignment(uuid,uuid),
  cali_workspace.v2_assign_pilot_mapa_partner(uuid,uuid,integer,uuid),
  cali_workspace.v2_list_partner_mapa_opinions(integer),
  cali_workspace.v2_save_partner_mapa_opinion(uuid,integer,uuid,text,text),
  cali_workspace.v2_list_pilot_mapa_opinion_drafts(uuid,integer),
  cali_workspace.v2_decide_pilot_mapa_opinion(uuid,uuid,integer,integer,uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_mapa_partners(uuid),
  cali_workspace.v2_read_pilot_mapa_assignment(uuid,uuid),
  cali_workspace.v2_assign_pilot_mapa_partner(uuid,uuid,integer,uuid),
  cali_workspace.v2_list_pilot_mapa_opinion_drafts(uuid,integer),
  cali_workspace.v2_decide_pilot_mapa_opinion(uuid,uuid,integer,integer,uuid,text,text,text)
  to authenticated;
grant execute on function cali_workspace.v2_list_partner_mapa_opinions(integer),
  cali_workspace.v2_save_partner_mapa_opinion(uuid,integer,uuid,text,text)
  to authenticated;
notify pgrst,'reload schema';
commit;
