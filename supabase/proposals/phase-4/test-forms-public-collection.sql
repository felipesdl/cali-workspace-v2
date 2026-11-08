-- Simula só o contrato de persistência da submissão legada.
create function public.cali_form_submit(p_slug text,p_answers jsonb)
returns jsonb language sql security definer set search_path=''
as $$
  insert into cali_workspace.form_responses(id,form_id,answers)
  select gen_random_uuid(),f.id,p_answers-'__visited' from cali_workspace.forms f
  where f.slug=p_slug and f.status='open'
  returning '{"ok":true}'::jsonb;
$$;
\ir forms-attachments.sql
\ir forms-public-collection.sql
\ir forms-export.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  form uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  slug text;
  question text;
  number_question text;
  date_question text;
  single_question text;
  multi_question text;
  yes_no_question text;
  name_question text;
  email_question text;
  phone_question text;
  contact_kind text;
  version timestamptz;
  answers jsonb;
  exported jsonb;
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_form_draft(a,form,'coleta-sintetica-qa','Coleta sintética');
  select (item->>'slug') into slug
    from jsonb_array_elements(cali_workspace.v2_list_pilot_forms(a,1)) item where item->>'id'=form::text;
  assert public.v2_read_pilot_public_text_form(slug) is null;
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"short_text","label":"Pergunta QA","required":true}');
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"number","label":"Número QA","required":true}');
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"date","label":"Data QA","required":true}');
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  begin
    perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"single_choice","label":"Duplicada","options":["Azul","Azul"]}');
    raise exception 'Alternativas duplicadas aceitas';
  exception when invalid_parameter_value then null; end;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"single_choice","label":"Cor QA","required":true,"options":["Azul","Verde"]}');
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"multi_choice","label":"Regiões QA","required":true,"options":["Norte","Sul"]}');
  version:=(cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,version,'add_question','{"kind":"yes_no","label":"Confirma QA","required":true}');
  foreach contact_kind in array array['name','email','phone'] loop
    perform cali_workspace.v2_edit_pilot_form_draft(a,form,
      (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
      'add_question',jsonb_build_object('kind',contact_kind,'label',contact_kind,'required',contact_kind<>'phone'));
  end loop;
  perform cali_workspace.v2_open_pilot_public_form(a,form,'draft',true);
  set local role anon;
  question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,0,id}';
  assert question is not null;
  number_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,1,id}';
  date_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,2,id}';
  single_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,3,id}';
  multi_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,4,id}';
  yes_no_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,5,id}';
  name_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,6,id}';
  email_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,7,id}';
  phone_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,8,id}';
  assert public.v2_read_pilot_public_text_form(slug)#>'{questions,3,options}'='["Azul","Verde"]'::jsonb;
  answers:=jsonb_build_object(question,'Resposta sintética',number_question,0,date_question,'2028-02-29',
    single_question,'Azul',multi_question,'["Norte","Sul"]'::jsonb,yes_no_question,'Não',
    name_question,'Pessoa de teste',email_question,'pessoa@example.invalid',phone_question,'+55 (11) 99999-1234');
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(single_question,'Vermelho'));
    raise exception 'Alternativa fora da lista aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(multi_question,'["Norte","Norte"]'::jsonb));
    raise exception 'Alternativa selecionada duas vezes aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(number_question,'0'));
    raise exception 'Número enviado como texto foi aceito';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(date_question,'2026-02-29'));
    raise exception 'Data impossível aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers-date_question);
    raise exception 'Data obrigatória ausente aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||'{"__visited":""}');
    raise exception 'Campo de controle injetado';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cali_form_submit(slug,answers||jsonb_build_object(email_question,'email inválido'));
    raise exception 'Endpoint legado aceitou e-mail inválido';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(phone_question,'1234567'));
    raise exception 'Telefone com poucos dígitos aceito';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(name_question,'   '));
    raise exception 'Nome obrigatório em branco aceito';
  exception when invalid_parameter_value then null; end;
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  begin
    perform public.v2_submit_pilot_public_text_form(slug,request,jsonb_build_object(question,'Resposta alterada'));
    raise exception 'Repetição com conteúdo alterado aceita';
  exception when serialization_failure then null; end;
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  begin
    perform cali_workspace.v2_export_pilot_form_responses(a,form);
    raise exception 'Coleta aberta exportada';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.v2_set_pilot_form_state(a,form,'open','closed');
  exported:=cali_workspace.v2_export_pilot_form_responses(a,form);
  assert exported#>>'{responses,0,values,0}'='Resposta sintética';
  assert exported#>>'{questions,0,label}'='Pergunta QA';
  assert exported#>>'{responses,0,values,1}'='0';
  assert exported#>>'{responses,0,values,2}'='2028-02-29';
  assert exported#>>'{responses,0,values,3}'='Azul';
  assert exported#>>'{responses,0,values,4}'='Norte, Sul';
  assert exported#>>'{responses,0,values,5}'='Não';
  assert exported#>>'{responses,0,values,6}'='Pessoa de teste';
  assert exported#>>'{responses,0,values,7}'='pessoa@example.invalid';
  assert exported#>>'{responses,0,values,8}'='+55 (11) 99999-1234';
  assert exported::text not like '%respondent_email%';
  begin
    perform cali_workspace.v2_export_pilot_form_responses(b,form);
    raise exception 'Exportação cruzada aceita';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_export_pilot_form_responses(a,form);
    raise exception 'Cliente exportou Forms';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_export_pilot_form_responses(a,form);
    raise exception 'Admin sem MFA exportou Forms';
  exception when insufficient_privilege then null; end;
  set local role anon;
  assert public.v2_read_pilot_public_text_form(slug)='{"status":"closed"}'::jsonb;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers);
    raise exception 'Coleta encerrada aceitou nova resposta';
  exception when insufficient_privilege then null; end;
  reset role;
  assert not has_function_privilege('anon','cali_workspace.v2_export_pilot_form_responses(uuid,uuid)','execute');
  assert (select count(*) from cali_workspace.activity_log where entity_id=form and event_type='form_responses_exported')=1;
  assert (select count(*) from cali_workspace.form_responses where form_id=form)=1;
