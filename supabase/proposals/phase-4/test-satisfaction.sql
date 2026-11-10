begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  record_id uuid := gen_random_uuid();
  delivery uuid := gen_random_uuid();
  original uuid := gen_random_uuid();
  high uuid := gen_random_uuid();
  respondent uuid := '00000000-0000-4000-8000-000000000011';
  rated_at timestamptz := '2026-11-01 17:00Z';
  handled_at timestamptz;
  followup uuid;
  payload jsonb;
  revision_id text;
begin
  insert into cali_workspace.account_records(id,company_id,title,workflow_status,visibility)
  values(record_id,a,'Ocorrência QA','completed','client');
  insert into cali_workspace.account_record_feedback(record_id,company_id,user_id,score,comment,created_at)
  values(record_id,a,respondent,1,'Comentário original',rated_at);
  insert into cali_workspace.deliverables(id,company_id,title) values(delivery,a,'Entrega QA');
  insert into cali_workspace.nps_responses(id,company_id,deliverable_id,score,comment,created_at)
  values(original,a,delivery,2,'Avaliação original da entrega',rated_at),
    (high,a,delivery,5,'Avaliação positiva',rated_at);
  insert into cali_session_guard.phase4_delivery_corrections(company_id,delivery_id,opened_by,reason,approved_at,score,comment)
  values(a,delivery,respondent,'Correção sintética',rated_at,3,'Avaliação da correção')
  returning 'correction:'||id into revision_id;
  set local role authenticated;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_satisfaction(a,1);
    raise exception 'Cliente consultou notas internas de acompanhamento';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',original::text,rated_at,null,'prazo','Nota');
    raise exception 'Admin sem MFA registrou acompanhamento';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  payload := cali_workspace.v2_read_pilot_satisfaction(a,1);
  assert payload->>'total'='3' and payload::text not like '%Avaliação positiva%';
  assert cali_workspace.v2_read_pilot_satisfaction(b,1)->>'total'='0';
  begin
    perform cali_workspace.v2_save_pilot_satisfaction_followup(b,'deliverable',original::text,rated_at,null,'prazo','Nota');
    raise exception 'Acompanhamento de outra empresa aceito';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',high::text,rated_at,null,'prazo','Nota');
    raise exception 'Nota positiva virou tratativa de nota baixa';
  exception when serialization_failure then null; end;
  followup := cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',original::text,rated_at,null,'prazo','Anotação reservada');
  assert cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',original::text,rated_at,null,'prazo','Anotação reservada')=followup;
  begin
    perform cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',original::text,rated_at,null,'outro','Atualização concorrente');
    raise exception 'Sobrescrita obsoleta aceita';
  exception when serialization_failure then null; end;
  select (row#>>'{followup,handledAt}')::timestamptz into handled_at
  from jsonb_array_elements(cali_workspace.v2_read_pilot_satisfaction(a,1)->'entries') row
  where row->>'response'=original::text;
  assert cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',original::text,rated_at,handled_at,'qualidade','Atualizado')=followup;
  assert cali_workspace.v2_save_pilot_satisfaction_followup(a,'deliverable',revision_id,rated_at,null,null,null)<>followup;
  payload := cali_workspace.v2_read_pilot_audit(a,null,1);
  assert payload->>'total'='3';
  assert payload::text not like '%Anotação%' and payload::text not like '%Atualizado%';
  reset role;
  assert (select score from cali_workspace.nps_responses where id=original)=2;
  assert (select comment from cali_workspace.nps_responses where id=original)='Avaliação original da entrega';
  assert not exists(select 1 from cali_workspace.notifications where company_id=a);
end $$;
rollback;
\echo Fase 4: acompanhamento Admin validado sem modificar avaliações ou notificar o Cliente.
