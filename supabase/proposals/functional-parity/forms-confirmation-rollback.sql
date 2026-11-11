-- Suspender envios antes de restaurar a definição original, que pode apontar a outro ambiente.
begin;
drop trigger if exists v2_form_confirmation on cali_workspace.form_responses;
do $$
declare original text;
begin
  select definition into strict original from cali_session_guard.form_confirmation_preimage where name='legacy';
  execute original;
  select definition into strict original from cali_session_guard.form_confirmation_preimage where name='eligibility';
  execute original;
end $$;
drop function cali_session_guard.queue_v2_form_confirmation();
drop function cali_session_guard.form_confirmation_requested(uuid);
drop function cali_session_guard.form_confirmation_transport();
-- Recibos são mantidos para conferência e reconciliação.
drop table cali_session_guard.form_confirmation_preimage;
notify pgrst,'reload schema';
commit;
