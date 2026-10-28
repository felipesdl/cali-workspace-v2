# Registro de mudanças

## 28/10/2026 — Contratos de acesso/empresas e definição do laboratório local

- **Autor/escopo:** agente Codex, conforme continuidade autorizada da fase 1 e manutenção do PR #2. Sem conexão ao Supabase oficial, execução de SQL ou ativação de serviços. Oficial consultado somente em leitura.
- **Reconciliação:** 586 fontes de src/supabase/docs conferidas por blob contra a publicação 83 `f3d3f14`, incluindo os 166 SQLs versionados. Publicação 84 `ce48879` altera apenas handoff/CSS de formulário público; não substitui a referência de contratos. [Contrato mínimo](contracts/ACCESS_COMPANIES.md) separa payloads/erros/records observados, alvo V2 e lacunas.
- **Decisões:** DEC-21 confirma com Felipe MFA obrigatório Admin antes de liberar acesso, inclusive primeiro uso e bloqueio em falha. DEC-22 define ambiente local dedicado. DEC-23 autoriza investigar/criar registro próprio de adesão quando ausente: cadastro atual trata contrato/aditivo e primeiro acesso trata convite/aceite individual; não foi localizada operação específica de adesão da empresa.
- **Tipos/contratos:** schemas de solicitação/verificação de código, resposta com token/papel, records mínimos planejados de perfil/aceite/empresa/convite e contrato novo de adesão. Requests não aceitam autoria/papel/empresa arbitrários fora do contrato; autoria/instante do registro de adesão são de servidor. Contrato não implementa gravação, assinatura eletrônica, service Auth, sessão ou RLS. Nenhum Database manual ou SDK criado.
- **Empresas:** catálogo incorpora archived, observado no SQL, com label/filtro correspondente; sem ação nova de arquivamento, persistência ou dado real. DTOs de demonstração continuam separados das projeções planejadas.
- **Laboratório:** [definição](LOCAL_ENVIRONMENT.md), `supabase/config.toml` e script `local-environment.ts` implementados. CLI fixado em 2.122.0, projeto/rede exclusivos, loopback, captura de e-mail local, signup externo e serviços extras desabilitados, migrations/seeds desligados. `local:config:check` integra verify; `local:preflight` apenas lê versões/contexto/rede/portas e bloqueia vínculo/overrides/arquivos não revisados.
- **Evidência local:** Docker 29.8.2 disponível, portas 56320–56325 sem listener e nenhum container/rede CALI. Preflight **não passou** por CLI ausente e rede dedicada ausente. Nenhum container/rede/volume foi criado/alterado, inclusive os oito containers de outros contextos. Isolamento de runtime/egress, captura real, compatibilidade operacional do CLI e schema aplicado continuam pendentes.
- **Validação:** `npm run verify` passou com 76 testes em oito arquivos, formatação, lint, typecheck, integridade da configuração, links documentais e build; `git diff --check` passou. Novos testes verificam entrada/resposta inválidas, metadados de autorização forjados, ausência de prova de aceite/adesão e pré-condições de ambiente sem vazamento de valores. Não certificam autenticação, RLS ou validade de documento. Avisos conhecidos de comentários do Zod permanecem; QA visual não repetido neste recorte de contratos/configuração.
- **Pendências concretas:** DDL de workspace_access_codes ausente; create_client_account sem corpo (2A); persistência/operação real da adesão; guardas unificadas; baseline local revisada, CLI/rede/stack, atores e provas A/B/Admin/MFA/termos/logout. TEC-01/02 e OPEN-10 não foram encerrados globalmente. Formato de assinatura/anexo e prazo de guarda não foram inventados.
- **Entrega/revisão:** commits por contratos, preparação do ambiente e documentação no mesmo PR de rascunho; descrição/checklist atualizados para este lote. Sem merge, deploy, comunicação operacional ou migração de dados.
- **Rollback:** reverter somente estes contratos, estado archived, configuração/scripts/gates/testes e atualização documental, preservando a fundação anterior e alterações posteriores. Não há stack ou dados deste lote para remover; não executar limpeza global de Docker.

## 27/10/2026 — PR #2 aberto e vínculo do acompanhamento

