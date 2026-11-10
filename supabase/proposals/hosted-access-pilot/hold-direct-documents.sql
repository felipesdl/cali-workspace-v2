-- A/B: a fase 2A não tem download Cliente. O CDN reaproveitou a URL de teste
-- após o corte, embora a origem tenha recusado uma URL inédita.
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regprocedure('cali_session_guard.is_pilot_account(uuid)') is null
    or not exists (
      select 1 from pg_policy where polrelid='storage.objects'::regclass
        and polname='v2_hosted_current_terms_for_files' and not polpermissive
    ) then
    raise exception 'A contenção exige o piloto e a guarda de arquivos instalada.';
  end if;
end $$;

create function cali_v2_terms.pilot_direct_document_allowed(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (
    split_part(p_path, '/', 1) <> 'documents' and split_part(p_path, '/', 2) <> 'deliverables'
  ) or not cali_session_guard.is_pilot_account(auth.uid());
$$;
revoke all on function cali_v2_terms.pilot_direct_document_allowed(text)
  from public, anon, authenticated, service_role;
grant execute on function cali_v2_terms.pilot_direct_document_allowed(text) to authenticated;

create policy v2_hold_pilot_direct_documents on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'cali-workspace-private'
      or cali_v2_terms.pilot_direct_document_allowed(name)
  );

commit;
