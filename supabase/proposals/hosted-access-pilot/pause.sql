-- Suspensão do piloto. Preserva admissões, cortes e a negação nas policies.
begin;
set local lock_timeout = '5s';

create or replace function cali_session_guard.profile_login_eligible(subject uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select false; $$;

commit;
