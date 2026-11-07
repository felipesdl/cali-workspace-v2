begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  form uuid := gen_random_uuid();
  response uuid := gen_random_uuid();
  data jsonb;
begin
  insert into cali_workspace.forms(id,company_id,slug,title,status,questions,stages)
  values(form,a,'qa-triagem','Form QA','closed','[]','["Novo","Em análise"]');
  insert into cali_workspace.form_responses(id,form_id,respondent_name,respondent_email,answers)
  values(response,form,'Respondente QA','form@example.test','{"question":"Conteúdo privado QA"}');
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_list_pilot_form_triage(a,form,1);
    raise exception 'Listagem sem MFA aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_save_pilot_form_triage(a,form,response,null,null,'Novo','');
    raise exception 'Escrita Cliente aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_pilot_form_triage(b,form,1) is null;
  begin
    perform cali_workspace.v2_save_pilot_form_triage(b,form,response,null,null,'Novo','');
    raise exception 'Escrita em outra empresa aceita';
  exception when insufficient_privilege then null; end;
  data := cali_workspace.v2_list_pilot_form_triage(a,form,1);
  assert data->'stages'='["Novo","Em análise"]'::jsonb;
  assert data#>>'{responses,0,id}'=response::text;
  assert not (data#>'{responses,0}' ?| array['answers','respondent_email']);
  begin
    perform cali_workspace.v2_save_pilot_form_triage(a,form,response,null,null,'Inválida','');
    raise exception 'Etapa inexistente aceita';
  exception when invalid_parameter_value then null; end;
  assert cali_workspace.v2_save_pilot_form_triage(a,form,response,null,null,'Em análise','Pessoa QA')=response;
  assert cali_workspace.v2_save_pilot_form_triage(a,form,response,null,null,'Em análise','Pessoa QA')=response;
  begin
    perform cali_workspace.v2_save_pilot_form_triage(a,form,response,null,null,'Novo','');
    raise exception 'Triagem obsoleta aceita';
  exception when serialization_failure then null; end;
  reset role;
  assert exists(select 1 from cali_workspace.form_responses where id=response
    and stage='Em análise' and owner='Pessoa QA' and answers->>'question'='Conteúdo privado QA');
  assert (select count(*) from cali_workspace.activity_log where entity_id=response and event_type='form_response_triaged')=1;
end $$;
rollback;
\echo Fase 4: triagem Forms validada com MFA, isolamento e proteção contra sobrescrita.
