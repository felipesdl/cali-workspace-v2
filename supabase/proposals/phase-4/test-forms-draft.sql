begin;
do $$
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  form_id uuid := gen_random_uuid();
  existing_id uuid := gen_random_uuid();
  stamp timestamptz;
  data jsonb;
  simple jsonb := '{"id":"texto-antigo","kind":"short_text","label":"Pergunta antiga","logic":[{"when":"sim","goTo":"escolha"}]}';
  choice jsonb := '{"id":"escolha","kind":"single_choice","label":"Qual opção?","options":["A","B"]}';
begin
  insert into cali_workspace.forms(id,company_id,slug,title,status,questions)
  values(existing_id,a,'qa-existente','Legado QA','draft',jsonb_build_array(simple,choice));
  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_create_pilot_form_draft(a,form_id,'qa-rascunho','Teste');
    raise exception 'Criação sem MFA aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_create_pilot_form_draft(a,form_id,'qa-rascunho','Teste')=form_id;
  assert cali_workspace.v2_create_pilot_form_draft(a,form_id,'qa-rascunho','Teste')=form_id;
  assert cali_workspace.v2_read_pilot_form_draft(b,form_id) is null;
  data := cali_workspace.v2_read_pilot_form_draft(a,form_id);
  stamp := (data->>'updatedAt')::timestamptz;
  assert data->'questions'='[]'::jsonb;
  begin
    perform cali_workspace.v2_edit_pilot_form_draft(a,form_id,stamp,'add_question',
      '{"kind":"short_text","label":"<script>teste</script>","required":true}');
    raise exception 'Marcação aceita em campo público';
  exception when invalid_parameter_value then null; end;
  assert cali_workspace.v2_edit_pilot_form_draft(a,form_id,stamp,'add_question',
    '{"kind":"long_text","label":"Conte mais","required":true}')=form_id;
  begin
    perform cali_workspace.v2_edit_pilot_form_draft(a,form_id,stamp,'details','{"title":"Obsoleto"}');
    raise exception 'Atualização obsoleta aceita';
  exception when serialization_failure then null; end;
  assert cali_workspace.v2_open_pilot_public_form(a,form_id,'draft',true)=form_id;
  assert cali_workspace.v2_read_pilot_form_draft(a,form_id) is null;
  data := cali_workspace.v2_read_pilot_form_draft(a,existing_id);
  assert data#>>'{questions,0,required}'='false';
  stamp := (data->>'updatedAt')::timestamptz;
  assert cali_workspace.v2_edit_pilot_form_draft(a,existing_id,stamp,'edit_question',
    '{"id":"texto-antigo","label":"Pergunta revista","required":true}')=existing_id;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_form_draft(a,existing_id);
    raise exception 'Cliente leu rascunho';
  exception when insufficient_privilege then null; end;
  reset role;
  assert exists(select 1 from cali_workspace.forms where id=form_id and not confirm_email);
  assert (select questions->0->'logic' from cali_workspace.forms where id=existing_id)=simple->'logic';
  assert (select questions->1 from cali_workspace.forms where id=existing_id)=choice;
  assert (select count(*) from cali_workspace.activity_log where entity_id=form_id and event_type='form_draft_created')=1;
end $$;
rollback;
\echo Fase 4: rascunhos Forms validados com MFA, edição concorrente e preservação das perguntas legadas.
