begin;
do $$
declare
 a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 d uuid := gen_random_uuid();
 d2 uuid := gen_random_uuid();
 v1 uuid := gen_random_uuid();
 v2 uuid := gen_random_uuid();
 v3 uuid := gen_random_uuid();
 pdf1 text := encode(convert_to(E'%PDF-1.4\nprimeira fixture\n','UTF8'),'base64');
 pdf2 text := encode(convert_to(E'%PDF-1.4\nsegunda fixture\n','UTF8'),'base64');
begin
 assert not has_table_privilege('authenticated','cali_session_guard.phase4_document_revisions','SELECT');
 assert not has_function_privilege('anon','cali_workspace.v2_read_pilot_document_pdf(uuid,uuid,uuid)','EXECUTE');
 set local role authenticated;
 perform cali_workspace.fixture_as('admin1');
 begin
  perform cali_workspace.v2_add_pilot_document_revision(a,d,v1,null,'Arquivo QA','teste.pdf',pdf1);
  raise exception 'Upload sem MFA permitido';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 begin
  perform cali_workspace.v2_add_pilot_document_revision(a,d,v1,null,'Arquivo QA','teste.pdf',encode(convert_to('Texto qualquer','UTF8'),'base64'));
  raise exception 'Arquivo sem cabeçalho PDF permitido';
 exception when invalid_parameter_value then null; end;
 assert cali_workspace.v2_list_pilot_documents(a,1)='[]'::jsonb;
 assert cali_workspace.v2_add_pilot_document_revision(a,d,v1,null,'Arquivo QA','teste.pdf',pdf1)=v1;
 assert cali_workspace.v2_add_pilot_document_revision(a,d,v1,null,'Arquivo QA','teste.pdf',pdf1)=v1;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_list_pilot_documents(a,1)='[]'::jsonb;
 begin
  perform cali_workspace.v2_read_pilot_document_pdf(a,d,v1);
  raise exception 'Download de rascunho permitido';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_set_pilot_document_publication(a,d,null,v1);
 perform cali_workspace.fixture_as('clientB');
 assert cali_workspace.v2_list_pilot_documents(b,1)='[]'::jsonb;
 begin
  perform cali_workspace.v2_read_pilot_document_pdf(b,d,v1);
  raise exception 'Download por outra empresa permitido';
 exception when insufficient_privilege then null; end;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_list_pilot_documents(a,1)#>>'{0,revisionId}'=v1::text;
 assert cali_workspace.v2_read_pilot_document_pdf(a,d,v1)->>'content'=pdf1;
 assert current_setting('response.headers')::jsonb @> '[{"Cache-Control":"private, no-store"}]';
 assert cali_workspace.v2_ack_pilot_document(a,d,v1)=v1;
 assert cali_workspace.v2_ack_pilot_document(a,d,v1)=v1;
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_add_pilot_document_revision(a,d,v2,v1,'Arquivo QA','teste-2.pdf',pdf2);
 perform cali_workspace.v2_add_pilot_document_revision(a,d2,v3,null,'Outro QA','teste-3.pdf',pdf2);
 begin
  perform cali_workspace.v2_set_pilot_document_publication(a,d,v1,v3);
  raise exception 'Versão de outro documento aceita';
 exception when serialization_failure then null; end;
 assert jsonb_array_length(cali_workspace.v2_list_pilot_document_history(a,d,1))=2;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_list_pilot_documents(a,1)#>>'{0,revisionId}'=v1::text;
 assert cali_workspace.v2_list_pilot_documents(a,1)#>>'{0,acknowledged}'='true';
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_set_pilot_document_publication(a,d,v1,v2);
 perform cali_workspace.fixture_as('clientA');
 begin
  perform cali_workspace.v2_read_pilot_document_pdf(a,d,v1);
  raise exception 'Download da versão substituída permitido';
 exception when insufficient_privilege then null; end;
 assert cali_workspace.v2_list_pilot_documents(a,1)#>>'{0,acknowledged}'='false';
 assert cali_workspace.v2_read_pilot_document_pdf(a,d,v2)->>'content'=pdf2;
 perform set_config('test.live','false',true);
 begin
  perform cali_workspace.v2_read_pilot_document_pdf(a,d,v2);
  raise exception 'Download com sessão cortada permitido';
 exception when insufficient_privilege then null; end;
 perform set_config('test.live','true',true);
 perform cali_workspace.fixture_as('admin');
 perform cali_workspace.v2_set_pilot_document_publication(a,d,v2,null);
 assert cali_workspace.v2_read_pilot_document_pdf(a,d,v1)->>'content'=pdf1;
 perform cali_workspace.fixture_as('clientA');
 assert cali_workspace.v2_list_pilot_documents(a,1)='[]'::jsonb;
 begin
  perform cali_workspace.v2_ack_pilot_document(a,d,v2);
  raise exception 'Ciência após retirada permitida';
 exception when insufficient_privilege then null; end;
 begin
  perform cali_workspace.v2_read_pilot_document_pdf(a,d,v2);
  raise exception 'Download após retirada permitido';
 exception when insufficient_privilege then null; end;
 reset role;
 assert (select count(*) from cali_session_guard.phase4_document_acknowledgments where revision_id=v1)=1;
end $$;
rollback;
\echo Fase 4: versões privadas, publicação, corte, ciência e download verificados com atores sintéticos.
