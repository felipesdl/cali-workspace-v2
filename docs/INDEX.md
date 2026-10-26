# Índice da documentação

Atualização: 26/10/2026. Base de desenvolvimento: este repositório V2. Escopo: diagnóstico, contratos alvo decididos e proposta de padronização de todos os fluxos.

| Pergunta | Fonte canônica |
| --- | --- |
| Como iniciar e o que existe? | [README](../README.md) |
| Como um agente deve trabalhar? | [AGENTS](../AGENTS.md) |
| O que foi encontrado, com qual evidência? | [Baseline](BASELINE_2026-10-25.md) |
| Qual problema, para quem e com qual vocabulário? | [Contexto de produto](PRODUCT_CONTEXT.md) |
| Como compor telas e conduzir tarefas? | [Experiência UX/UI](UX_UI.md) |
| Quais fluxos existem e como especificá-los? | [Catálogo de fluxos](FLOW_CATALOG.md) |
| Quais transições/guardas foram encontradas no oficial? | [Fichas reconciliadas](flows/README.md) e [fontes](flows/SOURCES.md) |
| O que Cliente/Admin podem fazer, por operação? | [Matriz de permissões](PERMISSIONS.md) |
| O que foi decidido e o que está aberto? | [Decisões](DECISIONS.md) |
| Onde deve morar cada responsabilidade? | [Arquitetura proposta](ARCHITECTURE.md) |
| Como preservar identidade e componentes? | [Design system proposto](DESIGN_SYSTEM.md) |
| Como adaptar dados e autorização? | [Dados e contratos](DATA_CONTRACTS.md) |
| O que mudar, em qual fase, com quais dependências e aceite? | [Roadmap](ROADMAP.md) — fases 0–7, ondas de integração, matriz dos 18 fluxos e bloqueios técnicos |
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

DEC-05 a DEC-12 registram as oito respostas posteriores de produto. São alvo da V2, com prioridade sobre proposta anterior para o mesmo assunto. Não alteram o retrato estático do oficial: tabelas de fonte e seções de alvo confirmado têm responsabilidades distintas.

Cada assunto tem um dono na tabela. Novos handoffs apontam para essas fontes e registram somente alterações/pendências, sem reproduzir regras completas.

## Reavaliação de cobertura — 25/10/2026

DS especifica peças e tokens; UX/UI especifica tarefa, hierarquia, composição e interação. O handoff continha orientações de experiência dispersas, sem uma fonte canônica atual. Foram consolidadas em UX/UI; contexto, catálogo e decisões completam o mínimo para orientar IA sem inventar produto.

| Frente | Cobertura documental atual | O que ainda exige trabalho |
| --- | --- | --- |
| Produto e linguagem | Contexto consolidado | Reconciliar definições/contratos específicos ao detalhar domínio |
| UX/UI | Diretrizes/famílias propostas e fichas com fontes de apresentação | Evidência visual e validação de tarefas/continuidade |
| DS | Tokens/catálogo/comportamentos propostos | Valores finais, pares de contraste, componentes reais e QA |
| Fluxos e permissões | 18 fichas e matriz Cliente/Admin preenchidas com evidência estática | Resolver contratos ausentes/divergências e provar permissões/transições em ambiente isolado |
| Arquitetura e dados | Fronteiras e integração propostas | Contratos concretos, schema/tipos e ambiente isolado |
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

PROD-01 a PROD-08 foram respondidas; regras alvo foram refletidas nas fichas e matriz, sem modificar fonte oficial ou código. As pendências remanescentes TEC-01/02/03 são de engenharia: contratos ausentes, guardas/consistência e comprovação em ambiente autorizado. Questões específicas de domínio/QA continuam registradas sem virar bloqueios globais artificiais. Nenhuma fase foi iniciada nesta rodada.

O roadmap foi detalhado após essas respostas: separa levantamento entregue, fundação local, DS/UX, navegação, cobertura demo, acesso isolado, integração por dependência e homologação. Cada fase define entrada, entregas, bloqueios e saída verificável; os 18 fluxos têm rastreabilidade de integração e aceite. A revisão continua sendo planejamento, sem iniciar implementação ou reduzir escopo a um fluxo piloto.