end;
$$;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  form uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  slug constant text:='coleta-ramificada-qa';
  pick text;
  skipped text;
  final text;
  answers jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_form_draft(a,form,slug,'Coleta ramificada');
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,
    (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
    'add_question','{"kind":"yes_no","label":"Pular?","required":true}');
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,
    (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
    'add_question','{"kind":"short_text","label":"Motivo","required":true}');
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,
    (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
    'add_question','{"kind":"short_text","label":"Conclusão","required":true}');
  pick:=cali_workspace.v2_read_pilot_form_draft(a,form)#>>'{questions,0,id}';
  skipped:=cali_workspace.v2_read_pilot_form_draft(a,form)#>>'{questions,1,id}';
  final:=cali_workspace.v2_read_pilot_form_draft(a,form)#>>'{questions,2,id}';
  begin
    perform cali_workspace.v2_edit_pilot_form_draft(a,form,
      (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
      'set_logic',jsonb_build_object('id',pick,'logic',jsonb_build_array(jsonb_build_object('when','Sim','goTo',pick))));
    raise exception 'Salto para a própria pergunta aceito';
  exception when invalid_parameter_value then null; end;
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,
    (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
    'set_logic',jsonb_build_object('id',pick,'logic',jsonb_build_array(
      jsonb_build_object('when','Sim','goTo',final),jsonb_build_object('when','Não','goTo','__end'))));
  assert cali_workspace.v2_read_pilot_form_draft(a,form)#>>'{questions,0,logic,0,goTo}'=final;
  perform cali_workspace.v2_open_pilot_public_form(a,form,'draft',true);
  set local role anon;
  assert public.v2_read_pilot_public_text_form(slug)#>>'{questions,0,logic,0,goTo}'=final;
  answers:=jsonb_build_object(pick,'Sim',final,'Conclusão sintética');
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers||jsonb_build_object(skipped,'ignorada'));
    raise exception 'Resposta fora do caminho aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),answers-final);
    raise exception 'Resposta obrigatória do caminho ausente';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cali_form_submit(slug,(answers-final)||jsonb_build_object('__visited',jsonb_build_array(pick)));
    raise exception 'Endpoint legado aceitou caminho fabricado';
  exception when invalid_parameter_value then null; end;
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  assert public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),jsonb_build_object(pick,'Não'));
  set local role authenticated;
  perform cali_workspace.v2_set_pilot_form_state(a,form,'open','closed');
  assert jsonb_array_length(cali_workspace.v2_export_pilot_form_responses(a,form)->'responses')=2;
  reset role;
  assert (select count(*) from cali_workspace.form_responses r where r.form_id=form)=2;
  assert not exists(select 1 from cali_workspace.form_responses r
    where r.form_id=form and (r.answers ? '__visited' or r.answers ? skipped));
