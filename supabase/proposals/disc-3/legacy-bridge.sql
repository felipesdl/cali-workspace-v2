-- Candidate only. Depends on the V1 DISC functions/tables from 20261023150000,
-- 20261024090000 and later applied patches. Do not apply without catalog preflight.
begin;
set local lock_timeout = '5s';

-- One receipt per invitation. No result payload or token is returned to public callers.
create table cali_workspace.profile_invite_submit_receipts (
  invite_id uuid primary key references cali_workspace.profile_invites(id) on delete cascade,
  request_id uuid not null unique,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table cali_workspace.profile_invite_submit_receipts enable row level security;
revoke all on cali_workspace.profile_invite_submit_receipts from public, anon, authenticated;

create or replace function cali_workspace.v2_disc_legacy_public(
  p_slug text, p_token uuid, p_kind text, p_fields jsonb default '{}'
) returns jsonb
language plpgsql volatile security definer
set search_path = '' as $$
declare
  v_inv cali_workspace.profile_invites%rowtype;
  v_link cali_workspace.profile_links%rowtype;
  v_receipt cali_workspace.profile_invite_submit_receipts%rowtype;
  v_result jsonb;
  v_request uuid;
  v_fingerprint text;
  v_state text;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_token is null
    or p_kind not in ('read','progress','decline','submit')
    or p_fields is null or jsonb_typeof(p_fields) is distinct from 'object'
    or pg_column_size(p_fields) > 32768 then
    raise exception using errcode='22023', message='Convite indisponível.';
  end if;
  select * into v_inv from cali_workspace.profile_invites where token=p_token for update;
  if not found then
    return jsonb_build_object('state','missing','title',null,'organization',null,'person_name',null,'deadline_at',null,'last_block',null);
  end if;
  select * into v_link from cali_workspace.profile_links where id=v_inv.link_id;
  if not found or v_link.slug <> p_slug or v_link.company_id is null
    or v_link.company_id not in ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid) then
    return jsonb_build_object('state','missing','title',null,'organization',null,'person_name',null,'deadline_at',null,'last_block',null);
  end if;

  if p_kind='submit' then
    if p_fields ?| array['name','email','company','result','scores','token']
      or (p_fields->>'consent')::boolean is distinct from true
      or length(coalesce(p_fields->>'jobTitle','')) > 120
      or not (p_fields ? 'requestId') then
      raise exception using errcode='22023', message='Confira o consentimento e os dados da resposta.';
    end if;
    v_request := (p_fields->>'requestId')::uuid;
    v_fingerprint := encode(sha256(convert_to((p_fields-'requestId')::text,'UTF8')),'hex');
    select * into v_receipt from cali_workspace.profile_invite_submit_receipts where invite_id=v_inv.id;
    if found then
      if v_receipt.request_id <> v_request or v_receipt.fingerprint <> v_fingerprint then
        raise exception using errcode='22023', message='Este convite já foi concluído.';
      end if;
    elsif v_inv.completed_at is not null then
      -- Historical completion is acknowledged, but not receipted or re-enqueued.
    else
      -- Existing V1 writer remains sole writer; result token is discarded here.
      v_result := public.cali_profile_submit_invite(
        p_token, p_fields->>'jobTitle', p_fields->'answers', (p_fields->>'consent')::boolean
      );
      insert into cali_workspace.profile_invite_submit_receipts(invite_id,request_id,fingerprint)
      values(v_inv.id,v_request,v_fingerprint);
    end if;
  elsif p_kind='read' then
    perform public.cali_profile_invite_open(p_token);
  elsif p_kind='progress' then
    if (p_fields->>'block') !~ '^([1-9]|1[0-9]|2[0-4])$' then
      raise exception using errcode='22023', message='Bloco inválido.';
    end if;
    perform public.cali_profile_invite_progress(p_token,(p_fields->>'block')::integer);
  elsif p_kind='decline' then
    if v_inv.sent_at is null or v_inv.completed_at is not null or v_inv.declined_at is not null
      or (v_inv.deadline_at is not null and v_inv.deadline_at < statement_timestamp()) then
      raise exception using errcode='22023', message='Convite encerrado ou indisponível.';
    end if;
    perform public.cali_profile_invite_decline(p_token);
  end if;

  select * into v_inv from cali_workspace.profile_invites where id=v_inv.id;
  v_state := cali_workspace.profile_invite_state(v_inv.sent_at,v_inv.deadline_at,v_inv.opened_at,v_inv.started_at,v_inv.completed_at,v_inv.declined_at);
  return jsonb_build_object(
    'state',case when v_state in ('created','sent','opened','started','declined','expired','completed') then v_state else 'missing' end,
    'title',v_link.title,'organization',null,'person_name',v_inv.person_name,
    'deadline_at',v_inv.deadline_at,'last_block',coalesce(v_inv.last_block,0)
  );
end $$;
revoke all on function cali_workspace.v2_disc_legacy_public(text,uuid,text,jsonb) from public;
grant execute on function cali_workspace.v2_disc_legacy_public(text,uuid,text,jsonb) to anon,authenticated;

