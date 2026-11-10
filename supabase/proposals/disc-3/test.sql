\set ON_ERROR_STOP 1
\ir ../../../tests/fixtures/disc/context.sql
\ir candidate.sql

insert into cali_v2_disc.allowed_recipients(email) values
 ('cali-focal-a@synthetic.invalid'),
 ('cali-focal-b@synthetic.invalid'),
 ('cali-focal-no-account@synthetic.invalid'),
 ('disc-a@synthetic.invalid'),
 ('disc-b@synthetic.invalid'),
 ('disc-decline@synthetic.invalid'),
 ('disc-expired@synthetic.invalid'),
 ('disc-invalid-answer@synthetic.invalid'),
 ('disc-manager@synthetic.invalid'),
 ('client-a@synthetic.invalid'),
 ('client-b@synthetic.invalid'),
 ('client-b2@synthetic.invalid');

do $$
declare
  admin_id constant uuid := '00000000-0000-4000-8000-000000000014';
  client_a_id constant uuid := '00000000-0000-4000-8000-000000000011';
  client_b_id constant uuid := '00000000-0000-4000-8000-000000000012';
  client_b2_id constant uuid := '00000000-0000-4000-8000-000000000015';
  company_a constant uuid := '9c5ab148-78b8-4410-9338-58c44222a5db';
  company_b constant uuid := '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  outside_company constant uuid := '00000000-0000-4000-8000-000000000003';
  campaign_a uuid;
  campaign_b uuid;
  campaign_without_account uuid;
  invite_a uuid;
  invite_decline uuid;
  invite_expired uuid;
  invite_invalid uuid;
  token_decline uuid;
  token_expired uuid;
  token_invalid uuid;
  invite_id uuid;
  result_id uuid;
  request_id uuid;
  revision integer;
  method_version text;
  primary_style text;
  secondary_style text;
  mixed boolean;
  approved_at timestamptz;
  signer_snapshot jsonb;
  command_result jsonb;
  projection jsonb;
  snapshot jsonb;
  claim jsonb;
  next_claim jsonb;
  natural_answers jsonb;
  pressure_answers jsonb;
  submit_fields jsonb;
  scores jsonb;
  management jsonb;
  client_report jsonb;
  fake_deadline timestamptz;
  expected_deadline timestamptz;
  job_id uuid;
  n integer;
  count_before integer;
  count_after integer;
  revision_before_edit integer;
  revisions_before_edit integer;
  was_denied boolean;
