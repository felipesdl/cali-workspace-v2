-- Retirar o acesso aos endpoints antes de voltar a SPA anterior.
-- Preserva cadastro, contatos, logo, referências e auditoria.
begin;
set local lock_timeout = '5s';
revoke execute on function cali_workspace.v2_update_pilot_company_contract(uuid,timestamptz,jsonb),
  cali_workspace.v2_read_pilot_company_brand(uuid),
  cali_workspace.v2_update_pilot_company_brand(uuid,timestamptz,text,jsonb,text,text)
  from authenticated;
notify pgrst, 'reload schema';
commit;
