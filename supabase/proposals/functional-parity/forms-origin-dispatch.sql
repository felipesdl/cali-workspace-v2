-- Candidate only. Reconcile /f/:slug against the shared forms table before rollout.
-- Depends on the installed Fase 4 forms-public-collection contract and the legacy
-- public.cali_form_public / public.cali_form_submit functions from app.cali@773c9d4.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.phase4_legacy_form_receipts (
  form_id uuid not null references cali_workspace.forms(id) on delete cascade,
  request_id uuid not null,
  fingerprint bytea not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (form_id, request_id)
);
alter table cali_session_guard.phase4_legacy_form_receipts enable row level security;
revoke all on cali_session_guard.phase4_legacy_form_receipts from public, anon, authenticated, service_role;

create or replace function public.v2_resolve_public_form(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  form_row cali_workspace.forms;
  is_v2 boolean;
  resolved_pilot cali_workspace.forms;
  legacy jsonb;
begin
  if normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(normalized_slug) not between 3 and 100 then
    return null;
  end if;

  select f.* into form_row
    from cali_workspace.forms f
   where f.slug = normalized_slug;
  if not found then return null; end if;

  select exists (
    select 1 from cali_workspace.activity_log l
     where l.entity_type = 'form'
       and l.entity_id = form_row.id
       and l.event_type = 'form_draft_created'
  ) into is_v2;

  if is_v2 then
    resolved_pilot := cali_session_guard.phase4_public_text_form(normalized_slug);
    if resolved_pilot.id is distinct from form_row.id then
      -- Claimed V2 slug cannot fall through to the legacy reader.
      return jsonb_build_object('source', 'unavailable');
    end if;
    if resolved_pilot.status = 'closed' then
      return jsonb_build_object(
        'source', 'pilot', 'formId', resolved_pilot.id, 'slug', resolved_pilot.slug,
        'status', 'closed', 'title', resolved_pilot.title,
        'description', resolved_pilot.description, 'questions', '[]'::jsonb,
        'thankYou', null, 'successText', null, 'submitLabel', null,
        'confirmationEnabled', false
      );
    end if;
    return jsonb_build_object(
      'source', 'pilot', 'formId', resolved_pilot.id, 'slug', resolved_pilot.slug,
      'status', 'open', 'title', resolved_pilot.title,
      'description', resolved_pilot.description, 'questions', resolved_pilot.questions,
      'thankYou', null, 'successText', null, 'submitLabel', null,
      'confirmationEnabled', false
    );
  end if;

  -- Legacy records keep the V1 public projection and its current response contract.
  legacy := public.cali_form_public(normalized_slug);
  if legacy is null or legacy->>'id' is distinct from form_row.id::text then return null; end if;
  return jsonb_build_object(
    'source', 'legacy', 'formId', form_row.id, 'slug', form_row.slug,
    'status', legacy->>'status', 'title', legacy->>'title', 'category', legacy->'category',
    'description', legacy->'description', 'questions', coalesce(legacy->'questions', '[]'::jsonb),
    'thankYou', legacy->'thank_you', 'successText', legacy->'success_text',
    'submitLabel', legacy->'submit_label', 'confirmationEnabled', coalesce((legacy->>'confirm_email')::boolean, false)
  );
end;
$$;
revoke all on function public.v2_resolve_public_form(text) from public, anon, authenticated, service_role;
grant execute on function public.v2_resolve_public_form(text) to anon, authenticated;

create or replace function public.v2_submit_resolved_public_form(
  p_slug text, p_form_id uuid, p_origin text, p_request_id uuid, p_answers jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  resolved jsonb;
  resolved_form_id uuid;
  locked_form_id uuid;
  signature bytea;
  prior_signature bytea;
  prior_result jsonb;
  reached_ids jsonb;
  result jsonb;
begin
  if p_request_id is null or jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Confira as respostas.';
  end if;
  select f.id into locked_form_id from cali_workspace.forms f
   where f.id = p_form_id and f.slug = normalized_slug for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'A origem do formulário mudou. Recarregue antes de continuar.';
  end if;
  resolved := public.v2_resolve_public_form(normalized_slug);
  if resolved is null
    or resolved->>'formId' is distinct from p_form_id::text
    or resolved->>'source' is distinct from p_origin then
    raise exception using errcode = 'P0002', message = 'A origem do formulário mudou. Recarregue antes de continuar.';
  end if;
  resolved_form_id := (resolved->>'formId')::uuid;

  if resolved->>'source' = 'pilot' then
    if jsonb_typeof(p_answers->'__visited') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Confira o caminho percorrido.';
    end if;
    perform public.v2_submit_pilot_public_text_form(normalized_slug, p_request_id, p_answers - '__visited');
    return jsonb_build_object('ok', true, 'confirmation', false);
  end if;
  if resolved->>'source' is distinct from 'legacy' then
    raise exception using errcode = '42501', message = 'Este formulário não está recebendo respostas.';
  end if;

  signature := sha256(convert_to(p_answers::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(resolved_form_id::text || ':' || p_request_id::text, 0));
  select r.fingerprint, r.result into prior_signature, prior_result
    from cali_session_guard.phase4_legacy_form_receipts r
   where r.form_id = resolved_form_id and r.request_id = p_request_id;
  if found then
    if prior_signature = signature then return prior_result; end if;
    raise exception using errcode = '40001', message = 'Esta tentativa já foi registrada com outras respostas.';
  end if;
  if resolved->>'status' is distinct from 'open' then
    raise exception using errcode = '42501', message = 'Este formulário não está recebendo respostas.';
  end if;

  select coalesce(jsonb_agg(q.question->>'id'), '[]'::jsonb) into reached_ids
  from cali_session_guard.phase4_form_reachable(resolved->'questions', p_answers) q;
  if exists (select 1 from jsonb_object_keys(p_answers - '__visited') answer(id)
    where not (reached_ids ? answer.id)) then
    raise exception using errcode = '22023', message = 'Confira as respostas do caminho selecionado.';
  end if;

  result := public.cali_form_submit(normalized_slug, jsonb_set(p_answers, '{__visited}', reached_ids));
  if result->>'ok' is distinct from 'true' then
    raise exception using errcode = '22023', message = 'Não foi possível salvar as respostas.';
  end if;
  insert into cali_session_guard.phase4_legacy_form_receipts(form_id, request_id, fingerprint, result)
  values (resolved_form_id, p_request_id, signature, result);
  return result;
end;
$$;
revoke all on function public.v2_submit_resolved_public_form(text, uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.v2_submit_resolved_public_form(text, uuid, text, uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
