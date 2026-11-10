-- Candidata 2A para revisão e execução isolada. Fora dos runners de migrations.
begin;

create schema cali_v2_onboarding;
revoke all on schema cali_v2_onboarding from public, anon, authenticated, service_role;
grant usage on schema cali_v2_onboarding to authenticated;

create table cali_v2_onboarding.company_drafts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  legal_name text not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  request_id uuid not null,
  unique (recorded_by, request_id)
);

create table cali_v2_onboarding.adhesion_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  draft_id uuid not null references cali_v2_onboarding.company_drafts(id),
  previous_event_id uuid,
  action text not null check (action in ('confirmed', 'withdrawn')),
  evidence_reference text,
  document_revision text,
  note text not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  request_id uuid not null,
  unique (recorded_by, request_id),
  unique (draft_id, id),
  foreign key (draft_id, previous_event_id)
    references cali_v2_onboarding.adhesion_events(draft_id, id),
  check (
    (action = 'confirmed' and evidence_reference is not null) or
    (action = 'withdrawn' and previous_event_id is not null
      and evidence_reference is null and document_revision is null)
  )
);

create index adhesion_events_draft_history
  on cali_v2_onboarding.adhesion_events(draft_id, sequence desc);

alter table cali_v2_onboarding.company_drafts enable row level security;
alter table cali_v2_onboarding.adhesion_events enable row level security;
revoke all on table cali_v2_onboarding.company_drafts, cali_v2_onboarding.adhesion_events
  from public, anon, authenticated, service_role;
revoke all on sequence cali_v2_onboarding.adhesion_events_sequence_seq
  from public, anon, authenticated, service_role;

create function cali_v2_onboarding.require_admin()
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or (auth.jwt() ->> 'aal') is distinct from 'aal2'
    or not exists (
      select 1 from cali_workspace.profiles p
      where p.id = actor and p.role = 'admin' and p.active
    ) or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = actor and f.factor_type = 'totp' and f.status = 'verified'
    ) then
    raise exception using errcode = '42501', message = 'Admin ativo com MFA obrigatório.';
  end if;
  return actor;
end;
$$;

