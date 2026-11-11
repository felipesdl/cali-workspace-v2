begin;
set local lock_timeout = '5s';
drop function if exists public.v2_submit_resolved_public_form(text, uuid, text, uuid, jsonb);
drop function if exists public.v2_resolve_public_form(text);
-- Preserve the retry receipts for a future reactivation.
notify pgrst, 'reload schema';
commit;