- **Entrega:** [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) aberto em rascunho de `felipesdl:codex/fase-1-base` para `patricia258:main`. Quatro commits iniciais: `fb53a67` (fundação/API/verificações), `0e4306b` (DS), `55cc020` (rotas/empresas com mocks) e `abec452` (documentação). Este registro e os links do acompanhamento compõem um commit documental posterior.
- **Descrição:** escopo entregue, checklist de fechamento, limites, commits, fontes canônicas e rollback registrados; atualizar o mesmo PR a cada lote de commits conforme política. Fase 1 permanece em andamento e fase 2A não foi antecipada como entrega operacional.
- **Conferência remota:** PR aberto, draft e head `abec452` confirmados; quatro commits presentes e sem conflitos reportados. GitHub não registrou checks/runs para essa revisão na consulta; CI continua pendente, sem atribuição de causa ou alegação de sucesso remoto.
- **Validação:** `npm run verify` passou para o pacote de implementação em `abec452`, com 50 testes e build. Este ajuste posterior altera somente documentação/links, validado por `docs:check` (30 documentos/558 links locais) e `git diff --check`, sem repetir a suíte de aplicação. As alterações locais foram preservadas nos commits enviados.
- **Estado/limites:** README, AGENTS, roadmap e runbook agora identificam o PR real. Sem merge, conexão ao Supabase oficial, migration, comunicação operacional ou deploy. Rollback por reversão do recorte, preservando a documentação/base anteriores e eventuais mudanças posteriores.

## 27/10/2026 — Preparação do PR de acompanhamento da fase 1

- **Autor/autorização:** agente Codex, conforme pedido do Felipe de fazer os commits e abrir PR antes de avançar. Base `patricia258/cali-workspace-v2:main` em `c9baea7`; branch `codex/fase-1-base` no fork `felipesdl/cali-workspace-v2`. Destino confirmado em leitura; nenhuma mudança direta na main.
- **Recortes:** fundação/runtime/API/mocks/verificações; tokens e primitivas DS; navegação e consumidor demonstrativo de empresas; documentação do estado/pendências. A revisão do PR considera o conjunto final dos commits, sem alegar validação isolada de cada revisão intermediária.
- **Acompanhamento:** ROADMAP recebe checklist explícito do concluído localmente e do necessário para fechar a fase 1. CHANGE_POLICY e AGENTS orientam atualizar a descrição do PR a cada lote de commits, junto das fontes canônicas e da evidência de validação. README/runbook apontam para o acompanhamento; fases 1 e 2A permanecem distintas.
- **Validação do pacote:** `npm run verify` passou com formatação, lint, typecheck, 50 testes em seis arquivos, 30 documentos/558 links locais e build. Arquivos preparados conferidos sem padrão de credencial localizado; isso não certifica segurança. Capturas/artefatos locais permanecem ignorados. Avisos conhecidos de otimização do Zod permanecem no build.
- **Pendente:** CI/revisão no GitHub, contratos mínimos TEC-01/02, ambiente OPEN-10, sessão/guardas/MFA, adesão/termos, isolamento servidor A/B/Admin, expiração/revogação/logout/limpeza de contexto e validação do acesso real. Mocks e build não encerram esses gates; cadastro/convites/manutenção completos pertencem à fase 2A.
- **Estado/limites:** pacote preparado para PR de rascunho; a URL e situação de CI serão verificadas após o envio. Sem conexão ao Supabase oficial, migration, comunicação operacional, merge ou deploy. Esta publicação de branch/PR autoriza revisão do código, não a publicação da aplicação.
- **Rollback:** reverter os commits deste recorte preservando a base documental mergeada; não há dados/migrations a desfazer. Mudanças posteriores devem ser preservadas ao preparar a reversão.

## 27/10/2026 — Variantes compartilhadas no contrato, strings no JSX

- **Autor/decisão:** agente Codex, conforme esclarecimento do Felipe: padronizar a tipagem entre componentes, preservando a ergonomia de `variant="secondary"` nos consumidores. Este registro substitui a exigência anterior de constante na prop JSX.
- **Implementação:** `UiVariant` continua derivado do vocabulário `as const` compartilhado. Button importa apenas o tipo e usa default `primary`; os quatro consumidores de empresas voltaram a strings tipadas, sem importar a constante. CSS, valores permitidos e apresentação permanecem iguais.
- **Lint/testes:** removidas somente as duas restrições de literal em `variant`. Os respectivos cenários agora verificam permissão de strings diretas/em expressão; uso da constante também permanece válido. As outras restrições de tipos, hooks, imports e identidade continuam vigentes. A rejeição de uma variante fora do vocabulário pertence ao TypeScript, não ao lint de literais.
- **Documentação:** DS, arquitetura, runbook, AGENTS e este registro refletem o contrato compartilhado com consumo por string. Não foi criada união paralela no Button ou na feature.
- **Validação:** `npm run verify` passou com formatação, lint, typecheck, 50 testes, 30 documentos/552 links locais e build; `git diff --check` passou. Sem alteração visual, QA de navegador não repetido. Sem dependências novas, conexão a backend, migration, commit ou publicação.
- **Rollback:** restaurar a exigência anterior de constante apenas se houver nova decisão explícita; este ajuste não altera dados ou contratos do backend.

