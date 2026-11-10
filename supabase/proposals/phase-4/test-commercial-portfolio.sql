-- Resultados calculados pelo Portal bd2e965, js/services.js, escopo integral.
begin;
do $$
declare
  company constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  operator constant uuid := '00000000-0000-4000-8000-000000000014';
  scenario record;
  opportunity uuid;
  proposal uuid;
  expected timestamptz;
  quote jsonb;
begin
  for scenario in select * from (values
    ('assessoria-estrategica','PARTNER',3900,'{"colaboradores":45,"frentes":["a","b"],"frequencia":"quinzenal"}'::jsonb,4800,4560,75,8,true),
    ('assessoria-estrategica','FULL',6500,'{"colaboradores":150,"frentes":["a","b","c"],"frequencia":"semanal"}'::jsonb,8000,7600,75,12,true),
    ('mentoria-rh','ESSENCIAL',1500,'{"modalidade":"grupo","participantes":2,"suporte":"mensagens"}'::jsonb,1800,1710,75,3,false),
    ('mentoria-rh','AMPLIADO',2200,'{"duracao_sessao":"90","suporte":"proximo"}'::jsonb,2400,2280,75,3,false),
    ('diagnostico-executivo','ESSENCIAL',2800,'{"entrevistas":4,"unidades":1}'::jsonb,2950,2802,75,3,false),
    ('diagnostico-executivo','COMPLETO',4000,'{"entrevistas":7,"unidades":2,"documentos":"parcial"}'::jsonb,4500,4275,75,3,false),
    ('cultura-direcao','PROJETO',3800,'{"entrevistas":5,"grupos":2,"workshops":1}'::jsonb,4000,3800,75,3,false),
    ('shadowing-lideranca','CICLO',3500,'{"horas":4.2,"lideres":2}'::jsonb,3750,3562,75,3,false),
    ('treinamentos','PALESTRA',1800,'{"materiais":"sim","participantes":5}'::jsonb,2100,1995,200,3,false),
    ('treinamentos','WORKSHOP',2800,'{"turmas":2,"encontros":2,"carga_horaria":2}'::jsonb,3800,3610,75,3,false),
    ('treinamentos','TREINAMENTO',4000,'{"formato":"presencial","nivel_interacao":"dinamica"}'::jsonb,5000,4750,75,3,false),
    ('treinamentos','PROGRAMA',5200,'{"encontros":5,"materiais":"sim","participantes":12}'::jsonb,6500,6175,375,3,false),
    ('marca-empregadora','PROJETO',3800,'{"unidades":2,"personas":2,"ativos":["a","b","c"]}'::jsonb,4000,3800,75,3,false),
    ('marca-empregadora','RECORRENTE',3200,'{"unidades":1,"personas":3,"ativos":["a","b","c","d"]}'::jsonb,3650,3467,75,3,true),
    ('solucao-personalizada','SOB_MEDIDA',2800,'{}'::jsonb,2900,2800,75,3,false)
  ) v(service,package,base,answers,subtotal,final_unit,extras,months,recurring)
  loop
    opportunity:=gen_random_uuid();
    proposal:=gen_random_uuid();
    expected:=clock_timestamp();
    insert into public.cali_submissions(id,protocol,status,service_slug,updated_at,contact_email,answers)
    values(opportunity,'CALI-QA-V2-PORTFOLIO-'||opportunity::text,'edicao',scenario.service,expected,
      'qa@example.invalid',scenario.answers);
    insert into public.cali_proposals(id,submission_id,status,version,service_slug,total_value,package_code,updated_at)
    values(proposal,opportunity,'rascunho',1,scenario.service,scenario.base,scenario.package,expected);
    insert into cali_session_guard.phase4_commercial_scope(company_id,submission_id,operator_id,proposal_id,
      expires_at,pilot_package,pilot_price)
    values(company,opportunity,operator,proposal,now()+interval '1 hour',scenario.package,scenario.base);
    set local role authenticated;
    perform cali_workspace.fixture_as('admin');
    assert cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,75,5,3)=proposal;
    quote:=cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->'pricing';
    assert (quote->>'subtotal')::numeric=scenario.subtotal and (quote->>'monthly')::numeric=scenario.final_unit,
      scenario.service||'/'||scenario.package||': preço diferente da referência';
    assert (quote->>'months')::integer=scenario.months and (quote->>'recurring')::boolean=scenario.recurring;
    assert (quote->>'extras')::numeric=75;
    reset role;
    assert (select extras from public.cali_proposals where id=proposal)=scenario.extras;
    if scenario.package='PALESTRA' then
      set local role authenticated;
      perform cali_workspace.fixture_as('admin');
      begin
        perform cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,75,5,3,'prioritized',2000);
        raise exception 'Revisão antiga aceitou alteração do preço';
      exception when serialization_failure then null; end;
      expected:=(cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->>'updatedAt')::timestamptz;
      assert cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,75,5,3,'prioritized',2600)=proposal;
      quote:=cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->'pricing';
      assert quote->>'scopeMode'='prioritized' and (quote->>'extras')::numeric=0;
      assert (quote->>'subtotal')::numeric=1800 and (quote->>'monthly')::numeric=2500;
      assert (quote->>'manualFinalAmount')::numeric=2600;
      expected:=(cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->>'updatedAt')::timestamptz;
      assert cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,75,5,3,'integral',null)=proposal;
      quote:=cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->'pricing';
      assert quote->>'scopeMode'='integral' and quote->'manualFinalAmount'='null'::jsonb;
      assert (quote->>'monthly')::numeric=1995;
      reset role;
    elsif scenario.package='PROGRAMA' then
      set local role authenticated;
      perform cali_workspace.fixture_as('admin');
      expected:=(cali_workspace.v2_read_pilot_commercial_draft(company,proposal)->>'updatedAt')::timestamptz;
      begin
        perform cali_workspace.v2_price_pilot_commercial_draft(company,proposal,expected,75,5,3,'integral',1);
        raise exception 'Valor abaixo do limite efetivo de desconto aceito';
      exception when invalid_parameter_value then null; end;
      reset role;
    end if;
  end loop;
end $$;
rollback;
\echo Fase 4E: 15 combinações de serviço e pacote comparadas com o Portal bd2e965.
