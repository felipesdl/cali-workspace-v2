\ir test.sql
create function cali_session_guard.is_pilot_account(subject uuid)
returns boolean language sql stable as $$ select subject::text = '00000000-0000-4000-8000-000000000002' $$;
create or replace function cali_session_guard.profile_requires_admission(subject uuid)
returns boolean language sql stable as $$ select cali_session_guard.is_pilot_account(subject) $$;
set cali.hosted_terms.activate_storage = 'reviewed';
update cali_v2_terms.publications set is_current=true where version='qa-next';
\ir activate-storage.sql
\ir ../hosted-access-pilot/hold-direct-documents.sql

insert into storage.objects values
  ('cali-workspace-private','qa/deliverables/report.pdf'),
  ('cali-workspace-private','qa/account/contract.pdf'),
  ('other-private','documents/qa/control.pdf');

do $$ begin
  perform set_config('test.operation','object.get_authenticated',true);
  perform set_config('test.live','yes',true);
  perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000002","session_id":"00000000-0000-4000-8000-000000000012"}',true);
  set local role authenticated;
  if (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true'
    or exists (select 1 from storage.objects where name in ('documents/qa/fixture.pdf','qa/deliverables/report.pdf'))
    or (select count(*) from storage.objects where name='qa/account/contract.pdf') <> 1
    or (select count(*) from storage.objects where bucket_id='other-private') <> 1 then
    raise exception 'Contenção escapou do recorte';
  end if;
  perform set_config('test.jwt','{"sub":"00000000-0000-4000-8000-000000000001"}',true);
  if (select count(*) from storage.objects) <> 4 then
    raise exception 'Ator fora do piloto foi afetado';
  end if;
end $$;
\ir ../hosted-access-pilot/rollback-hold-direct-documents.sql
do $$ begin
  if exists (select 1 from pg_policy where polname='v2_hold_pilot_direct_documents') then
    raise exception 'Rollback não retirou a contenção';
  end if;
end $$;
