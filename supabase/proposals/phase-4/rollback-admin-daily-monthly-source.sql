-- Desliga a produção futura; mantém os avisos já registrados.
begin;
set local lock_timeout='5s';
drop trigger if exists phase4_notify_first_client_month_review on cali_session_guard.team_month_events;
drop function if exists cali_session_guard.phase4_notify_first_client_month_review();
commit;
