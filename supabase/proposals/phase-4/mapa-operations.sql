-- FLOW-17. Triagem restrita a registros sintéticos vinculados por operador.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_mapa_scope (
  record_id uuid primary key references public.mapa_respostas(id) on delete cascade,
  company_id uuid not null,
  operator_id uuid not null,
  expires_at timestamptz not null,
  revision integer not null default 0 check(revision>=0)
);
alter table cali_session_guard.phase4_mapa_scope enable row level security;
revoke all on cali_session_guard.phase4_mapa_scope from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_list_pilot_mapa(p_company_id uuid,p_page integer)
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
      select r.id,r.protocolo as protocol,r.status,r.created_at as "createdAt",
        r.observacoes->>'parecer' as opinion,g.revision
      from cali_session_guard.phase4_mapa_scope g join public.mapa_respostas r on r.id=g.record_id
      where g.company_id=p_company_id and g.operator_id=actor and g.expires_at>statement_timestamp()
        and r.protocolo like 'CALI-QA-V2-MAPA-%' and r.c_email like '%@example.invalid'
    ), selected as (
      select * from matched order by "createdAt" desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(selected) order by "createdAt" desc,id) from selected),'[]'::jsonb))
  );
end;
$$;

create or replace function cali_workspace.v2_review_pilot_mapa(
  p_company_id uuid,p_record_id uuid,p_revision integer,p_status text,p_opinion text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  current_revision integer;
  current_status text;
  current_opinion text;
  opinion text := nullif(btrim(p_opinion),'');
begin
  if p_status is null or p_status not in ('novo','em_andamento','cancelado') or length(opinion)>4000 then
    raise exception using errcode='22023',message='Confira a situação e o parecer.';
  end if;
  select g.revision,r.status,r.observacoes->>'parecer' into current_revision,current_status,current_opinion
  from cali_session_guard.phase4_mapa_scope g join public.mapa_respostas r on r.id=g.record_id
  where g.company_id=p_company_id and g.record_id=p_record_id and g.operator_id=actor and g.expires_at>statement_timestamp()
    and r.protocolo like 'CALI-QA-V2-MAPA-%' and r.c_email like '%@example.invalid'
    and r.status in ('novo','em_andamento','em_revisao','cancelado') for update of g,r;
  if not found then raise exception using errcode='42501',message='Registro indisponível.'; end if;
  if (current_status,current_opinion) is not distinct from (p_status,opinion) then return p_record_id; end if;
  if current_revision is distinct from p_revision then
    raise exception using errcode='40001',message='A triagem mudou. Reabra o registro.';
  end if;
  update public.mapa_respostas set status=p_status,
    observacoes=case when opinion is null then observacoes-'parecer'
      else jsonb_set(observacoes,'{parecer}',to_jsonb(opinion)) end
  where id=p_record_id;
  update cali_session_guard.phase4_mapa_scope set revision=revision+1 where record_id=p_record_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'mapa_review_saved','mapa_record',p_record_id,
    jsonb_build_object('status',p_status,'opinionChanged',current_opinion is distinct from opinion));
  return p_record_id;
end;
$$;
revoke all on function cali_workspace.v2_list_pilot_mapa(uuid,integer),
  cali_workspace.v2_review_pilot_mapa(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_mapa(uuid,integer),
  cali_workspace.v2_review_pilot_mapa(uuid,uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
