-- Usar somente em uma instância PostgreSQL descartável. O ensaio faz COMMITs.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role;
begin;
set plpgsql.check_asserts=on;
\ir elimination-resume-qa.sql
\ir prove-elimination-resume-qa.sql
commit;
\echo Fase 4E: eliminação fictícia retomada sem repetir etapas confirmadas.