create function cali_v2_onboarding.create_draft(
  p_request_id uuid, p_display_name text, p_legal_name text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  display_name text := btrim(p_display_name, E' \t\n\r');
  legal_name text := coalesce(nullif(btrim(p_legal_name, E' \t\n\r'), ''), display_name);
  draft cali_v2_onboarding.company_drafts;
begin
  if p_request_id is null or display_name is null or length(display_name) not between 1 and 200
    or length(legal_name) > 200 then
    raise exception using errcode = '22023', message = 'Identidade da empresa inválida.';
  end if;

  insert into cali_v2_onboarding.company_drafts as d
    (display_name, legal_name, recorded_by, request_id)
  values (display_name, legal_name, actor, p_request_id)
  on conflict (recorded_by, request_id) do nothing returning d.* into draft;

  if not found then
    select d.* into strict draft from cali_v2_onboarding.company_drafts d
    where d.recorded_by = actor and d.request_id = p_request_id;
    if draft.display_name is distinct from display_name or draft.legal_name is distinct from legal_name then
      raise exception using errcode = '23505', message = 'Chave de operação já usada com outros dados.';
    end if;
  end if;

  return to_jsonb(draft) - 'request_id';
end;
$$;

create function cali_v2_onboarding.review_adhesion(
  p_draft_id uuid, p_request_id uuid, p_expected_event_id uuid, p_action text,
  p_evidence_reference text, p_document_revision text, p_note text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_v2_onboarding.require_admin();
  evidence text := nullif(btrim(p_evidence_reference, E' \t\n\r'), '');
  revision text := nullif(btrim(p_document_revision, E' \t\n\r'), '');
  note text := nullif(btrim(p_note, E' \t\n\r'), '');
  latest cali_v2_onboarding.adhesion_events;
  event cali_v2_onboarding.adhesion_events;
begin
  if p_request_id is null or p_action is null or p_action not in ('confirmed', 'withdrawn')
    or note is null or length(note) > 2000 or length(evidence) > 1000 or length(revision) > 250
    or (p_action = 'confirmed' and evidence is null)
    or (p_action = 'withdrawn' and (evidence is not null or revision is not null)) then
    raise exception using errcode = '22023', message = 'Dados da comprovação inválidos.';
  end if;

  perform 1 from cali_v2_onboarding.company_drafts d where d.id = p_draft_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Rascunho indisponível.';
  end if;

  select e.* into event from cali_v2_onboarding.adhesion_events e
  where e.recorded_by = actor and e.request_id = p_request_id;
  if found then
    if row(event.draft_id, event.previous_event_id, event.action, event.evidence_reference,
           event.document_revision, event.note)
      is distinct from row(p_draft_id, p_expected_event_id, p_action, evidence, revision, note) then
      raise exception using errcode = '23505', message = 'Chave de operação já usada com outros dados.';
    end if;
    return to_jsonb(event) - array['request_id', 'sequence'];
  end if;

  select e.* into latest from cali_v2_onboarding.adhesion_events e
  where e.draft_id = p_draft_id order by e.sequence desc limit 1;
  if latest.id is distinct from p_expected_event_id
    or (p_action = 'withdrawn' and latest.action is distinct from 'confirmed') then
    raise exception using errcode = '40001', message = 'A comprovação mudou. Recarregue antes de continuar.';
  end if;

  insert into cali_v2_onboarding.adhesion_events as e
    (draft_id, previous_event_id, action, evidence_reference, document_revision, note, recorded_by, request_id)
  values (p_draft_id, latest.id, p_action, evidence, revision, note, actor, p_request_id)
  returning e.* into event;
  return to_jsonb(event) - array['request_id', 'sequence'];
end;
$$;

create function cali_v2_onboarding.read_draft(p_draft_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  perform cali_v2_onboarding.require_admin();
  select jsonb_build_object(
    'draft', to_jsonb(d) - 'request_id',
    'history', coalesce((
      select jsonb_agg(to_jsonb(e) - array['request_id', 'sequence'] order by e.sequence desc)
      from cali_v2_onboarding.adhesion_events e where e.draft_id = d.id
    ), '[]'::jsonb)
  ) into result
  from cali_v2_onboarding.company_drafts d where d.id = p_draft_id;
  return result;
end;
$$;

-- Wrappers invoker no schema já exposto. O schema dos definers fica fora da Data API.
create function cali_workspace.v2_create_company_draft(
  p_request_id uuid, p_display_name text, p_legal_name text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select cali_v2_onboarding.create_draft(p_request_id, p_display_name, p_legal_name); $$;

create function cali_workspace.v2_review_company_adhesion(
  p_draft_id uuid, p_request_id uuid, p_expected_event_id uuid, p_action text,
  p_evidence_reference text, p_document_revision text, p_note text
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select cali_v2_onboarding.review_adhesion(
    p_draft_id, p_request_id, p_expected_event_id, p_action, p_evidence_reference, p_document_revision, p_note
  );
$$;

create function cali_workspace.v2_read_company_draft(p_draft_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select cali_v2_onboarding.read_draft(p_draft_id); $$;

revoke all on function cali_v2_onboarding.require_admin(),
  cali_v2_onboarding.create_draft(uuid, text, text),
  cali_v2_onboarding.review_adhesion(uuid, uuid, uuid, text, text, text, text),
  cali_v2_onboarding.read_draft(uuid),
  cali_workspace.v2_create_company_draft(uuid, text, text),
  cali_workspace.v2_review_company_adhesion(uuid, uuid, uuid, text, text, text, text),
  cali_workspace.v2_read_company_draft(uuid)
  from public, anon, authenticated, service_role;

grant execute on function cali_v2_onboarding.create_draft(uuid, text, text),
  cali_v2_onboarding.review_adhesion(uuid, uuid, uuid, text, text, text, text),
  cali_v2_onboarding.read_draft(uuid),
  cali_workspace.v2_create_company_draft(uuid, text, text),
  cali_workspace.v2_review_company_adhesion(uuid, uuid, uuid, text, text, text, text),
  cali_workspace.v2_read_company_draft(uuid) to authenticated;

commit;
