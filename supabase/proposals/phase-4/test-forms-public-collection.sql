-- Simula só o contrato de persistência da submissão legada.
create function public.cali_form_submit(p_slug text,p_answers jsonb)
returns jsonb language sql set search_path=''
as $$
  insert into cali_workspace.form_responses(id,form_id,answers)
  select gen_random_uuid(),f.id,p_answers from cali_workspace.forms f
  where f.slug=p_slug and f.status='open'
  returning '{"ok":true}'::jsonb;
$$;
\ir forms-public-collection.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  form uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  slug text;
  question text;
  version timestamptz;
  answers jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_form_draft(a,form,'coleta-sintetica-qa','Coleta sintética');
  select (item->>'slug') into slug
    from jsonb_array_elements(cali_workspace.v2_list_pilot_forms(a,1)) item where item->>'id'=form::text;
  assert public.v2_read_pilot_public_text_form(slug) is null;
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"short_text","label":"Pergunta QA","required":true}');
  perform cali_workspace.v2_open_pilot_public_form(a,form,'draft',true);
  set local role anon;
  question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,0,id}';
  assert question is not null;
  answers:=jsonb_build_object(question,'Resposta sintética');
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||'{"__visited":""}');
    raise exception 'Campo de controle injetado';
  exception when invalid_parameter_value then null; end;
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  begin
    perform public.v2_submit_pilot_public_text_form(slug,request,jsonb_build_object(question,'Resposta alterada'));
    raise exception 'Repetição com conteúdo alterado aceita';
  exception when serialization_failure then null; end;
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_set_pilot_form_state(a,form,'open','closed');
  set local role anon;
  assert public.v2_read_pilot_public_text_form(slug)='{"status":"closed"}'::jsonb;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers);
    raise exception 'Coleta encerrada aceitou nova resposta';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select count(*) from cali_workspace.form_responses where form_id=form)=1;
end;
$$;
rollback;
