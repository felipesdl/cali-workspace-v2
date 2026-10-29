# CALI Workspace V2

Base escolhida para evolução do sistema, conforme confirmação do usuário em 25/10/2026. Frontend React/TypeScript/Vite continua com mocks e estado em memória; laboratório Supabase local dedicado possui adesão, códigos de acesso, termos versionados e guardas de servidor testados, sem conexão da SPA ao backend ou ao oficial.

**CALI administra; cliente acompanha, participa, valida e avalia.** Equipe cadastrada não equivale a usuários com acesso.

## Estado atual — 29/10/2026

- Cliente: Início, Equipe, Horas, Calendário, Ocorrências, Documentos, Relatórios, Projetos/Entregáveis e Avisos têm composições demonstrativas.
- Admin: prévia com 11 seções, incluindo contas, propostas e equipe.
- TanStack Router controla URLs Cliente/Admin; composições legadas continuam como ponte de migração. Controller/guardas aceitam fonte de sessão injetada nos testes; adapter Auth e telas de acesso ainda não estão conectados.
- Empresas em `/admin/clientes` usa TanStack Form/Query, Axios com adapter local e Zod; filtros/empresa na URL, cache separado e até quatro acessos fictícios equivalentes. Sem cadastro, convite ou alteração real.
- API organizada por módulos em `src/api/modules`, com schemas, services, hooks e query keys `as const`. DS inicial contém tokens, Button e Field; demais componentes continuam propostos.
- Tailwind 4 integrado ao Vite; Button, Field e empresas migrados. Legado migra por fluxo, com limpeza global após retirar seus consumidores. Ver [política e inventário](docs/DESIGN_SYSTEM.md#inventário-da-migração-de-estilos).
- Mocks executados pela aplicação ficam em `src/mocks`; cenários exclusivos ficam em `tests/fixtures` e `tests/mocks`. Aplicação não importa testes. Ver [organização e fronteiras](docs/ARCHITECTURE.md#mocks-da-aplicação-e-suporte-exclusivo-de-testes).
- Tipos de contratos são inferidos dos schemas Zod; props/modelos locais ficam no consumidor. Ver [tipagem](docs/ARCHITECTURE.md#tipagem-e-validação) e [restrições de lint](docs/RUNBOOK.md#regras-de-lint-implantadas).
- [Contratos mínimos de acesso/empresa](docs/contracts/ACCESS_COMPANIES.md) e persistência local de adesão, com autoria/instante do servidor, histórico e RLS; Auth/MFA reais testados apenas pelo driver local. Frontend continua desconectado. Admin exige os dois passos e aceite corrente no servidor (DEC-21/26).
- Códigos locais usam Edge/Mailpit/Auth, consumo único e limites no banco. Termos têm versões imutáveis, hash/aceite do servidor e bloqueio por ausência/nova versão; conteúdo dos testes é sintético, sem aprovação jurídica de produção. Ver [contrato](docs/contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910).
- [Ambiente local dedicado](docs/LOCAL_ENVIRONMENT.md) executado/testado, com serviços em rede internal e proxy de loopback; procedimentos, parada e limites registrados. Não inicia como efeito do build.
- Formulários e interações locais não comprovam persistência, envio, aprovação ou ciência.
- Escopo confirmado: padronizar todos os fluxos de Cliente e Admin e consolidar identidade bordô, marfim e dourado.
- O código de `patricia258/app.cali` foi consultado somente em leitura como referência de contratos. Não é o destino da refatoração.

## Executar

```bash
npm ci --ignore-scripts
npm run verify
npm run dev
```

Runtime local fixado: Node 24.22.1 e npm 11.19.1, com lockfile e versões exatas. Gates e limites estão no [runbook](docs/RUNBOOK.md). Workflow de verificação está definido; execução remota não foi realizada nesta etapa.

`.env.example` habilita somente demonstração. Configuração de API/Supabase não vazia é rejeitada; o cliente Axios exige adapter em memória. Não há SDK Supabase ou transporte de rede para dados deste módulo. Assets externos do protótipo permanecem; isso não representa aplicação inteiramente offline.

## Documentação para desenvolvimento e IA

Comece por [AGENTS.md](AGENTS.md) e pelo [índice](docs/INDEX.md).

| Documento | Responsabilidade |
| --- | --- |
| [Diagnóstico](docs/BASELINE_2026-10-25.md) | Estado da V2, evidências e contratos oficiais CALI |
| [Referência funcional](docs/BASELINE_REFERENCE_2026-10-26.md) | Funcionamento oficial de 26/10, publicação 83, como base de paridade |
| [Regras de produto](docs/PRODUCT_RULES.md) | Regras atuais de negócio, interface, públicos DISC e comunicação |
| [Contexto de produto](docs/PRODUCT_CONTEXT.md) | Problema, atores, vocabulário e limites |
| [Experiência UX/UI](docs/UX_UI.md) | Jornadas, composição, interação, conteúdo e responsividade |
| [Catálogo de fluxos](docs/FLOW_CATALOG.md) | Cobertura, fichas e critérios de aceite por tarefa |
| [Fichas reconciliadas](docs/flows/README.md) | 18 fluxos com transições/fontes do oficial, sem implementação |
| [Permissões Cliente/Admin](docs/PERMISSIONS.md) | Operações por papel, condições, camada e dúvidas |
| [Decisões](docs/DECISIONS.md) | Confirmações, propostas e pendências sem suposições |
| [Arquitetura](docs/ARCHITECTURE.md) | Estrutura implementada e limites de migração, rotas, hooks, layouts e contexts |
| [Design system](docs/DESIGN_SYSTEM.md) | Identidade, tokens e contratos de componentes |
| [Dados e contratos](docs/DATA_CONTRACTS.md) | Adaptação Supabase, permissões e inventário pendente |
| [Dados pessoais](docs/DATA_PRIVACY.md) | Finalidades, leitores, guarda e informação/validação no acesso |
| [Plano e fases](docs/ROADMAP.md) | Entregas completas por fluxo, dependências, bloqueios e aceite dos 18 IDs |
| [Política de mudança](docs/CHANGE_POLICY.md) | Validação e entrega |
| [Operação local](docs/RUNBOOK.md) | Comandos existentes e limites de verificação |
| [Handoff de 08/10](docs/HANDOFF_MESTRE_CALI_WORKSPACE_V2_2026-10-08.md) | Contexto histórico a reconciliar com evidências posteriores |

Estruturas descritas como **proposta** ainda não estão implementadas. Diagnóstico não certifica fluxos autenticados nem estado ativo do Supabase.

Fichas e matriz foram cruzadas em leitura estática com o oficial `f3d3f140`. Fontes imutáveis e 29 chamadas de RPC sem corpo localizado estão em `docs/flows/SOURCES.md`; dúvidas de reprodução/negócio estão em `docs/DECISIONS.md`. Condição encontrada no código não é permissão comprovada em produção.

Em 26/10/2026, a revisão de produto foi incorporada às [decisões](docs/DECISIONS.md) e regras. **DEC-13 substitui DEC-07:** Cliente recebe somente gestão DISC liberada; avaliador é interno CALI, sem liberação; respondente recebe apenas PDF próprio por e-mail, sem resultado na tela. As demais decisões anteriores continuam vigentes. Publicação 83 corresponde ao mesmo SHA das fontes; validação funcional da referência foi declarada pela Patrícia, sem auditoria de produção pelo agente. O roadmap entrega primeiro a rotina Admin/Cliente, depois DISC; Partner fica posterior. DEC-19 fecha o resumo diário Admin às 19h de Brasília, sem Cliente/staff/chat; conteúdo Partner fica para sua fase. Contrato e limites de corte/volume estão em RESUMO-01 e Dados e contratos. A fundação local de 27/10 está em andamento; regras de acesso e fluxos completos ainda aguardam implementação e prova em ambiente isolado.

## Ambientes declarados

- Aplicação oficial de referência: [app.calirh.com](https://app.calirh.com), código [app.cali](https://github.com/patricia258/app.cali).
- Base V2: [cali-workspace-v2](https://github.com/patricia258/cali-workspace-v2).
- Backend informado no handoff: CALI MAPA, schema `cali_workspace`. Nenhuma conexão foi criada nesta análise.
- Vercel, proteção e domínios são informações documentadas; configuração ativa não verificada.

Usar fixtures sintéticos. Fase 1 iniciada localmente, a partir da `main` `c9baea7`, na branch `codex/fase-1-base`, enviada para revisão no [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) em rascunho. Concluído e pendente estão no [acompanhamento da fase 1](docs/ROADMAP.md#acompanhamento-da-fase-1--pacote-para-revisão); a fase ainda não está encerrada. Sem conexão ao Supabase oficial ou deploy. Integração futura exige ambiente isolado, contratos reconciliados e testes de acesso. Publicação e migração de produção dependem de escopo próprio.