## 27/10/2026 — Vocabulário compartilhado de variantes UI

- **Autor/escopo:** agente Codex, conforme pedido do Felipe de padronizar nomes de variantes entre componentes. Alteração local sobre a fase 1 em andamento; sem commit ou publicação.
- **Implementação:** `src/components/ds/variants.ts` define `UiVariant.Primary`/`Secondary` em objeto `as const` e deriva o tipo dos valores. Button usa esse tipo e default compartilhado; quatro usos explícitos de variante em empresas agora referenciam a constante. Valores/classes CSS e apresentação permanecem iguais.
- **Restrição:** lint bloqueia literais diretos e literais em expressão JSX na prop `variant`. Componentes com a mesma semântica reutilizam o vocabulário; novas variantes precisam de contrato no DS e consumidor real. Não foram adicionadas variantes sem uso.
- **Documentação:** DS, arquitetura, runbook, AGENTS e este registro atualizados. Tipo e valores não são duplicados em uniões/enum por feature; `as const` mantém o padrão de constantes adotado no projeto.
- **Validação:** `npm run verify` passou: formatação, lint, typecheck, 50 testes, 30 documentos/552 links locais e build. Três cenários adicionados ao contrato de lint para variantes permitidas/negadas; `git diff --check` passou. QA visual não repetido porque os valores e estilos não mudaram. Sem integração, dependência nova, mudança de dado ou regra de produto.
- **Rollback:** restaurar a união/default/consumidores anteriores, remover o vocabulário e as duas restrições JSX com seus testes/documentação. Não há backend ou migration para desfazer.

## 27/10/2026 — Tipagem documentada e restrições de lint

- **Autor/escopo:** agente Codex, conforme pedido do Felipe. Revisão local das convenções de tipos e endurecimento do lint, preservando a fase 1 em andamento. Sem commit, conexão externa de dados ou publicação.
- **Lint:** `any` explicitamente proibido também nos testes; imports de tipo obrigatórios; casts de objetos/arrays literais proibidos, com `as const` permitido; bloqueio de alert/confirm/prompt, reload direto da página e keys por índices `i`/`idx`/`index`, inclusive interpolados. Regras de hooks, Refresh, unused e fronteiras permanecem ativas nos seus escopos. Nenhuma dependência adicionada.
- **Entradas não validadas:** `unknown` proibido por padrão. Cinco exceções de linha justificadas preservam validação real: três respostas brutas no service, configuração externa validada por Zod e payload arbitrário de teste. Sem exceção geral por arquivo para essa regra; não se atribuiu confiança ao transporte por cast.
- **Correções:** substituído um cast de mapa Admin por `satisfies`; oito keys por índice corrigidas em DeliverablesView, NoticesView e ClientWorkspace. Dados estáticos usam identidade do conteúdo; mensagens/comentários locais agora têm tipos específicos com ID criado na inclusão, preservando textos repetidos. Sem mudança de regra de negócio, envio ou persistência. Identidades de fixtures não substituem IDs persistidos na integração futura.
- **Documentação:** arquitetura registra inferência de schemas, tipos locais, imports, constantes, mapas e ampliação de módulo do router; runbook enumera regras/exceções e limites. README, AGENTS e índice apontam para as fontes canônicas. ESLint continua sem o conjunto de análise de tipos `no-unsafe-*`; TypeScript permanece strict e oito arquivos legados mantêm somente a exceção anterior de unused.
- **Validação:** suíte com 47 testes em seis arquivos, incluindo 20 cenários de código permitido/negado contra a configuração real do ESLint. Setup DOM condicionado à presença de window para suportar o teste de lint em Node e os testes de interface em jsdom. `npm run verify` passou: formatação, lint, typecheck, 47 testes, 30 documentos/550 links locais e build. `git diff --check` passou; avisos já conhecidos do Zod permanecem no build. Sem repetição de QA visual nesta revisão técnica; não há aceite funcional de fluxo real.
- **Rollback:** reverter somente este recorte de regras, comentários de fronteira, ajustes de identidade/local types, teste de lint, setup e documentação; preservar a separação de mocks e a fundação anteriores. Sem dados/migrations para desfazer.

