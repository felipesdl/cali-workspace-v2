\set cali_skip_pilot_pause 1
\ir ../hosted-access-pilot/test.sql
\unset cali_skip_pilot_pause
\ir ../hosted-access-pilot/individual-invites.sql
\ir ../../../tests/fixtures/team/directory.sql
\ir directory.sql

do $$
declare
  ca constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  cb constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  mb constant uuid := '10000000-0000-4000-8000-000000000002';
  member jsonb;
  publication jsonb;
  directory jsonb;
begin
  if has_function_privilege('anon','cali_workspace.v2_list_pilot_team(uuid,text,text,integer)','execute')
    or has_function_privilege('authenticated','cali_session_guard.require_pilot_team_actor(uuid)','execute') then
    raise exception 'GRANT expôs Equipe fora da fronteira';
  end if;
  set local role authenticated;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  begin
    perform cali_workspace.v2_list_pilot_team(cb,'','all',1);
    raise exception 'Equipe aberta sem aceite';
  exception when insufficient_privilege then null;
  end;
  publication := cali_workspace.v2_read_terms_state();
  perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
  directory := cali_workspace.v2_list_pilot_team(cb,'analista','all',1);
  member := cali_workspace.v2_read_pilot_team_member(cb,mb);
  if directory->>'total' is distinct from '1' or member->>'employee_code' is distinct from 'QA-B'
    or member ? 'salary' or member ? 'gender' or member ? 'has_children'
    or cali_workspace.v2_read_pilot_team_member(cb,'10000000-0000-4000-8000-000000000001') is not null
    or (cali_workspace.v2_list_pilot_team(cb,'','archived',1)->>'total') is distinct from '0' then
    raise exception 'Projeção, filtros ou isolamento divergentes';
  end if;
  begin
    perform cali_workspace.v2_list_pilot_team(ca,'','all',1);
    raise exception 'Cliente B leu A';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000011","session_id":"00000000-0000-4000-8000-000000000025"}',true);
  begin
    perform cali_workspace.v2_list_pilot_team(ca,'','all',1);
    raise exception 'Sessão revogada leu Equipe';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal1"}',true);
  begin
    perform cali_workspace.v2_list_pilot_team(cb,'','all',1);
    raise exception 'Admin sem MFA leu Equipe';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  publication := cali_workspace.v2_read_terms_state();
  perform cali_workspace.v2_accept_terms(publication->>'version',publication->>'contentHash');
  if (cali_workspace.v2_list_pilot_team(ca,'','all',1)->>'total') is distinct from '1'
    or (cali_workspace.v2_list_pilot_team(cb,'','all',1)->>'total') is distinct from '1' then
    raise exception 'Admin com MFA não leu as duas empresas';
  end if;
end;
$$;
\if :{?cali_keep_team_directory}
\else
\ir rollback-directory.sql
\endif
