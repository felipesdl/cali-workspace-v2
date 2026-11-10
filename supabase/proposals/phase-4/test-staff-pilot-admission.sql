-- Rodar na base descartável depois de test-staff-roster.sql.
\ir staff-roster-write.sql
\ir staff-roster-activation.sql
begin;
alter table auth.users add column email text,add column email_confirmed_at timestamptz,
  add column is_anonymous boolean not null default false;
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
set local cali.test_claims_name='test.jwt';
set local cali.test_admin_claims='{"sub":"00000000-0000-4000-8000-000000000014","role":"authenticated","aal":"aal2"}';
\ir staff-pilot-admission.sql
\ir prove-staff-pilot-admission.sql
rollback;
\echo Fase 4E: convite e corte da Equipe CALI comprovados no ensaio SQL.
