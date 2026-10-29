# Índice da documentação

Atualização: 29/10/2026. Base de desenvolvimento: este repositório V2. Escopo: diagnóstico, contratos alvo decididos e padronização de todos os fluxos; fase 1 local em andamento.

| Pergunta | Fonte canônica |
| --- | --- |
| Como iniciar e o que existe? | [README](../README.md) |
| Como um agente deve trabalhar? | [AGENTS](../AGENTS.md) |
| O que foi encontrado, com qual evidência? | [Baseline](BASELINE_2026-10-25.md) |
| Qual funcionamento oficial reproduzir? | [Referência funcional de 26/10 — publicação 83](BASELINE_REFERENCE_2026-10-26.md) |
| Quais regras de produto, públicos e comunicação valem? | [Regras de produto](PRODUCT_RULES.md) |
| Qual problema, para quem e com qual vocabulário? | [Contexto de produto](PRODUCT_CONTEXT.md) |
| Como compor telas e conduzir tarefas? | [Experiência UX/UI](UX_UI.md) |
| Quais fluxos existem e como especificá-los? | [Catálogo de fluxos](FLOW_CATALOG.md) |
| Quais transições/guardas foram encontradas no oficial? | [Fichas reconciliadas](flows/README.md) e [fontes](flows/SOURCES.md) |
| O que Cliente/Admin podem fazer, por operação? | [Matriz de permissões](PERMISSIONS.md) |
| O que foi decidido e o que está aberto? | [Decisões](DECISIONS.md) |
| Onde deve morar cada responsabilidade? | [Arquitetura e limites de migração](ARCHITECTURE.md) |
| Como preservar identidade e componentes? | [Design system inicial e contratos propostos](DESIGN_SYSTEM.md) |
| Como modelar tipos e quais restrições de lint existem? | [Tipagem](ARCHITECTURE.md#tipagem-e-validação) e [lint](RUNBOOK.md#regras-de-lint-implantadas) |
| Onde organizar mocks e dados de teste? | [Arquitetura: mocks e testes](ARCHITECTURE.md#mocks-da-aplicação-e-suporte-exclusivo-de-testes) |
| Quais contratos mínimos de acesso/empresa estão reconciliados? | [Contratos do recorte](contracts/ACCESS_COMPANIES.md) |
| Qual ambiente isolado usar e o que foi comprovado? | [Ambiente local dedicado](LOCAL_ENVIRONMENT.md) |
| Como adaptar dados e autorização? | [Dados e contratos](DATA_CONTRACTS.md) |
| Como informar/validar uso de dados pessoais no acesso? | [Dados pessoais](DATA_PRIVACY.md) |
| O que entregar, com quais dependências e aceite? | [Roadmap](ROADMAP.md) — fundação mínima, fluxos completos e matriz dos 18 IDs |
| Quais verificações e registros exigir? | [Política de mudança](CHANGE_POLICY.md) |
| O que foi entregue e validado? | [Registro de mudanças](CHANGELOG.md) |
| Como executar localmente? | [Runbook](RUNBOOK.md) |
| Qual era o contexto em 08/10? | [Handoff histórico](HANDOFF_MESTRE_CALI_WORKSPACE_V2_2026-10-08.md) |

## Estado da informação

- **Observado:** código/arquivo lido ou comando executado, com revisão e data.
- **Declarado:** informação de documento sem comprovação operacional nesta análise.
- **Proposto:** estrutura ou decisão recomendada, ainda sem implementação.
- **Pendente:** depende de decisão, inventário ou teste.
- **Confirmado pelo usuário:** V2 como base; todos os fluxos de Cliente e Admin; leitura do oficial; manutenção da identidade existente.

DEC-05 a DEC-12 registram as oito respostas iniciais; DEC-13 a DEC-18 incorporam a revisão de produto. **DEC-13 substitui DEC-07** e separa os relatórios respondente/avaliador/gestão. Demais regras anteriores continuam vigentes. Tabelas de fonte preservam evidência estática; alvo confirmado não significa implementação. DEC-19 resolve o resumo Admin em RESUMO-01 / OPEN-13; conteúdo Partner fica para sua fase; Cliente/staff não recebem e digest de chat das 08h não retorna.

Cada assunto tem um dono na tabela. Novos handoffs apontam para essas fontes e registram somente alterações/pendências, sem reproduzir regras completas.

## Reavaliação de cobertura — 25/10/2026

DS especifica peças e tokens; UX/UI especifica tarefa, hierarquia, composição e interação. O handoff continha orientações de experiência dispersas, sem uma fonte canônica atual. Foram consolidadas em UX/UI; contexto, catálogo e decisões completam o mínimo para orientar IA sem inventar produto.

| Frente | Cobertura documental atual | O que ainda exige trabalho |
| --- | --- | --- |
| Produto e linguagem | Contexto e regras atuais consolidados | Provar RESUMO-01 Admin e reconciliar contratos específicos; voz CALI no produto, preferência técnica restrita às sessões Felipe |
| UX/UI | Diretrizes/famílias propostas e fichas com fontes de apresentação | Evidência visual e validação de tarefas/continuidade |
| DS | Tokens/catálogo/comportamentos propostos | Valores finais, pares de contraste, componentes reais e QA |
| Fluxos e permissões | 18 fichas e matriz Cliente/Admin preenchidas com evidência estática | Resolver contratos ausentes/divergências e provar permissões/transições em ambiente isolado |
| Arquitetura e dados | Fronteiras e integração propostas | Contratos concretos, schema/tipos e ambiente isolado |
| Dados pessoais | Inventário documental, leitores conhecidos e informação no acesso | Validar finalidade/uso/guarda por campo e refletir conteúdo na versão apresentada, sem prazo inventado |
| Decisões | Confirmações e pendências registradas | Resolver o que bloqueia cada recorte, sem assumir aprovação |
| Qualidade e operação | Política/runbook existentes | Scripts/testes/CI e procedimentos reais conforme implementação |

Não é necessário criar agora outro guia genérico de UI, um arquivo por tela, uma segunda política de testes ou ADRs vazias. Próxima documentação deve preencher contratos, permissões, fichas e evidências nos donos existentes. Arquivo de domínio/ADR novo só quando houver conteúdo concreto que justifique a separação.

## Precedência e limites

Pedidos expressos atuais definem o trabalho. Código comprova implementação; documentos registram intenção e regras. Divergência funcional exige localizar contrato e registrar decisão, não apenas escolher o arquivo mais novo.

O contrato alvo confirmado orienta a arquitetura e a identidade CALI. Handoff de 08/10 permanece intacto como histórico; divergências estão no baseline.

Produção, Auth, RLS, integrações e migrations ativas não foram verificadas. Código oficial foi lido na revisão fixada no baseline.

## Cruzamento de fichas — 25/10/2026

Revisão oficial fixada em `f3d3f14043a6abc38636f0340fe831e621d8b357`, sem escrita. Fichas em `docs/flows/` são donas das transições/guardas observadas; PERMISSIONS organiza as permissões por operação; SOURCES registra proveniência; DECISIONS registra conflitos. Nenhuma substitui teste do backend ativo. Matriz completa do papel Partner não faz parte do recorte Cliente/Admin; a administração dele e seus efeitos foram documentados.

## Fechamento da rodada de produto — 26/10/2026

PROD-01 a PROD-08 foram respondidas; a revisão da Patrícia substituiu PROD-03 por DEC-13. Regras foram refletidas nas fichas/matriz sem alterar código ou fonte oficial. TEC-01/02/03 continuam como investigação/prova de engenharia. OPEN-13 registra o resumo Admin resolvido por DEC-19, com conteúdo Partner adiado; OPEN-14 acompanha conteúdo de finalidade/guarda/informação no acesso. Não transformar essas pendências em bloqueios globais artificiais.

O roadmap atual fecha tarefas de ponta a ponta após fundação mínima: primeiro empresas/acessos, Equipe e dados mensais; depois DISC e demais fluxos; Partner posterior. DS, rotas, hooks/adaptadores e validação crescem junto dos consumidores. Os 18 IDs têm dependências e aceite. O código `f3d3f14` já identifica a publicação 83; o registro de 26/10 explicita o funcionamento oficial testado como referência. Fase 1 iniciada em 27/10: router, Query/Form, módulo demonstrativo de empresas e DS inicial existem. Gates locais e workflow estão definidos; Auth/TOTP, adesão, códigos/termos e estado/revogação/RLS do recorte foram testados no laboratório em 29/10. Controller/guardas da SPA estão preparados; adapter/eventos/telas e fluxos completos continuam pendentes. Estado executável e limites estão no runbook e na arquitetura.
