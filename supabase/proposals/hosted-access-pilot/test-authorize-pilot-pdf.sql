\set cali_skip_pilot_pause 1
\ir test.sql
\unset cali_skip_pilot_pause
\ir individual-invites.sql
\ir authorize-pilot-pdf.sql

do $$
declare
  company_b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  invite_b uuid;
  publication jsonb;
begin
  select invite_id into strict invite_b from cali_session_guard.pilot_accounts where company_id=company_b;
  if has_function_privilege('anon','cali_workspace.v2_can_download_pilot_pdf(text)','execute')
    or has_function_privilege('service_role','cali_workspace.v2_can_download_pilot_pdf(text)','execute') then
    raise exception 'RPC de autorização tem GRANT fora do papel autenticado';
  end if;
  set local role authenticated;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  if cali_workspace.v2_can_download_pilot_pdf('b') then
    raise exception 'Cliente sem aceite acessou o PDF';
  end if;
  publication := cali_workspace.v2_read_terms_state();
  perform cali_workspace.v2_accept_terms(publication->>'version', publication->>'contentHash');
  if not cali_workspace.v2_can_download_pilot_pdf('b')
    or cali_workspace.v2_can_download_pilot_pdf('a')
    or cali_workspace.v2_can_download_pilot_pdf(null) then
    raise exception 'Aceite não liberou exclusivamente a fixture de B';
  end if;
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000014","session_id":"00000000-0000-4000-8000-000000000024","aal":"aal2"}',true);
  if cali_workspace.v2_can_download_pilot_pdf('b') then
    raise exception 'Admin não é leitor da rota Cliente';
  end if;
  perform cali_workspace.v2_revoke_pilot_invite(company_b, invite_b);
  perform set_config('test.jwt',
    '{"sub":"00000000-0000-4000-8000-000000000012","session_id":"00000000-0000-4000-8000-000000000022"}',true);
  if cali_workspace.v2_can_download_pilot_pdf('b') then
    raise exception 'Sessão de B baixou depois do corte';
  end if;
end;
$$;
\ir rollback-pilot-pdf.sql