## 27/10/2026 — Separação dos mocks da aplicação e dos testes

- **Autor/escopo:** agente Codex, conforme pedido do Felipe. Reorganização local sobre a fundação em andamento, sem commit ou publicação; comportamentos e contratos de produto preservados.
- **Aplicação:** adapter de empresas, fixtures de empresas/avisos e cliente Axios restrito movidos para `src/mocks/adapters`, `src/mocks/fixtures` e `src/mocks/http`. Removidos `src/demo` e o adapter antes localizado no módulo de empresas. Factories/identificadores usam `Mock`/`mock`; apenas `src/api/modules/companies/api.ts` compõe a implementação de dados para os hooks. Namespace sintético de cache passou a `mock-admin`.
- **Testes:** `tests/fixtures/companies.ts` contém empresa ausente e resposta de acessos de outra empresa; `tests/mocks/http.ts` fornece respostas controladas para contratos inválidos. Integrações continuam exercitando os mocks da aplicação; dados exclusivos de erro não são importados pela aplicação. Spies usados por um único teste permanecem locais.
- **Fronteiras:** ESLint bloqueia imports de testes em `src`, acesso direto a mocks por features/DS e seleção de mocks fora da composição do módulo de API. Seis verificações dirigidas da configuração confirmaram importações permitidas/negadas.
- **Documentação:** README, AGENTS, arquitetura, índice, dados/contratos, decisões, runbook e este registro atualizados. `demo` permanece como nome do modo demonstrativo nas variáveis existentes; não houve mudança do contrato de configuração. Dados inline dos demais protótipos continuam para migração por fluxo.
- **Validação:** `npm run verify` passou com 27 testes em cinco arquivos, formatação, lint, typecheck, 30 documentos/545 links locais e build; `git diff --check` passou. Avisos de comentários de otimização do Zod permanecem. Sem alteração visual nesta reorganização; QA de navegador não repetido. Mocks não comprovam backend, autenticação ou RLS.
- **Ambientes/rollback:** sem conexão ao Supabase, dependência nova, migration, comunicação, push ou deploy. Para desfazer este recorte, restaurar a localização anterior dos mocks e seus imports/regras/documentos, preservando a fundação e as decisões anteriores.

## 27/10/2026 — Fundação local e padrão de bibliotecas

- **Autor/autorização:** agente Codex, conforme pedido do Felipe de sincronizar a main e iniciar fase 1; stack definida pelo usuário em DEC-20. Branch local `codex/fase-1-base`, criada sobre `main` `c9baea7` após merge do PR #1. Alterações desta rodada ainda sem commit, push ou PR novo.
- **Construção:** Node 24.22.1/npm 11.19.1 fixados; dependências exatas e lockfile; TanStack Form/Query/Router, Axios, Zod e date-fns. React 18 preservado. Formatação, lint com fronteiras/exceções legadas explícitas, Vitest, validação documental e workflow de CI adicionados. Workflow somente definido, sem execução no GitHub.
- **Arquivos/escopo:** bootstrap `src/main.tsx`; navegação/providers em `src/app`; módulo `src/api/modules/companies` com schemas, service, adapter demo, hooks e query keys `as const`; transporte/QueryClient; consumidor `src/features/companies`; tokens, Button/Field e helper de data; testes/configurações e documentos donos. Fixture de Avisos extraída para dono compartilhado com calendário, sem modificar conteúdo nem integrar criações em memória entre leitores.
- **Comportamento:** URLs Cliente/Admin preservam as composições demonstrativas; empresas usa filtros/seleção na URL, validação Form/Zod, cache por ator/empresa/recorte, detalhe independente da lista e quatro acessos fictícios equivalentes. Tela carregada sob demanda; não há criação, convite, alteração ou sessão real. Controle de troca Cliente/Admin corrigido no mobile; tabela tem região focável e orientação de rolagem. Demais comportamentos legados não foram normalizados globalmente.
- **Configuração/dados:** modo demo validado; URLs de API/Supabase preenchidas são rejeitadas. Axios exige adapter em memória e rejeita troca de destino/adapter. Nenhum SDK Supabase, migration, banco conectado, comunicação ou publicação. Assets externos do protótipo permanecem; não é aplicação inteiramente offline.
- **Validação local:** instalação limpa `npm ci --ignore-scripts --offline --no-fund`; `npm run verify` passou com 27 testes em cinco arquivos, formatação, lint, typecheck, links e build. `git diff --check` passou. Build: JS inicial 479,77 KB, empresas sob demanda 170,70 KB; Rollup emite dois avisos de comentários de otimização do Zod, sem falha e sem alteração manual de dependências.
- **QA de navegador:** Chromium local em 1440/1280/1024/390 px; empresas/acessos fictícios, filtros/URL/reload e navegação demonstrativa. Em 390 px, documento mede 390 px e a tabela mantém overflow interno; foco/ArrowRight produz rolagem. Capturas locais em `output/playwright` são ignoradas pelo Git. Testes de navegação cobrem link direto, filtro/Back, troca de empresa sem dados anteriores e retorno em rota inexistente.
- **Limites/estado:** fase 1 em andamento. Mocks não comprovam sessão, expiração, MFA, termos, revogação, quatro convites no servidor ou RLS. Contratos ausentes e ambiente isolado (TEC-01/02 e OPEN-10) continuam antes da integração. Sem aceite funcional de produto ou teste de usabilidade; CI/deploy não executados.
- **Rollback:** reverter apenas este recorte de código/configuração/documentação e reinstalar pelo lockfile correspondente, preservando o pacote documental mergeado. Não há dados ou migrations para desfazer.

