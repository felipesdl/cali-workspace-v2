-- Somente PostgreSQL descartável, com atores e schemas sintéticos.
-- Executar neste diretório: psql -X -v ON_ERROR_STOP=1 -f acceptance.sql.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema cali_workspace;

create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable
as $$ select jsonb_build_object('aal', current_setting('test.aal', true)) $$;
create table auth.mfa_factors (user_id uuid, status text, factor_type text);
create table cali_workspace.profiles (id uuid primary key, role text, active boolean);
create table cali_workspace.companies (id uuid primary key);
create table cali_workspace.client_invites (id uuid primary key);
create function cali_workspace.create_client_account() returns text language sql
as $$ select 'legacy'::text $$;

grant usage on schema cali_workspace to authenticated, anon, service_role;
grant select on cali_workspace.companies to authenticated;
grant execute on function cali_workspace.create_client_account() to authenticated;
alter default privileges grant usage, update on sequences to authenticated;
insert into cali_workspace.profiles values
  ('00000000-0000-4000-8000-000000000001', 'admin', true),
  ('00000000-0000-4000-8000-000000000002', 'client', true),
  ('00000000-0000-4000-8000-000000000003', 'admin', false),
  ('00000000-0000-4000-8000-000000000004', 'admin', true);
insert into auth.mfa_factors select id, 'verified', 'totp'
from cali_workspace.profiles where id <> '00000000-0000-4000-8000-000000000004';

\ir candidate.sql

do $$
begin
  if has_function_privilege('anon', 'cali_workspace.v2_create_company_draft(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'cali_workspace.v2_read_company_draft(uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'cali_v2_onboarding.company_drafts', 'INSERT')
    or has_table_privilege('service_role', 'cali_v2_onboarding.adhesion_events', 'UPDATE')
    or has_sequence_privilege('authenticated', 'cali_v2_onboarding.adhesion_events_sequence_seq', 'UPDATE')
    or not has_function_privilege('authenticated', 'cali_workspace.create_client_account()', 'EXECUTE')
    or not has_table_privilege('authenticated', 'cali_workspace.companies', 'SELECT') then
    raise exception 'Privilégios inesperados.';
  end if;
end;
$$;

set role authenticated;
do $$
declare
  actor uuid;
  attempt integer;
  draft uuid;
  proof uuid;
  request uuid := '00000000-0000-4000-8000-000000000011';
  proof_request uuid := '00000000-0000-4000-8000-000000000012';
  withdrawal_request uuid := '00000000-0000-4000-8000-000000000013';
  snapshot jsonb;
begin
  for attempt in 1..4 loop
    actor := ('00000000-0000-4000-8000-00000000000' || attempt)::uuid;
    perform set_config('test.actor', actor::text, true);
    perform set_config('test.aal', case when attempt = 1 then 'aal1' else 'aal2' end, true);
    begin
      perform cali_workspace.v2_create_company_draft(request, 'Empresa sintética', null);
      raise exception 'Ator sem autorização aceito.';
    exception when insufficient_privilege then null;
    end;
  end loop;

  perform set_config('test.actor', '00000000-0000-4000-8000-000000000001', true);
  perform set_config('test.aal', 'aal2', true);
  draft := (cali_workspace.v2_create_company_draft(request, ' Empresa sintética ', null) ->> 'id')::uuid;
  if draft is null or (cali_workspace.v2_create_company_draft(request, 'Empresa sintética', '') ->> 'id')::uuid
    is distinct from draft then
    raise exception 'Replay de cadastro divergente.';
  end if;
  begin
    perform cali_workspace.v2_create_company_draft(request, 'Outro nome', null);
    raise exception 'Replay conflitante aceito.';
  exception when unique_violation then null;
  end;

  snapshot := cali_workspace.v2_read_company_draft(draft);
  if snapshot #>> '{draft,legal_name}' is distinct from 'Empresa sintética'
    or snapshot -> 'history' is distinct from '[]'::jsonb then
    raise exception 'Snapshot inicial inválido.';
  end if;
  proof := (cali_workspace.v2_review_company_adhesion(
    draft, proof_request, null, 'confirmed', 'Contrato sintético', 'rev-1', 'Conferido'
  ) ->> 'id')::uuid;
  begin
    perform cali_workspace.v2_review_company_adhesion(
      draft, gen_random_uuid(), null, 'confirmed', 'Contrato sintético', 'rev-2', 'Preimagem vencida'
    );
    raise exception 'Preimagem vencida aceita.';
  exception when serialization_failure then null;
  end;
  perform cali_workspace.v2_review_company_adhesion(
    draft, withdrawal_request, proof, 'withdrawn', null, null, 'Retirada sintética'
  );
  if (cali_workspace.v2_review_company_adhesion(
    draft, proof_request, null, 'confirmed', 'Contrato sintético', 'rev-1', 'Conferido'
  ) ->> 'id')::uuid is distinct from proof then
    raise exception 'Replay de confirmação após retirada divergente.';
  end if;
  snapshot := cali_workspace.v2_read_company_draft(draft);
  if jsonb_array_length(snapshot -> 'history') <> 2
    or snapshot #>> '{history,0,action}' is distinct from 'withdrawn'
    or snapshot #>> '{history,1,document_revision}' is distinct from 'rev-1'
    or snapshot #>> '{history,0,previous_event_id}' is distinct from proof::text then
    raise exception 'Histórico inválido.';
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (select 1 from cali_workspace.companies)
    or exists (select 1 from cali_workspace.client_invites)
    or cali_workspace.create_client_account() <> 'legacy' then
    raise exception 'Candidata alterou o contrato legado.';
  end if;
end;
$$;
