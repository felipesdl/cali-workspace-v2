begin;
set local lock_timeout='5s';
drop function if exists cali_session_guard.phase4_enqueue_admin_digest(timestamptz);
commit;