## 26/10/2026 — Resumo diário Admin definido pela responsável de produto

- **Fonte:** [resposta da Patrícia no PR #1](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6418618652), após o questionamento encaminhado pelo Felipe; continuidade da revisão documental e atualização do PR.
- **Decisão:** DEC-19 fecha RESUMO-01 / OPEN-13 para Admins ativos. Cliente/staff não recebem; dois blocos de ações e horas por empresa, limite visual/trecho/totais, ordem, período/fuso, envio diário e ausência de atividade definidos. Conteúdo Partner será definido na fase dele. Resumo de chat das 08h não retorna.
- **Conferência técnica:** leitura da função/agendamentos na fonte da publicação 83, sem executar. Registrar corte real na geração, teto de 2.000 notificações, critérios de agrupamento/data de horas e necessidade de prova do filtro de chat; não alterar regra de produto nem prometer fechamento futuro do dia.
- **Arquivos:** regras, decisões, contratos/fontes, matriz, roadmap, contexto, catálogo, fichas e documentos de entrada alinhados; novo status do resumo propagado sem apagar o histórico da pergunta.
- **Validação:** links/âncoras, Markdown/whitespace, públicos, cobertura de 18 IDs e 30 regras, preservação de código/configuração/handoff. Sem build/typecheck, execução de e-mail/cron, RLS, QA de aplicação ou CI nesta alteração documental.
- **Limites:** mesmo PR, sem merge; fase 1 não iniciada; sem código/env/schema/policy/migration, conexão ao Supabase, envio operacional, publicação ou escrita no oficial.
- **Rollback:** reverter somente o commit documental deste contrato; nenhum runtime/dado foi alterado.

## 26/10/2026 — Revisão de produto e plano por fluxos completos

- **Autor e autorização:** agente Codex; Felipe autorizou aplicar a revisão de produto da Patrícia e atualizar o PR #1, mantendo o detalhamento do resumo diário pendente de resposta.
- **Decisões:** DEC-13 substitui DEC-07 com três públicos DISC; DEC-14 a DEC-18 registram referência funcional testada, comunicação por público, regras de produto/interface, prioridade e documentação de dados pessoais. Demais decisões anteriores continuam vigentes; aprovação interna não é ciência Cliente e pessoa focal não cria acesso principal.
- **Fontes:** comentários da Patrícia no PR e complemento fornecido pelo Felipe. Consulta somente leitura ao GitHub confirmou mensagem “Publicação 83” em `f3d3f14043a6abc38636f0340fe831e621d8b357`, o mesmo SHA das fontes. Não houve auditoria de runtime/banco.
- **Arquivos:** novos PRODUCT_RULES, BASELINE_REFERENCE_2026-10-26 e DATA_PRIVACY; atualização de README, AGENTS, índice, decisões, contexto, DS/UX, arquitetura, contratos, permissões, catálogo/fichas, política e roadmap.
- **Roadmap:** fundação mínima e entregas completas de empresas/acessos, Equipe e dados mensais; depois DISC e demais fluxos; Partner posterior. Matriz cobre os 18 IDs com dependências, bloqueios e aceite. DS, rotas, hooks e integração acompanham cada entrega.
- **Pendências:** RESUMO-01 / OPEN-13 aguardam conteúdo/público/recorte/agenda detalhados; finalidade/guarda dos dados têm inventário e validação documental próprios, sem prazos inventados. TEC-01/02/03 continuam abertos para as operações afetadas.
- **Validação desta rodada:** conferência de links/âncoras, Markdown/whitespace, regras/decisões/públicos, cobertura de fluxos e hashes de código/configuração/handoff. Build/typecheck, QA de aplicação, RLS e CI não executados, pois somente documentação mudou.
- **Execução:** nenhum código/dependência/env/schema/payload/policy ou dado alterado; sem Supabase, migration, comunicação operacional, deploy ou escrita no oficial. A atualização do PR é documental; fase 1 não iniciada.
- **Rollback:** reverter somente o commit desta revisão; preservar fontes/levantamento anteriores e histórico de decisões. Sem alteração de runtime/dados para desfazer.

## 26/10/2026 — Preparação do PR da base documental

- **Autor:** agente Codex; PR solicitado pelo usuário antes de iniciar a fase 1.
- **Escopo:** README, AGENTS e documentação nova de diagnóstico, arquitetura, produto, UX/UI, DS, fluxos, permissões, decisões, contratos, fases e validação. Handoff histórico preservado.
- **Destino:** revisão para `patricia258/cali-workspace-v2:main`, por branch `codex/docs-cali-standardization` em fork da conta autenticada, que possui somente leitura no repositório de destino. Commit e URL do PR serão informados na entrega.
- **Validação:** 27 documentos e 479 links locais conferidos; 18 IDs na matriz do roadmap; Markdown/whitespace íntegros; nenhum padrão de credencial encontrado na conferência textual; código/configuração e handoff sem alterações. A conferência textual não é certificação de segurança.
- **Limites:** sem repetição de build/typecheck por ser mudança documental; nenhum teste de aplicação, autenticação, RLS, integração ou CI executado nesta rodada. As execuções históricas permanecem identificadas nos registros anteriores.
- **Estado:** pacote preparado para revisão; fase 1 não iniciada. Não inclui merge, conexão ao Supabase, migration, comunicação operacional ou deploy.
- **Rollback:** reverter o commit documental preserva implementação e dados; regras aprovadas continuam registradas na conversa e devem ser recuperadas antes de trabalho posterior.

## 26/10/2026 — Roadmap detalhado após as decisões de produto

- **Autor:** agente Codex, conforme pedido de revisar o plano sem implementar. Revisão local sem commit.
- **Arquivos:** ROADMAP, INDEX, DECISIONS, README e este registro.
- **Mudança:** fases 0–7 detalhadas com dependências, entregas, bloqueios e aceite; decisões DEC-05 a DEC-12 rastreadas; integração organizada em ondas 6A–6D e matriz de cobertura/aceite dos 18 fluxos. Fichas permanecem donas das regras e casos de fronteira.
- **Impacto:** distingue levantamento já entregue de implementação ainda planejada; permite fundação/UX/DS/rotas independentes de contratos ausentes, mantendo bloqueio por operação real. Não expande a área Partner nem adia fluxos silenciosamente.
- **Dependências:** TEC-01/02/03, ambiente isolado e questões específicas continuam abertos até prova. Responsáveis individuais, estimativas e detalhes de contratos ainda não comprovados não foram inventados.
- **Validação:** conferência documental de links/âncoras, Markdown, cobertura dos 18 IDs e oito decisões, referências de pendências e preservação de código/configuração/handoff. Nenhum teste de aplicação, RLS ou fluxo real foi executado nesta revisão.
- **Execução:** sem mudanças de dependências, envs, migrations ou implementação; sem conexão ao banco, nova consulta ao oficial, efeito externo, CI executada, commit, PR ou publicação. Aceite de produto anterior não é aceite de implementação futura.
- **Rollback:** reverter somente esta revisão de roadmap e referências associadas, preservando levantamento e decisões de produto anteriores. Não há mudança de runtime/dados para desfazer.

## 26/10/2026 — Oito decisões de produto antes das fases

Registro histórico da rodada inicial: DEC-07 foi posteriormente substituída por DEC-13, conforme a revisão de produto acima. O alvo vigente é Cliente somente gestão, avaliador interno e respondente somente PDF próprio por e-mail.

- **Autor:** agente Codex, registrando respostas expressas do usuário.
- **Decisões:** DEC-05 a DEC-12: até quatro Clientes equivalentes sem principal; reabertura Admin do mesmo item com motivo/histórico; perfil individual e agregado liberados pela CALI; adesão antes do convite e termos obrigatórios por versão; Cliente/Admin informam e consultam privados; Cliente lança métricas e só Admin corrige; item reaberto indisponível até liberação; nova aprovação de entrega e ciência de relatório só quando solicitada.
- **Estado:** PROD-01 a PROD-08 respondidas. Nenhuma opção preselecionada foi tratada como resposta; confirmações vieram do usuário.
- **Arquivos:** registro de decisões, matriz alvo, fichas afetadas, contexto, dados/contratos, README, índice, AGENTS, roadmap e este registro.
- **Impacto:** contrato alvo documental da V2. Nenhum código, schema, enum, payload, policy, integração ou dado alterado. Tabelas de evidência oficial permanecem como retrato da revisão anterior.
- **Pendências:** TEC-01/02/03 — recuperar contratos, reconciliar guardas/consistência e provar em ambiente isolado autorizado; questões específicas de domínio/QA permanecem visíveis.
- **Validação:** coerência entre decisões/matriz/fichas, links/âncoras, Markdown e whitespace. Testes de aplicação/QA/RLS não executados, por ausência de implementação.
- **Execução:** nenhuma fase iniciada, sem conexão ao banco, migration, envio, escrita no oficial ou publicação.
- **Rollback:** reverter somente o registro e a propagação desta rodada, preservando fontes e fichas de levantamento anteriores.

## 25/10/2026 — Priorização das dúvidas antes das fases

- **Autor:** agente Codex, conforme pedido de priorizar bloqueios e perguntar decisões necessárias.
- **Arquivos:** DECISIONS, ROADMAP e este registro.
- **Resultado:** seis decisões de produto organizadas em duas rodadas; três perguntas apresentadas inicialmente. Lacunas de servidor, guardas, consistência e operação separadas como trabalho técnico; detalhes de domínio/QA não viraram bloqueios globais artificiais.
- **Estado:** respostas ainda não registradas nesta entrada; nenhuma opção preselecionada ou recomendação equivale a aprovação.
- **Impacto:** somente documentação/perguntas. Nenhuma fase de implementação, conexão ao banco, alteração de permissão, migration, publicação ou consulta adicional ao oficial.
- **Validação:** coerência com fichas/matriz e conferência documental. Sem repetição de testes da aplicação, pois código permanece intacto.
- **Rollback:** reverter somente os trechos desta priorização, preservando fichas, matriz e levantamento anteriores.

## 25/10/2026 — Fichas, transições e matriz Cliente/Admin

- **Autor:** agente Codex, conforme solicitação expressa de completar documentação sem implementar.
- **Fonte oficial:** `patricia258/app.cali@f3d3f14043a6abc38636f0340fe831e621d8b357`, somente leitura via GitHub. 367 fontes obtidas para pesquisa/conferência; 166 migrations pesquisadas, sem executar SQL ou código importado.
- **Entrega:** 18 fichas vinculadas ao catálogo, transições/guardas por domínio, matriz por operação distinguindo UI/SQL/EDGE, índice com 119 referências de fonte, 29 nomes literais de RPC sem corpo localizado e dúvidas REF-01 a REF-24.
- **Arquivos novos:** `docs/PERMISSIONS.md`; `docs/flows/README.md`, `SOURCES.md`, `ACCESS_ACCOUNTS.md`, `WORKSPACE_HOURS_TEAM.md`, `PROJECTS.md`, `CALENDAR.md`, `RECORDS.md`, `DOCUMENTS_REPORTS.md`, `ADMIN_LIFECYCLE.md`, `FORMS_PEOPLE_PROFILE.md`.
- **Arquivos atualizados:** README, AGENTS, índice, catálogo, dados/contratos, decisões, roadmap, contexto e este registro. Baseline inicial permanece como retrato histórico.
- **Impacto:** nenhuma alteração de UI/código, fórmula, payload, contrato efetivo ou permissão. Fichas são levantamento estático com dúvidas, não validação funcional.
- **Banco/migrations/envs/dependências/deploy:** nenhuma mudança ou execução. Sem conexão ao banco/integrações, login, envio, publicação ou escrita no oficial.
- **Validação:** cobertura dos 18 IDs, links/âncoras locais, referências imutáveis/linhas nas fontes, blocos Markdown, whitespace e hashes do código/configuração/handoff originais. Nenhuma suíte de aplicação repetida; não houve implementação.
- **QA visual/Admin/Cliente/RLS:** não executado. Nenhuma aprovação funcional inferida.
- **Rollback:** remover somente os onze arquivos desta etapa e reverter seus vínculos/atualizações, preservando as entregas documentais anteriores e mudanças posteriores.
- **Próximas decisões:** recuperar definições ausentes, reconciliar divergências de guardas/estados e decidir contratos antes da implementação; depois provar em ambiente isolado autorizado.

## 25/10/2026 — Reavaliação documental e cobertura UX/UI

- **Autor:** agente Codex, conforme pedido de reavaliação da documentação.
- **Base:** checkout V2 e documentos locais revistos; sem nova consulta ao oficial/banco. Nenhum commit criado.
- **Arquivos novos:** `PRODUCT_CONTEXT.md`, `UX_UI.md`, `FLOW_CATALOG.md`, `DECISIONS.md` em `docs/`.
- **Arquivos atualizados:** README, AGENTS, índice, arquitetura, DS, dados/contratos, roadmap, política de mudança e este registro.
- **Motivo:** separar experiência de componentes e consolidar contexto, tarefas/aceite e decisões sem duplicar responsabilidades.
- **Impacto:** somente documentação. Catálogo contém inventário inicial, fichas pendentes e exemplo parcial; não representa jornadas integradas.
- **Banco/migrations/envs/dependências:** nenhuma mudança. **Testes de aplicação:** não repetidos; código permaneceu intacto.
- **Validação documental:** links locais, fechamento de blocos e whitespace conferidos. **QA visual/usabilidade/Admin/Cliente:** não executado nesta revisão.
- **Aprovação:** base/escopo/identidade seguem confirmações anteriores; novas diretrizes são propostas, não aceite funcional.
- **Rollback:** remover apenas os quatro documentos desta revisão e reverter seus vínculos/ajustes nos documentos existentes, preservando a primeira entrega e alterações posteriores.
- **Próximo trabalho:** preencher fichas/contratos/permissões, resolver pendências por recorte e validar experiência com evidência.

## 25/10/2026 — Diagnóstico e documentação de desenvolvimento

- **Autor:** agente Codex, conforme solicitação do usuário.
- **Revisão analisada:** V2 `7c0a232`; referência oficial `f3d3f14043a6abc38636f0340fe831e621d8b357`, somente leitura. Nenhum commit criado nesta entrega.
- **Arquivos:** README atualizado; AGENTS criado; `docs/INDEX.md`, `BASELINE_2026-10-25.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `DATA_CONTRACTS.md`, `ROADMAP.md`, `CHANGE_POLICY.md`, `RUNBOOK.md` e este registro criados.
- **Motivo:** documentar o estado real, reconciliar os contratos oficiais CALI e propor a padronização de todos os fluxos nesta V2.
- **Decisões confirmadas pelo usuário:** V2 como base; cobertura de todos os fluxos; manter bordô/marfim/dourado; referência oficial somente leitura.
- **Impacto em fluxo:** nenhum código de aplicação alterado. Arquitetura, router, DS, hooks, contexts e integração permanecem propostas.
- **Banco/migration:** não. **Novos envs:** não. **Dependências:** nenhuma alteração no checkout.
- **Validação executada:** typecheck/build da base em cópia temporária isolada; conferência documental e de whitespace. Não existe suíte automatizada no checkout.
- **QA manual Admin/Cliente:** não executado no navegador; nenhuma jornada autenticada ou acesso ao banco.
- **Aprovação:** escopo/base/identidade confirmados; proposta de implementação ainda não submetida a aceite final.
- **Rollback:** restaurar README anterior e remover somente arquivos novos desta entrega, preservando alterações posteriores.
- **Pendências:** inventário completo de paridade, conflitos funcionais do baseline, fundação reproduzível e execução das fases propostas.
