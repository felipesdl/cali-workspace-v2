-- Executar apenas em PostgreSQL descartável. Os contratos predecessores são fixtures.
create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
create table cali_workspace.forms(
  id uuid primary key, slug text unique, status text, title text, description text, questions jsonb
);
create table cali_workspace.activity_log(entity_type text, entity_id uuid, event_type text);
create table cali_workspace.form_responses(form_id uuid, answers jsonb);

create function cali_session_guard.phase4_public_text_form(p_slug text)
returns cali_workspace.forms language sql stable as $$
  select f from cali_workspace.forms f where f.slug = p_slug and exists (
    select 1 from cali_workspace.activity_log l where l.entity_id = f.id and l.event_type = 'form_open'
  );
$$;
create function cali_session_guard.phase4_form_reachable(p_questions jsonb, p_answers jsonb)
returns table(question jsonb) language sql immutable as $$
  select p_questions->0;
$$;
create function public.cali_form_public(p_slug text)
returns jsonb language sql stable as $$
  select to_jsonb(f) from cali_workspace.forms f where f.slug = p_slug and f.status in ('open', 'closed');
$$;
create function public.cali_form_submit(p_slug text, p_answers jsonb)
returns jsonb language plpgsql as $$
begin
  assert p_answers->'__visited' = '["name"]';
  assert p_answers ? 'name';
  insert into cali_workspace.form_responses select id, p_answers from cali_workspace.forms where slug = p_slug;
  return '{"ok":true,"confirmation":false}';
end;
$$;
create function public.v2_submit_pilot_public_text_form(p_slug text, p_request_id uuid, p_answers jsonb)
returns boolean language plpgsql as $$
begin
  assert not (p_answers ? '__visited');
  insert into cali_workspace.form_responses select id, p_answers from cali_workspace.forms where slug = p_slug;
  return true;
end;
$$;

insert into cali_workspace.forms values
  ('10000000-0000-4000-8000-000000000001', 'form-legado', 'open', 'Form legado', null, '[{"id":"name"}]'),
  ('10000000-0000-4000-8000-000000000002', 'form-piloto', 'open', 'Form piloto', null, '[{"id":"name"}]'),
  ('10000000-0000-4000-8000-000000000003', 'form-inativo', 'open', 'V2 sem abertura', null, '[{"id":"name"}]');
insert into cali_workspace.activity_log values
  ('form','10000000-0000-4000-8000-000000000002','form_draft_created'),
  ('form','10000000-0000-4000-8000-000000000002','form_open'),
  ('form','10000000-0000-4000-8000-000000000003','form_draft_created');

\ir forms-origin-dispatch.sql

set role anon;
do $$
declare
  legacy_id uuid := '10000000-0000-4000-8000-000000000001';
  pilot_id uuid := '10000000-0000-4000-8000-000000000002';
  request_id uuid := gen_random_uuid();
  answers jsonb := '{"name":"Pessoa sintética","__visited":[]}';
begin
  assert public.v2_resolve_public_form('form-legado')->>'source' = 'legacy';
  assert public.v2_resolve_public_form('form-piloto')->>'source' = 'pilot';
  assert public.v2_resolve_public_form('form-inativo')->>'source' = 'unavailable';
  assert public.v2_submit_resolved_public_form('form-legado', legacy_id, 'legacy', request_id, answers)->>'ok' = 'true';
  assert public.v2_submit_resolved_public_form('form-legado', legacy_id, 'legacy', request_id, answers)->>'ok' = 'true';
  assert public.v2_submit_resolved_public_form('form-piloto', pilot_id, 'pilot', gen_random_uuid(), answers)->>'ok' = 'true';

  begin
    perform public.v2_submit_resolved_public_form('form-legado', legacy_id, 'pilot', request_id, answers);
    raise exception 'Origem divergente aceita';
  exception when no_data_found then null;
  end;
  begin
    perform public.v2_submit_resolved_public_form('form-legado', pilot_id, 'legacy', request_id, answers);
    raise exception 'Identidade divergente aceita';
  exception when no_data_found then null;
  end;
  begin
    perform public.v2_submit_resolved_public_form('form-legado', legacy_id, 'legacy', request_id, answers || '{"name":"Outra pessoa"}');
    raise exception 'Tentativa reaproveitada para outras respostas';
  exception when serialization_failure then null;
  end;
  begin
    perform public.v2_submit_resolved_public_form('form-legado', legacy_id, 'legacy', gen_random_uuid(), answers || '{"hidden":"fora do caminho"}');
    raise exception 'Resposta fora do caminho aceita';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;

do $$
begin
  assert (select count(*) from cali_workspace.form_responses) = 2;
  assert (select count(*) from cali_session_guard.phase4_legacy_form_receipts) = 1;
  assert not has_table_privilege('anon', 'cali_session_guard.phase4_legacy_form_receipts', 'SELECT');
end;
$$;
\ir forms-origin-dispatch-rollback.sql
do $$
begin
  assert to_regprocedure('public.v2_resolve_public_form(text)') is null;
  assert (select count(*) from cali_workspace.form_responses) = 2;
end;
$$;