-- Read-only V1 catalog, restricted to the two identified synthetic pilot companies
-- and separately guarded by V2 Admin session, MFA and terms.
-- Returns evaluator data to Admin only; never returns invitation/access tokens.
create or replace function cali_workspace.v2_disc_legacy_admin(p_link uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_links jsonb; v_link jsonb; v_evaluations jsonb; v_history jsonb; v_management_report jsonb;
begin
  perform cali_v2_disc.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'slug',l.slug,'title',l.title,'purpose',l.purpose,'status',l.status,'created_at',l.created_at,
    'company_id',l.company_id,'company_name',coalesce(c.display_name,l.company_label),
    'invite_count',(select count(*) from cali_workspace.profile_invites i where i.link_id=l.id),
    'result_count',(select count(*) from cali_workspace.profile_results r where r.link_id=l.id),
    'management',jsonb_build_object('goal',l.gestao_goal,'note',l.gestao_note,'moment',l.gestao_moment,'sector',l.gestao_sector,
      'approved_at',l.gestao_approved_at,'released_at',l.gestao_released_at,'protocol',l.gestao_protocol)
  ) order by l.created_at desc),'[]'::jsonb) into v_links
  from cali_workspace.profile_links l left join cali_workspace.companies c on c.id=l.company_id
  where l.company_id in ('9c5ab148-78b8-4410-9338-58c44222a5db'::uuid,'6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'::uuid);

  if p_link is null then
    return jsonb_build_object('links',v_links,'selected',null);
  end if;
  select item into v_link from jsonb_array_elements(v_links) item where item->>'id'=p_link::text;
  if v_link is null then return jsonb_build_object('links',v_links,'selected',null); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'person_name',r.person_name,'job_title',r.job_title,'primary_style',r.primary_style,
    'secondary_style',r.secondary_style,'mixed',r.mixed,'scores',r.scores,'protocol',r.protocol,
    'method_version',r.method_version,'created_at',r.created_at,'report_path',r.report_path,
    'report_emailed_at',r.report_emailed_at
  ) order by r.created_at desc),'[]'::jsonb) into v_evaluations
  from cali_workspace.profile_results r where r.link_id=p_link;

  select coalesce(jsonb_agg(jsonb_build_object('kind',event.kind,'occurred_at',event.occurred_at,
    'subject',event.subject,'summary',event.summary) order by event.occurred_at desc,event.kind),'[]'::jsonb)
  into v_history from (
    select 'campaign_created'::text kind,l.created_at occurred_at,null::text subject,'Campanha criada.'::text summary
      from cali_workspace.profile_links l where l.id=p_link
    union all
    select 'invite_created',i.created_at,i.person_name,'Convite registrado.' from cali_workspace.profile_invites i where i.link_id=p_link
    union all
    select 'invite_sent',i.sent_at,i.person_name,'Convite enviado.' from cali_workspace.profile_invites i where i.link_id=p_link and i.sent_at is not null
    union all
    select 'invite_opened',i.opened_at,i.person_name,'Convite aberto.' from cali_workspace.profile_invites i where i.link_id=p_link and i.opened_at is not null
    union all
    select 'invite_started',i.started_at,i.person_name,'Resposta iniciada.' from cali_workspace.profile_invites i where i.link_id=p_link and i.started_at is not null
    union all
    select 'invite_completed',i.completed_at,i.person_name,'Convite concluído.' from cali_workspace.profile_invites i where i.link_id=p_link and i.completed_at is not null
    union all
    select 'invite_declined',i.declined_at,i.person_name,'Convite recusado.' from cali_workspace.profile_invites i where i.link_id=p_link and i.declined_at is not null
    union all
    select 'invite_deadline',i.deadline_at,i.person_name,'Prazo definido para este convite.' from cali_workspace.profile_invites i where i.link_id=p_link and i.deadline_at is not null
    union all
    select 'result_created',r.created_at,r.person_name,'Relatório individual preservado para avaliação interna CALI.' from cali_workspace.profile_results r where r.link_id=p_link
    union all
    select 'management_approved',l.gestao_approved_at,null::text,'A revisão atual foi aprovada.' from cali_workspace.profile_links l where l.id=p_link and l.gestao_approved_at is not null
    union all
    select 'management_released',l.gestao_released_at,null::text,'A revisão atual foi liberada.' from cali_workspace.profile_links l where l.id=p_link and l.gestao_released_at is not null
    union all
    select 'management_pdf_sent',(sent.item->>'at')::timestamptz,sent.item->>'name','PDF de gestão enviado a '||coalesce(sent.item->>'email','destinatário registrado')||'.'
      from cali_workspace.profile_links l cross join lateral jsonb_array_elements(coalesce(l.gestao_sent_log,'[]'::jsonb)) sent(item) where l.id=p_link
  ) event where event.occurred_at is not null;
  v_management_report := cali_workspace.profile_gestao(p_link);

  return jsonb_build_object('links',v_links,'selected',jsonb_build_object(
    'link',v_link,'evaluations',v_evaluations,'history',v_history,'management_report',v_management_report,
    'history_completeness','Eventos reconstruídos somente dos timestamps/logs preservados em V1. Alterações antigas de conteúdo sem log próprio não são recuperáveis.'
  ));
end $$;
revoke all on function cali_workspace.v2_disc_legacy_admin(uuid) from public,anon;
grant execute on function cali_workspace.v2_disc_legacy_admin(uuid) to authenticated;

commit;
