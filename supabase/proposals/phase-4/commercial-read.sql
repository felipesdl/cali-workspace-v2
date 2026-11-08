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
        s.service_slug as service,p.id as "proposalId",p.status::text as "proposalStatus",
        p.version,p.total_value as total,p.package_code as package,
        coalesce(p.updated_at,s.updated_at) as "updatedAt",
        coalesce(scope.proposal_id is null and scope.pilot_package is not null and scope.pilot_price>0
          and s.status='edicao' and left(s.protocol,11)='CALI-QA-V2-'
          and s.contact_email like '%@example.invalid',false) as "canCreate",
        coalesce(p.status='aprovada' and scope.recipient_id is not null
          and scope.recipient_revoked_at is null and scope.delivered_at is null
          and left(s.protocol,11)='CALI-QA-V2-' and s.contact_email like '%@example.invalid',false) as "canSend"
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