end;
$$;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  form uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid();
  slug constant text:='coleta-anexo-qa';
  pdf bytea:=convert_to('%PDF-1.4','UTF8');
  question text;
  name_question text;
  email_question text;
  contact_kind text;
  response uuid;
  answers jsonb;
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_form_draft(a,form,slug,'Coleta com PDF');
  perform cali_workspace.v2_edit_pilot_form_draft(a,form,
    (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
    'add_question','{"kind":"file","label":"Documento","required":true}');
  foreach contact_kind in array array['name','email'] loop
    perform cali_workspace.v2_edit_pilot_form_draft(a,form,
      (cali_workspace.v2_read_pilot_form_draft(a,form)->>'updatedAt')::timestamptz,
      'add_question',jsonb_build_object('kind',contact_kind,'label',contact_kind,'required',contact_kind<>'phone'));
  end loop;
  perform cali_workspace.v2_open_pilot_public_form(a,form,'draft',true);
  set local role anon;
  question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,0,id}';
  name_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,1,id}';
  email_question:=public.v2_read_pilot_public_text_form(slug)#>>'{questions,2,id}';
  begin
    perform public.v2_submit_pilot_public_text_form(slug,gen_random_uuid(),
      jsonb_build_object(question,encode(convert_to('inválido','UTF8'),'base64')));
    raise exception 'Arquivo sem assinatura PDF aceito';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cali_form_submit(slug,jsonb_build_object(question,'[PDF anexado]'));
    raise exception 'Marcador de PDF sem arquivo aceito';
  exception when invalid_parameter_value then null; end;
  answers:=jsonb_build_object(question,encode(pdf,'base64'),name_question,'Pessoa fictícia',
    email_question,'PESSOA@example.invalid');
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  assert public.v2_submit_pilot_public_text_form(slug,request,answers);
  set local role authenticated;
  response:=(cali_workspace.v2_list_pilot_form_triage(a,form,1)#>>'{responses,0,id}')::uuid;
  assert cali_workspace.v2_list_pilot_form_triage(a,form,1)#>>'{responses,0,pdfAvailable}'='true';
  assert decode(cali_workspace.v2_read_pilot_form_pdf(a,form,response)->>'content','base64')=pdf;
  begin
    perform cali_workspace.v2_read_pilot_form_pdf(b,form,response);
    raise exception 'PDF de outra empresa acessível';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_read_pilot_form_pdf(a,form,response);
    raise exception 'PDF acessível ao Cliente';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select count(*) from cali_workspace.form_responses r where r.form_id=form)=1;
  assert (select r.respondent_name='Pessoa fictícia' and r.respondent_email='pessoa@example.invalid'
    and r.answers->>email_question='pessoa@example.invalid' from cali_workspace.form_responses r where r.id=response);
  assert (select r.answers->>question from cali_workspace.form_responses r where r.id=response)='[PDF anexado]';
  assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_form_pdf(uuid,uuid,uuid)','execute');
end;
$$;
rollback;
\echo Fase 4E: exportação Excel de Forms autorizada, auditada e protegida contra acesso cruzado.
\ir rollback-forms-export.sql
