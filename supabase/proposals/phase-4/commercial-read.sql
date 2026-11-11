-- FLOW-03. Projeção do rascunho sintético delegado ao operador do piloto.
begin;
set local lock_timeout='5s';

-- Falha antes de instalar a RPC se o contrato do Portal estiver ausente.
do $$
begin
  perform s.protocol,s.status,s.service_slug,s.updated_at,p.status,p.version,p.total_value,p.package_code,p.updated_at
  from public.cali_submissions s left join public.cali_proposals p on p.submission_id=s.id
  where s.id=null::uuid limit 0;
end;
$$;

create table if not exists cali_session_guard.phase4_commercial_scope (
  company_id uuid not null references cali_workspace.companies(id),
  submission_id uuid primary key
);
alter table cali_session_guard.phase4_commercial_scope
  add column if not exists operator_id uuid references cali_workspace.profiles(id),
  add column if not exists proposal_id uuid unique references public.cali_proposals(id),
  add column if not exists expires_at timestamptz,
  add column if not exists pilot_package text,
  add column if not exists pilot_price numeric(12,2),
  add column if not exists recipient_id uuid references cali_workspace.profiles(id),
  add column if not exists delivered_at timestamptz,
  add column if not exists accept_by timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists recipient_revoked_at timestamptz,
  add column if not exists offer jsonb;
alter table cali_session_guard.phase4_commercial_scope enable row level security;
revoke all on cali_session_guard.phase4_commercial_scope from public,anon,authenticated,service_role;

-- Only briefing fields are projected; contact metadata and file/path values stay private.
create or replace function cali_session_guard.phase4_commercial_briefing(p_answers jsonb)
returns jsonb language sql immutable set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key',item.key,'value',item.answer) order by item.key),'[]'::jsonb)
  from (
    select safe.key, left(safe.answer,4000) as answer
    from (
      select entry.key,
        case jsonb_typeof(entry.value)
          when 'string' then case
            when entry.value#>>'{}' ~* '(^https?://|^data:|@|^[0-9+(). -]{8,}$|^/|^[[:alnum:]_.-]+/)'
              then null
            else entry.value#>>'{}'
          end
          when 'number' then entry.value#>>'{}'
          when 'boolean' then case when entry.value='true'::jsonb then 'Sim' else 'Não' end
          when 'array' then (
            select nullif(string_agg(left(answer_part.value,1000),' · ' order by answer_part.position),'')
            from (
              select element.value#>>'{}' as value,element.position
              from jsonb_array_elements(entry.value) with ordinality as element(value,position)
              where element.position<=50 and jsonb_typeof(element.value) in ('string','number','boolean')
                and element.value#>>'{}' !~* '(^https?://|^data:|@|^[0-9+(). -]{8,}$|^/|^[[:alnum:]_.-]+/)'
            ) answer_part
          )
          else null
        end as answer
      from jsonb_each(case when jsonb_typeof(p_answers)='object' then p_answers else '{}'::jsonb end) entry
      where entry.key !~* '(email|e.?mail|phone|telefone|whats.?app|contato|(^|_)nome($|_)|cpf|cnpj|token|path|file|arquivo|anexo|upload|signature|assinatura|consent|lgpd)'
      order by entry.key
      limit 100
    ) safe
    where safe.answer is not null and safe.answer<>''
  ) item
$$;
revoke all on function cali_session_guard.phase4_commercial_briefing(jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_read_pilot_commercial(p_company_id uuid,p_page integer)
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
      select s.id as "opportunityId",s.protocol,s.status::text as "opportunityStatus",
        s.service_slug as service,cali_session_guard.phase4_commercial_briefing(s.answers) as briefing,
        p.id as "proposalId",p.status::text as "proposalStatus",
        p.version,p.total_value as total,p.package_code as package,
        coalesce(p.updated_at,s.updated_at) as "updatedAt",
        coalesce(scope.proposal_id is null and scope.pilot_package is not null and scope.pilot_price>0
          and s.status='edicao' and left(s.protocol,11)='CALI-QA-V2-'
          and s.contact_email like '%@example.invalid',false) as "canCreate",
        coalesce(p.status='aprovada' and scope.recipient_id is not null
          and scope.recipient_revoked_at is null and scope.delivered_at is null
          and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid',false) as "canSend",
        coalesce(p.status='enviada' and scope.recipient_id is not null
          and scope.recipient_revoked_at is null and scope.delivered_at is not null
          and scope.accepted_at is null and scope.accept_by>statement_timestamp()
          and p.updated_at=scope.delivered_at and p.version=(scope.offer->>'version')::integer
          and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid',false) as "canResend",
        coalesce(p.status='aprovada' and scope.recipient_id is null and scope.delivered_at is null
          and p.calculator_data->'pilotBuild' is not null and left(s.protocol,11)='CALI-QA-V2-'
          and s.contact_email='qa-proposta-v2@example.invalid'
          and to_regprocedure('cali_workspace.v2_prepare_pilot_commercial_email(uuid,uuid,timestamptz)') is not null,false) as "canEmail"
      from cali_session_guard.phase4_commercial_scope scope
      join public.cali_submissions s on s.id=scope.submission_id
      left join public.cali_proposals p on p.id=scope.proposal_id and p.submission_id=s.id
      where scope.company_id=p_company_id and scope.operator_id=actor
        and scope.expires_at>statement_timestamp() and (scope.proposal_id is null or p.id is not null)
    ), page as (
      select * from filtered order by "updatedAt" desc nulls last,"opportunityId","proposalId"
      limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'total',(select count(*) from filtered),
      'entries',coalesce((select jsonb_agg(to_jsonb(page)
        order by "updatedAt" desc nulls last,"opportunityId","proposalId") from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_commercial(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_commercial(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
