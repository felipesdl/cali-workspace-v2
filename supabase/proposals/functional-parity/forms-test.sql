begin;
do $$
declare
  company constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  v_form_id constant uuid:='e44dfac8-f841-4ed1-a418-905836fa4601';
  v_response_id constant uuid:='e44dfac8-f841-4ed1-a418-905836fa4602';
  v_question_id constant uuid:='e44dfac8-f841-4ed1-a418-905836fa4603';
  path constant text:='e44dfac8-f841-4ed1-a418-905836fa4601/legacy/arquivo.pdf';
  entry uuid;
  listed jsonb;
  expected timestamptz;
begin
  insert into cali_workspace.forms(id,company_id,slug,title,status,questions)
  values(v_form_id,company,'legacy-trash-qa','Forms legado QA','open',
    jsonb_build_array(jsonb_build_object('id',v_question_id,'kind','file','label','Arquivo','required',false)));
  insert into cali_workspace.form_responses(id,form_id,answers,respondent_name,respondent_email)
  values(v_response_id,v_form_id,jsonb_build_object(v_question_id::text,path),'Pessoa QA','pessoa@example.invalid');
  insert into storage.objects(bucket_id,name) values('cali-forms',path);
  insert into cali_session_guard.phase4_form_pdfs(response_id,question_id,bytes)
  values(v_response_id,v_question_id,decode('255044462d312e340a2525','hex'));
  expected:=(select updated_at from cali_workspace.forms where id=v_form_id);

  set local role authenticated;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_list_form_trash(company,1);
    raise exception 'Lixeira permitida sem MFA';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_list_form_trash(company,1);
    raise exception 'Cliente consultou lixeira de Forms';
  exception when insufficient_privilege then null; end;

  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_trash_form(company,v_form_id,expected,'Forms legado QA')=v_form_id;
  reset role;
  assert not exists(select 1 from cali_workspace.forms where id=v_form_id);
  assert (select count(*) from cali_workspace.forms_trash t where t.form_id=v_form_id and t.kind='form'
    and t.form->>'status'='open' and jsonb_array_length(t.responses)=1)=1;
  assert exists(select 1 from storage.objects where bucket_id='cali-forms' and name=path);
  entry:=(select id from cali_workspace.forms_trash where form_id=v_form_id and kind='form' order by deleted_at desc limit 1);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  listed:=cali_workspace.v2_list_form_trash(company,1);
  assert jsonb_array_length(listed)=1;
  assert not (listed->0 ? 'responses') and not (listed->0 ? 'form');
  assert cali_workspace.v2_restore_form(company,entry)=v_form_id;
  reset role;
  assert (select status='closed' from cali_workspace.forms where id=v_form_id);
  assert exists(select 1 from cali_workspace.form_responses where id=v_response_id
    and answers->>v_question_id::text=path and respondent_email='pessoa@example.invalid');
  assert exists(select 1 from cali_session_guard.phase4_form_pdfs where response_id=v_response_id
    and bytes=decode('255044462d312e340a2525','hex'));
  assert exists(select 1 from storage.objects where bucket_id='cali-forms' and name=path);

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_trash_form_response(company,v_form_id,v_response_id)=v_response_id;
  reset role;
  assert not exists(select 1 from cali_workspace.form_responses where id=v_response_id);
  entry:=(select id from cali_workspace.forms_trash where form_id=v_form_id and kind='responses'
    and responses @> jsonb_build_array(jsonb_build_object('id',v_response_id)) order by deleted_at desc limit 1);
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_restore_form(company,entry)=v_form_id;
  reset role;
  assert exists(select 1 from cali_workspace.form_responses where id=v_response_id and answers->>v_question_id::text=path);
  assert exists(select 1 from cali_session_guard.phase4_form_pdfs where response_id=v_response_id);
  assert exists(select 1 from storage.objects where bucket_id='cali-forms' and name=path);

  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  assert cali_workspace.v2_list_form_trash('6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',1)='[]'::jsonb;
end;
$$;
rollback;
\echo Forms: MFA, isolamento, retenção por 30 dias, restauração de dados e anexos legado/V2 validados.
