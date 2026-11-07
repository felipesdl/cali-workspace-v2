begin;
do $$
<<qa>>
declare
  a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  id uuid := gen_random_uuid();
  stamp timestamptz;
  payload jsonb;
  ticket uuid;
  previous_ticket uuid;
  version integer;
  artifact text := encode(convert_to(E'%PDF-1.4\nPDF sintético de teste','UTF8'),'base64');
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_create_pilot_report_draft(a,id,'2026-10-01','Fechamento de teste','Resumo inicial');
  for version in 1..3 loop
    if version>1 then
      select (entry->>'reportUpdatedAt')::timestamptz into stamp
      from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
      where entry->>'id'=qa.id::text;
      perform cali_workspace.v2_update_pilot_report_draft(a,id,stamp,'reopen','Motivo sintético');
      perform cali_workspace.fixture_as('clientA');
      assert cali_workspace.v2_read_pilot_report_catalog(a,1)::text not like '%Fechamento de teste%';
      begin
        perform cali_workspace.v2_read_pilot_report_pdf(a,id,version-1);
        raise exception 'PDF retirado disponível';
      exception when insufficient_privilege then null; end;
      perform cali_workspace.fixture_as('admin');
      assert cali_workspace.v2_read_pilot_report_pdf(a,id,version-1)->>'content'=artifact;
    end if;
    select (entry->>'reportUpdatedAt')::timestamptz into stamp
    from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
    where entry->>'id'=qa.id::text;
    perform cali_workspace.v2_update_pilot_report_draft(a,id,stamp,'review');
    select (entry->>'reportUpdatedAt')::timestamptz into stamp
    from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
    where entry->>'id'=qa.id::text;
    perform cali_workspace.v2_update_pilot_report_draft(a,id,stamp,'approve');
    begin
      perform cali_workspace.v2_release_pilot_report(a,id,version,false);
      raise exception 'Publicação sem artefato';
    exception when sqlstate 'P4R02' then null; end;

    perform cali_workspace.fixture_as('admin1');
    begin
      perform cali_workspace.v2_prepare_pilot_report_pdf(a,id,version);
      raise exception 'Geração sem MFA';
    exception when insufficient_privilege then null; end;
    perform cali_workspace.fixture_as('admin');
    payload := cali_workspace.v2_prepare_pilot_report_pdf(a,id,version);
    previous_ticket := (payload->>'ticket')::uuid;
    assert payload#>>'{input,summary}'='Resumo inicial';
    assert payload#>>'{input,version}'=version::text;
    assert payload#>>'{input,source,hours,consumedMinutes}'='115';
    assert payload::text not like '%QA reservado%';
    payload := cali_workspace.v2_prepare_pilot_report_pdf(a,id,version);
    ticket := (payload->>'ticket')::uuid;
    assert ticket<>previous_ticket;
    begin
      perform cali_workspace.v2_store_generated_pilot_report_pdf(a,id,version,ticket,artifact);
      raise exception 'Admin escreveu bytes fora do gerador';
    exception when insufficient_privilege then null; end;
    set local role service_role;
    begin
      perform cali_workspace.v2_store_generated_pilot_report_pdf(a,id,version,previous_ticket,artifact);
      raise exception 'Ticket substituído aceito';
    exception when insufficient_privilege then null; end;
    assert cali_workspace.v2_store_generated_pilot_report_pdf(a,id,version,ticket,artifact)=id;
    set local role authenticated;
    perform cali_workspace.fixture_as('clientA');
    assert cali_workspace.v2_read_pilot_report_catalog(a,1)::text not like '%Fechamento de teste%';
    begin
      perform cali_workspace.v2_read_pilot_report_pdf(a,id,version);
      raise exception 'PDF não publicado disponível';
    exception when insufficient_privilege then null; end;
    perform cali_workspace.fixture_as('admin');
    assert cali_workspace.v2_prepare_pilot_report_pdf(a,id,version) is null;
    assert cali_workspace.v2_release_pilot_report(a,id,version,version=3)=id;
    assert cali_workspace.v2_release_pilot_report(a,id,version,version=3)=id;

    perform cali_workspace.fixture_as('clientB');
    assert cali_workspace.v2_read_pilot_report_catalog(b,1)::text not like '%Fechamento de teste%';
    begin
      perform cali_workspace.v2_read_pilot_report_pdf(b,id,version);
      raise exception 'PDF da outra empresa disponível';
    exception when insufficient_privilege then null; end;
    perform cali_workspace.fixture_as('clientA');
    assert cali_workspace.v2_read_pilot_report_pdf(a,id,version)->>'content'=artifact;
    assert current_setting('response.headers') like '%private, no-store%';
    select entry into payload from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
    where entry->>'id'=qa.id::text;
    assert payload->>'status'='published';
    assert payload->>'protocol' like 'CALI-EXEC-%';
    assert (payload->>'acknowledgmentAvailable')::boolean=(version<>2);
    assert payload->>'reportAcknowledged'='false';
    if version=2 then
      begin
        perform cali_workspace.v2_ack_pilot_report_release(a,id,version);
        raise exception 'Ciência de revisão não solicitada';
      exception when insufficient_privilege then null; end;
    else
      assert cali_workspace.v2_ack_pilot_report_release(a,id,version)=id;
      assert cali_workspace.v2_ack_pilot_report_release(a,id,version)=id;
      select entry into payload from jsonb_array_elements(cali_workspace.v2_read_pilot_report_catalog(a,1)->'entries') entry
      where entry->>'id'=qa.id::text;
      assert payload->>'reportAcknowledged'='true';
      assert payload->>'acknowledgmentAvailable'='false';
    end if;
    perform cali_workspace.fixture_as('admin');
  end loop;
  reset role;
  assert (select count(*) from cali_session_guard.phase4_report_releases x
    where x.report_id=qa.id and x.withdrawn_at is not null)=2;
  assert (select count(*) from cali_session_guard.phase4_report_releases x
    where x.report_id=qa.id and x.acknowledged_at is not null)=2;
  assert (select count(*) from cali_workspace.activity_log l
    where l.entity_id=qa.id and l.event_type='report_release_acknowledged')=2;
  assert not exists(select 1 from cali_workspace.notifications n where n.entity_id=qa.id);
end $$;
rollback;
\echo Fase 4: publicação e ciência de três revisões de relatório validadas no piloto isolado.
