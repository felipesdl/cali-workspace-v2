\ir privacy-qa-transport.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  pilot uuid; other uuid; other_company uuid;
begin
  insert into cali_session_guard.phase4_privacy_qa values(a,'[TESTE V2] Pedido de acesso');
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  pilot:=cali_workspace.v2_submit_pilot_privacy_request(a,gen_random_uuid(),'access','[TESTE V2] Pedido de acesso');
  other:=cali_workspace.v2_submit_pilot_privacy_request(a,gen_random_uuid(),'access','Outro pedido');
  perform cali_workspace.fixture_as('clientB');
  other_company:=cali_workspace.v2_submit_pilot_privacy_request(b,gen_random_uuid(),'access','[TESTE V2] Pedido de acesso');
  reset role;
  insert into cali_workspace.notifications values(a,pilot,'privacy_request','data_subject_request',true),
    (a,pilot,'privacy_answer','data_subject_request',true),(a,other,'privacy_answer','data_subject_request',true),
    (b,other_company,'privacy_request','data_subject_request',true);
  assert not exists(select 1 from cali_workspace.notifications where entity_id=pilot);
  assert (select count(*) from cali_workspace.notifications where entity_id in (other,other_company) and email_required)=2;
end $$;
rollback;
\echo Fase 4E: pedido inscrito não notifica; outras solicitações preservam o transporte.