begin
  -- Admin MFA, sessão vigente e aceite corrente obrigatórios.
  set local role authenticated;
  perform set_config('test.jwt', jsonb_build_object('sub', admin_id, 'aal', 'aal1')::text, true);
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Admin sem MFA leu DISC';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt', jsonb_build_object('sub', admin_id, 'aal', 'aal2')::text, true);
  perform set_config('test.terms', 'false', true);
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Admin sem aceite leu DISC';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.terms', 'true', true);
  perform set_config('test.live', 'false', true);
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Admin com sessão cortada leu DISC';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.live', 'true', true);
  snapshot := cali_workspace.v2_disc_admin(null);
  if jsonb_array_length(snapshot->'campaigns') <> 0 then raise exception 'Banco DISC não iniciou vazio'; end if;

  -- Campanhas A/B e sem conta usam somente empresas e endereços sintéticos aprovados.
  command_result := cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create',
    jsonb_build_object('title','Campanha sintética A','companyId',company_a,'organization','QA A','purpose','Validação sintética',
      'focalName','Ponto focal A','focalEmail','cali-focal-a@synthetic.invalid','goal','Aumentar colaboração'));
  campaign_a := (command_result->>'id')::uuid;
  revision := (command_result->>'revision')::integer;
  command_result := cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create',
    jsonb_build_object('title','Campanha sintética B','companyId',company_b,'organization','QA B','purpose','Validação sintética',
      'focalName','Ponto focal B','focalEmail','cali-focal-b@synthetic.invalid','goal','Fortalecer continuidade'));
  campaign_b := (command_result->>'id')::uuid;
  command_result := cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create',
    jsonb_build_object('title','Campanha sem conta','companyId',null,'organization','Organização sintética','purpose','Validação sintética',
      'focalName','Ponto focal externo','focalEmail','cali-focal-no-account@synthetic.invalid','goal','Apoiar o desenvolvimento'));
  campaign_without_account := (command_result->>'id')::uuid;
  begin
    perform cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create',
      jsonb_build_object('title','Empresa fora do piloto','companyId',outside_company,'organization','Fora do piloto','purpose','Validação sintética',
        'focalName','Contato sintético','focalEmail','cali-focal-a@synthetic.invalid','goal','Objetivo sintético'));
    raise exception 'Campanha vinculou empresa fora do piloto';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create',
      jsonb_build_object('title','Destino externo','companyId',company_a,'organization','QA A','purpose','Validação sintética',
        'focalName','Contato sintético','focalEmail','outside@not-approved.invalid','goal','Objetivo sintético'));
    raise exception 'Campanha aceitou destinatário fora da allowlist';
  exception when invalid_parameter_value then null;
  end;

  -- Clientes A/B e anon não herdam permissões Admin nem leitura de tabelas privadas.
  perform set_config('test.jwt', jsonb_build_object('sub', client_a_id)::text, true);
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Cliente A leu composição Admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_disc_command(campaign_a, revision, gen_random_uuid(), 'edit', '{}'::jsonb);
    raise exception 'Cliente A executou comando Admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from cali_v2_disc.campaigns;
    raise exception 'Cliente A leu tabela privada';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt', jsonb_build_object('sub', client_b_id)::text, true);
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Cliente B leu composição Admin';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform cali_workspace.v2_disc_admin(null);
    raise exception 'Anon leu composição Admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_disc_command(null, null, gen_random_uuid(), 'create', '{}'::jsonb);
    raise exception 'Anon executou comando Admin';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Cria e põe em fila convite A; replay do mesmo request não duplica job.
  set local role authenticated;
  perform set_config('test.jwt', jsonb_build_object('sub', admin_id, 'aal', 'aal2')::text, true);
  perform set_config('test.terms', 'true', true);
  command_result := cali_workspace.v2_disc_command(campaign_a, 1, gen_random_uuid(), 'invite',
    jsonb_build_object('name','Respondente sintético A','email','disc-a@synthetic.invalid'));
  revision := (command_result->>'revision')::integer;
  begin
    perform cali_workspace.v2_disc_command(campaign_a, revision, gen_random_uuid(), 'invite',
      jsonb_build_object('name','Destinatário não autorizado','email','outside@not-approved.invalid'));
    raise exception 'Convite aceitou endereço fora da allowlist';
  exception when invalid_parameter_value then null;
  end;
  snapshot := cali_workspace.v2_disc_admin(campaign_a);
  invite_a := (snapshot->'selected'->'invites'->0->>'id')::uuid;
  request_id := gen_random_uuid();
  command_result := cali_workspace.v2_disc_command(campaign_a, revision, request_id, 'queue', jsonb_build_object('inviteId',invite_a));
  revision := (command_result->>'revision')::integer;
  reset role;
  select count(*) into count_before from cali_v2_disc.jobs j where j.invite_id=invite_a and j.kind='invite';
  if count_before <> 1 then raise exception 'Fila não criou exatamente um convite'; end if;
  set local role authenticated;
  perform set_config('test.jwt', jsonb_build_object('sub', admin_id, 'aal', 'aal2')::text, true);
  perform set_config('test.terms', 'true', true);
  if cali_workspace.v2_disc_command(campaign_a, revision-1, request_id, 'queue', jsonb_build_object('inviteId',invite_a)) <> command_result then
    raise exception 'Replay de fila mudou o resultado'; end if;
  reset role;
  select count(*) into count_after from cali_v2_disc.jobs j where j.invite_id=invite_a and j.kind='invite';
  if count_after <> count_before then raise exception 'Replay de fila duplicou job'; end if;

  -- Worker service_role reserva job e registra apenas marcador fictício de provedor.
  reset role;
  set local role service_role;
  claim := cali_workspace.v2_disc_worker('claim', null, '{}'::jsonb);
  if claim->>'kind' <> 'invite' or claim->>'token' is null then raise exception 'Worker não reservou convite esperado'; end if;
  job_id := (claim->>'id')::uuid;
  if cali_workspace.v2_disc_worker('validate', job_id, '{}') is distinct from 'true'::jsonb then raise exception 'Envio reservado não passou na conferência final'; end if;
  expected_deadline := ((date_trunc('day', statement_timestamp() at time zone 'America/Sao_Paulo') + interval '7 days 23 hours 59 minutes') at time zone 'America/Sao_Paulo');
  perform cali_workspace.v2_disc_worker('sent', job_id, jsonb_build_object('providerId','synthetic-provider-confirmation'));
  next_claim := cali_workspace.v2_disc_worker('claim', null, '{}'::jsonb);
  if next_claim is not null then raise exception 'Job reenfileirado após confirmação fictícia'; end if;
  reset role;
  select jsonb_build_object('token',i.token,'deadline_at',i.deadline_at) into claim
    from cali_v2_disc.invites i where i.id=invite_a;
  if (claim->>'deadline_at')::timestamptz <> expected_deadline then raise exception 'Prazo não terminou às 23h59 em Brasília no sétimo dia'; end if;
  if not exists(select 1 from cali_v2_disc.jobs j where j.id=job_id and j.state='sent' and j.provider_id='synthetic-provider-confirmation') then
    raise exception 'Marcador fictício do worker não foi preservado'; end if;
  if exists(select 1 from cali_v2_disc.invites where id=invite_a and sent_at is null) then raise exception 'Worker sent não marcou convite enviado'; end if;

  -- Endpoint público retorna somente estado operacional. Respostas não persistem no navegador.
  set local role anon;
  request_id := gen_random_uuid();
  natural_answers := (select jsonb_agg(jsonb_build_object('b',g,'mais','D','menos','I') order by g) from generate_series(1,18) g);
  pressure_answers := (select jsonb_agg(jsonb_build_object('b',b,'mais','C','menos','D') order by b) from unnest(array[2,5,8,11,14,17]) b);
  projection := cali_workspace.v2_disc_public((claim->>'token')::uuid,'read','{}'::jsonb);
  if projection->>'state' <> 'sent' or projection ? 'scores' or projection ? 'result' or projection ? 'token' then
    raise exception 'Leitura pública retornou projeção indevida'; end if;
  if cali_workspace.v2_disc_public('ffffffff-ffff-4fff-8fff-ffffffffffff','read','{}'::jsonb)->>'state' <> 'invalid' then
    raise exception 'Token inválido não foi distinguido'; end if;
  projection := cali_workspace.v2_disc_public((claim->>'token')::uuid,'open','{}'::jsonb);
  if projection->>'state' <> 'opened' then raise exception 'Convite aberto não atualizou estado'; end if;
  projection := cali_workspace.v2_disc_public((claim->>'token')::uuid,'progress',jsonb_build_object('block',1));
  if projection->>'state' <> 'started' or projection->>'last_block' <> '1' then raise exception 'Progresso não foi registrado'; end if;
  submit_fields := jsonb_build_object('jobTitle','Função sintética','consent',true,'requestId',request_id,
    'answers',jsonb_build_object('natural',natural_answers,'pressure',pressure_answers));
  projection := cali_workspace.v2_disc_public((claim->>'token')::uuid,'submit',submit_fields);
  if projection->>'state' <> 'completed' or projection ? 'scores' or projection ? 'primary_style' or projection ? 'result_id'
    or projection ? 'access_token' or projection ? 'pdf' then
    raise exception 'Submit público não retornou apenas confirmação operacional'; end if;
  if cali_workspace.v2_disc_public((claim->>'token')::uuid,'submit',submit_fields) <> projection then
    raise exception 'Replay de resposta não retornou confirmação idempotente'; end if;
  begin
    perform cali_workspace.v2_disc_public((claim->>'token')::uuid,'submit',jsonb_set(submit_fields,'{requestId}',to_jsonb(gen_random_uuid())));
    raise exception 'Resposta concluída aceitou replay com requestId diferente';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform cali_workspace.v2_disc_public((claim->>'token')::uuid,'submit',
      jsonb_set(submit_fields,'{answers,natural,0,menos}','"D"'::jsonb));
    raise exception 'Resposta aceitou escolha MAIS/MENOS igual';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select r.id,r.scores,r.method_version,r.primary_style,r.secondary_style,r.mixed
    into result_id,scores,method_version,primary_style,secondary_style,mixed
    from cali_v2_disc.results r where r.invite_id=invite_a;
  if method_version <> 'cali-disc-v1.1' then raise exception 'Versão do método divergiu'; end if;
  if scores->'natural'->'D'->>'pct' <> '100' or scores->'natural'->'I'->>'pct' <> '0'
    or scores->'pressure'->'C'->>'pct' <> '100' or scores->'adaptation'->>'D' <> '-100'
    or primary_style <> 'D' or secondary_style <> 'S' or mixed then
    raise exception 'Escores/estilo não correspondem a cali-disc-v1.1'; end if;
  select count(*) into count_after from cali_v2_disc.jobs j where j.invite_id=invite_a and j.kind='respondent_pdf';
  if count_after <> 1 then raise exception 'Submit não enfileirou exatamente um PDF próprio'; end if;

  -- Limiares exatos: 4 indisponível, 5 e 14 qualitativo sem métricas, 15 quantitativo.
  for n in 2..15 loop
    reset role;
    insert into cali_v2_disc.invites(campaign_id,person_name,email)
      values(campaign_a,'Respondente sintético '||n,'disc-result-'||lpad(n::text,2,'0')||'@synthetic.invalid') returning id into invite_id;
    insert into cali_v2_disc.results(invite_id,campaign_id,person_name,email,answers,scores,primary_style,secondary_style,mixed,protocol,request_id,fingerprint)
    values(invite_id,campaign_a,'Respondente sintético '||n,'disc-result-'||lpad(n::text,2,'0')||'@synthetic.invalid','{}'::jsonb,
      jsonb_build_object('natural','{}'::jsonb,'pressure','{}'::jsonb,'natural6','{}'::jsonb,
        'adaptation',jsonb_build_object('D',0,'I',0,'S',0,'C',0)),
      (array['D','I','S','C'])[((n-2)%4)+1], 'C', false, 'SYNTHETIC-'||n,gen_random_uuid(),'fixture');
    if n in(4,5,14,15) then
      select c.revision into revision from cali_v2_disc.campaigns c where c.id=campaign_a;
      set local role authenticated;
      perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
      perform set_config('test.terms','true',true);
      snapshot:=cali_workspace.v2_disc_admin(campaign_a);
      management:=snapshot->'selected'->'management';
      reset role;
      if n=4 and (management->>'mode'<>'unavailable' or management->'sample_size'<>'null'::jsonb or management->'distribution'<>'null'::jsonb) then
        raise exception 'Quatro respostas liberaram gestão'; end if;
      if n in(5,14) and (management->>'mode'<>'qualitative' or management->'sample_size'<>'null'::jsonb or management->'distribution'<>'null'::jsonb) then
        raise exception 'Cinco a quatorze respostas expuseram números'; end if;
      if n=5 and management->>'qualitative' is null then raise exception 'Resumo qualitativo não foi formado'; end if;
      if n=15 and (management->>'mode'<>'quantitative' or management->>'sample_size'<>'15' or management->'distribution' is null) then
        raise exception 'Quinze respostas não liberaram faixa quantitativa'; end if;
      if (management::text) like '%Respondente sintético%' or management::text like '%disc-result-%' then
        raise exception 'Gestão revelou identidade de respondente'; end if;
      if n=4 then
        set local role authenticated;
        perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
        begin
          perform cali_workspace.v2_disc_command(campaign_a,revision,gen_random_uuid(),'approve','{}'::jsonb);
          raise exception 'Aprovação passou com quatro respostas';
        exception when invalid_parameter_value then null;
        end;
        reset role;
      end if;
    end if;
  end loop;

  -- Parecer/objetivo e assinatura sintética obrigatórios; aprovação congela revisão.
  select c.revision into revision from cali_v2_disc.campaigns c where c.id=campaign_a;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  perform set_config('test.terms','true',true);
  begin
    perform cali_workspace.v2_disc_command(campaign_a,revision,gen_random_uuid(),'approve','{}'::jsonb);
    raise exception 'Aprovação passou sem parecer';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select c.revision into revision from cali_v2_disc.campaigns c where c.id=campaign_a;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  command_result:=cali_workspace.v2_disc_command(campaign_a,revision,gen_random_uuid(),'edit',
    jsonb_build_object('goal','Fortalecer colaboração','note','Parecer sintético aprovado para validação do fluxo de gestão.','moment','','sector',''));
  revision:=(command_result->>'revision')::integer;
  command_result:=cali_workspace.v2_disc_command(campaign_a,revision,gen_random_uuid(),'approve','{}'::jsonb);
  reset role;
  select c.revision,c.approved_at,c.signer into revision_before_edit,approved_at,signer_snapshot
    from cali_v2_disc.campaigns c where c.id=campaign_a;
  if approved_at is null or signer_snapshot->>'full_name'<>'Responsável sintética CALI' or signer_snapshot->>'avatar_url' is null
    or not (select protocol like 'CALI-GESTAO-____-______' from cali_v2_disc.campaigns where id=campaign_a) then
    raise exception 'Aprovação não congelou assinatura/protocolo sintéticos'; end if;
  if not exists(select 1 from cali_v2_disc.revisions r where r.campaign_id=campaign_a and r.revision=revision_before_edit) then
    raise exception 'Revisão aprovada não foi preservada'; end if;

  -- Acesso Cliente só vê revisão liberada da própria empresa; B não lê resultado nem campanha A.
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  command_result:=cali_workspace.v2_disc_command(campaign_a,revision_before_edit,gen_random_uuid(),'release','{}'::jsonb);
  revision:=(command_result->>'revision')::integer;
  reset role;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',client_a_id)::text,true);
  client_report:=cali_workspace.v2_disc_client();
  if jsonb_array_length(client_report->'reports')<>1 or client_report#>>'{reports,0,title}'<>'Campanha sintética A'
    or client_report::text like '%person_name%' or client_report::text like '%scores%' then
    raise exception 'Cliente A não recebeu somente seu agregado'; end if;
  projection:=cali_workspace.v2_disc_document(campaign_a,null);
  if projection->>'audience'<>'management' then raise exception 'Cliente não recebeu projeção de gestão'; end if;
  begin
    perform cali_workspace.v2_disc_document(null,result_id);
    raise exception 'Cliente A leu relatório do avaliador';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',jsonb_build_object('sub',client_b_id)::text,true);
  client_report:=cali_workspace.v2_disc_client();
  if jsonb_array_length(client_report->'reports')<>0 then raise exception 'Cliente B recebeu gestão da empresa A'; end if;
  begin
    perform cali_workspace.v2_disc_document(campaign_a,null);
    raise exception 'Cliente B abriu gestão da empresa A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cali_workspace.v2_disc_document(null,result_id);
    raise exception 'Cliente B leu relatório do avaliador';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.jwt',jsonb_build_object('sub',client_b2_id)::text,true);
  client_report:=cali_workspace.v2_disc_client();
  if jsonb_array_length(client_report->'reports')<>0 then raise exception 'Segundo acesso B recebeu gestão da empresa A'; end if;
  reset role;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  projection:=cali_workspace.v2_disc_document(null,result_id);
  if projection->>'audience'<>'evaluator' or projection->>'primary' is null or projection->'scores' is null then
    raise exception 'Avaliador Admin não recebeu projeção técnica'; end if;
  reset role;

  -- Alterar conteúdo após aprovação retira aprovação/liberação, sem apagar revisões nem eventos.
  select c.revision into revision from cali_v2_disc.campaigns c where c.id=campaign_a;
  select count(*) into revisions_before_edit from cali_v2_disc.revisions where campaign_id=campaign_a;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  command_result:=cali_workspace.v2_disc_command(campaign_a,revision,gen_random_uuid(),'edit',
    jsonb_build_object('goal','Nova meta sintética','note','Conteúdo ajustado após revisão aprovada, preservando o histórico.','moment','','sector',''));
  reset role;
  if exists(select 1 from cali_v2_disc.campaigns c where c.id=campaign_a and (c.approved_at is not null or c.released_at is not null or c.signer is not null or c.protocol is not null)) then
    raise exception 'Edição manteve aprovação/liberação'; end if;
  if (select count(*) from cali_v2_disc.revisions where campaign_id=campaign_a)<>revisions_before_edit
    or not exists(select 1 from cali_v2_disc.events where campaign_id=campaign_a and kind='approve')
    or not exists(select 1 from cali_v2_disc.events where campaign_id=campaign_a and kind='release') then
    raise exception 'Edição removeu histórico anterior'; end if;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',client_a_id)::text,true);
  client_report:=cali_workspace.v2_disc_client();
  if jsonb_array_length(client_report->'reports')<>0 then raise exception 'Cliente A manteve revisão retirada visível'; end if;
  reset role;

  -- Campanha sem conta: gestor recebe job próprio; liberação no app é recusada.
  insert into cali_v2_disc.invites(campaign_id,person_name,email)
  values(campaign_without_account,'Respondente gestor sintético 1','disc-manager-response-1@synthetic.invalid') returning id into invite_id;
  insert into cali_v2_disc.results(invite_id,campaign_id,person_name,email,answers,scores,primary_style,secondary_style,mixed,protocol,request_id,fingerprint)
  values(invite_id,campaign_without_account,'Respondente gestor sintético 1','disc-manager-response-1@synthetic.invalid','{}'::jsonb,
    jsonb_build_object('adaptation',jsonb_build_object('D',0,'I',0,'S',0,'C',0)), 'D','I',false,'SYNTHETIC-M1',gen_random_uuid(),'fixture');
  for n in 2..5 loop
    insert into cali_v2_disc.invites(campaign_id,person_name,email)
    values(campaign_without_account,'Respondente gestor sintético '||n,'disc-manager-'||n||'@synthetic.invalid') returning id into invite_id;
    insert into cali_v2_disc.results(invite_id,campaign_id,person_name,email,answers,scores,primary_style,secondary_style,mixed,protocol,request_id,fingerprint)
    values(invite_id,campaign_without_account,'Respondente gestor sintético '||n,'disc-manager-'||n||'@synthetic.invalid','{}'::jsonb,
      jsonb_build_object('adaptation',jsonb_build_object('D',0,'I',0,'S',0,'C',0)), 'I','D',false,'SYNTHETIC-M'||n,gen_random_uuid(),'fixture');
  end loop;
  reset role;
  select c.revision into revision from cali_v2_disc.campaigns c where c.id=campaign_without_account;
  set local role authenticated;
  perform set_config('test.jwt',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  command_result:=cali_workspace.v2_disc_command(campaign_without_account,revision,gen_random_uuid(),'edit',
    jsonb_build_object('goal','Desenvolver equipe','note','Parecer sintético para validar PDF externo e aprovação.','moment','','sector',''));
  revision:=(command_result->>'revision')::integer;
  command_result:=cali_workspace.v2_disc_command(campaign_without_account,revision,gen_random_uuid(),'approve','{}'::jsonb);
  revision:=(command_result->>'revision')::integer;
  begin
    perform cali_workspace.v2_disc_command(campaign_without_account,revision,gen_random_uuid(),'release','{}'::jsonb);
    raise exception 'Campanha sem conta liberou relatório no app';
  exception when invalid_parameter_value then null;
  end;
  command_result:=cali_workspace.v2_disc_command(campaign_without_account,revision,gen_random_uuid(),'manager_pdf',
    jsonb_build_object('name','Gestor sintético','email','disc-manager@synthetic.invalid'));
  revision:=(command_result->>'revision')::integer;
  begin
    perform cali_workspace.v2_disc_command(campaign_without_account,revision,gen_random_uuid(),'manager_pdf',
      jsonb_build_object('name','Destino externo','email','outside@not-approved.invalid'));
    raise exception 'PDF ao gestor aceitou endereço fora da allowlist';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  if (select count(*) from cali_v2_disc.results where campaign_id=campaign_without_account)<>5
    or not exists(select 1 from cali_v2_disc.jobs where campaign_id=campaign_without_account and kind='gestao_pdf' and recipient='disc-manager@synthetic.invalid')
    or exists(select 1 from cali_v2_disc.jobs where campaign_id=campaign_without_account and recipient='outside@not-approved.invalid') then
    raise exception 'Fila PDF de gestor externo viola allowlist ou duplicou resposta'; end if;

  -- Declínio, expiração, campos inválidos e scheduler fora do expediente permanecem no servidor.
  insert into cali_v2_disc.invites(campaign_id,person_name,email,sent_at,deadline_at)
  values(campaign_b,'Pessoa que recusou','disc-decline@synthetic.invalid',clock_timestamp(),clock_timestamp()+interval '7 days') returning id,token into invite_decline,token_decline;
  insert into cali_v2_disc.invites(campaign_id,person_name,email,sent_at,deadline_at)
  values(campaign_b,'Pessoa expirada','disc-expired@synthetic.invalid',clock_timestamp()-interval '8 days',clock_timestamp()-interval '1 minute') returning id,token into invite_expired,token_expired;
  insert into cali_v2_disc.invites(campaign_id,person_name,email,sent_at,deadline_at)
  values(campaign_b,'Resposta inválida','disc-invalid-answer@synthetic.invalid',clock_timestamp(),clock_timestamp()+interval '7 days') returning id,token into invite_invalid,token_invalid;
  set local role anon;
  projection:=cali_workspace.v2_disc_public(token_decline,'decline','{}'::jsonb);
  if projection->>'state'<>'declined' then raise exception 'Declínio não foi refletido'; end if;
  begin
    perform cali_workspace.v2_disc_public(token_decline,'submit',submit_fields);
    raise exception 'Convite recusado aceitou resposta';
  exception when invalid_parameter_value then null;
  end;
  projection:=cali_workspace.v2_disc_public(token_decline,'read','{}'::jsonb);
  if projection->>'state'<>'declined' then raise exception 'Estado recusado não persistiu'; end if;
  projection:=cali_workspace.v2_disc_public(token_expired,'read','{}'::jsonb);
  if projection->>'state'<>'expired' then raise exception 'Convite vencido não foi distinguido'; end if;
  begin
    perform cali_workspace.v2_disc_public(token_expired,'submit','{}'::jsonb);
    raise exception 'Convite expirado aceitou resposta';
  exception when invalid_parameter_value then null;
  end;
  natural_answers := (select jsonb_agg(jsonb_build_object('b',g,'mais','D','menos','I') order by g) from generate_series(1,18) g);
  pressure_answers := (select jsonb_agg(jsonb_build_object('b',b,'mais','C','menos','D') order by b) from unnest(array[2,5,8,11,14,17]) b);
  submit_fields:=jsonb_build_object('jobTitle','','consent',true,'requestId',gen_random_uuid(),
    'answers',jsonb_build_object('natural',natural_answers,'pressure',pressure_answers));
  submit_fields:=jsonb_set(submit_fields,'{answers,natural,0,menos}','"D"'::jsonb);
  begin
    perform cali_workspace.v2_disc_public(token_invalid,'submit',submit_fields);
    raise exception 'Resposta inválida não foi recusada';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  fake_deadline:='2026-11-07 23:59:00-03'::timestamptz;
  update cali_v2_disc.invites set sent_at='2026-11-06 10:00:00-03',deadline_at=fake_deadline where id=invite_invalid;
  if cali_v2_disc.schedule('2026-11-06 07:00:00-03'::timestamptz)<>0 then raise exception 'Scheduler executou antes das 8h'; end if;
  if cali_v2_disc.schedule('2026-11-07 12:00:00-03'::timestamptz)<>0 then raise exception 'Scheduler executou no sábado'; end if;
  perform cali_v2_disc.schedule('2026-11-06 16:00:00-03'::timestamptz);
  perform cali_v2_disc.schedule('2026-11-06 16:00:00-03'::timestamptz);
  if (select count(*) from cali_v2_disc.jobs j where j.invite_id=invite_invalid and j.kind='reminder3')<>1
    or (select count(*) from cali_v2_disc.jobs j where j.campaign_id=campaign_b and j.kind='focal_eve' and (j.payload->>'deadline')::timestamptz=fake_deadline)<>1 then
    raise exception 'Scheduler não respeitou deduplicação/aviso de véspera'; end if;

  -- A V2 nunca envia neste harness: todos os jobs restantes são pendentes, sem provider real.
  if exists(select 1 from cali_v2_disc.jobs where provider_id is not null and provider_id<>'synthetic-provider-confirmation') then
    raise exception 'Job recebeu marcador de provedor não sintético'; end if;
end;
$$;

do $$
begin
  if (select count(*) from cali_v2_disc.jobs j where j.provider_id='synthetic-provider-confirmation' and j.state='sent')<>1 then
    raise exception 'Estado fictício do provedor não foi persistido'; end if;
  if has_function_privilege('anon','cali_workspace.v2_disc_admin(uuid)','execute')
    or has_function_privilege('anon','cali_workspace.v2_disc_command(uuid,integer,uuid,text,jsonb)','execute')
    or has_function_privilege('service_role','cali_workspace.v2_disc_admin(uuid)','execute') then
    raise exception 'Grants de função DISC expuseram Admin ou service_role'; end if;
end;
$$;
