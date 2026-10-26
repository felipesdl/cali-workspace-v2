# CALI Workspace V2

Base escolhida para evolução do sistema, conforme confirmação do usuário em 25/10/2026. Implementação atual: protótipo React, TypeScript e Vite, com dados fictícios e estado em memória. Ainda não há integração Supabase neste checkout.

**CALI administra; cliente acompanha, participa, valida e avalia.** Equipe cadastrada não equivale a usuários com acesso.

## Estado verificado em 25/10/2026

- Cliente: Início, Equipe, Horas, Calendário, Ocorrências, Documentos, Relatórios, Projetos/Entregáveis e Avisos têm composições demonstrativas.
- Admin: prévia com 11 seções, incluindo contas, propostas e equipe.
- Navegação por `useState`, sem rotas por URL, autenticação ou permissões reais.
- Formulários e interações locais não comprovam persistência, envio, aprovação ou ciência.
- Escopo confirmado: padronizar todos os fluxos de Cliente e Admin e consolidar identidade bordô, marfim e dourado.
- O código de `patricia258/app.cali` foi consultado somente em leitura como referência de contratos. Não é o destino da refatoração.

## Executar

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Ainda não há lockfile nem versão de Node declarada. Uma instalação nova pode resolver versões diferentes. A análise validou uma cópia temporária com Node 24.22.1 e npm 11.19.1; isso não define automaticamente o runtime suportado.

`.env.example` declara `VITE_DEMO_MODE=true`, mas o código não lê essa variável. Ela ainda não bloqueia integrações tecnicamente; a ausência de acesso ao banco decorre do código atual.

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
| [Arquitetura](docs/ARCHITECTURE.md) | Estrutura proposta, rotas, hooks, layouts e contexts |
| [Design system](docs/DESIGN_SYSTEM.md) | Identidade, tokens e contratos de componentes |
| [Dados e contratos](docs/DATA_CONTRACTS.md) | Adaptação Supabase, permissões e inventário pendente |
| [Dados pessoais](docs/DATA_PRIVACY.md) | Finalidades, leitores, guarda e informação/validação no acesso |
| [Plano e fases](docs/ROADMAP.md) | Entregas completas por fluxo, dependências, bloqueios e aceite dos 18 IDs |
| [Política de mudança](docs/CHANGE_POLICY.md) | Validação e entrega |
| [Operação local](docs/RUNBOOK.md) | Comandos existentes e limites de verificação |
| [Handoff de 08/10](docs/HANDOFF_MESTRE_CALI_WORKSPACE_V2_2026-10-08.md) | Contexto histórico a reconciliar com evidências posteriores |

Estruturas descritas como **proposta** ainda não estão implementadas. Diagnóstico não certifica fluxos autenticados nem estado ativo do Supabase.

Fichas e matriz foram cruzadas em leitura estática com o oficial `f3d3f140`. Fontes imutáveis e 29 chamadas de RPC sem corpo localizado estão em `docs/flows/SOURCES.md`; dúvidas de reprodução/negócio estão em `docs/DECISIONS.md`. Condição encontrada no código não é permissão comprovada em produção.

Em 26/10/2026, a revisão de produto foi incorporada às [decisões](docs/DECISIONS.md) e regras. **DEC-13 substitui DEC-07:** Cliente recebe somente gestão DISC liberada; avaliador é interno CALI, sem liberação; respondente recebe apenas PDF próprio por e-mail, sem resultado na tela. As demais decisões anteriores continuam vigentes. Publicação 83 corresponde ao mesmo SHA das fontes; validação funcional da referência foi declarada pela Patrícia, sem auditoria de produção pelo agente. O roadmap entrega primeiro a rotina Admin/Cliente, depois DISC; Partner fica posterior. Resumo diário às 19h mantém detalhamento pendente em RESUMO-01. Nenhuma implementação foi iniciada.

## Ambientes declarados

- Aplicação oficial de referência: [app.calirh.com](https://app.calirh.com), código [app.cali](https://github.com/patricia258/app.cali).
- Base V2: [cali-workspace-v2](https://github.com/patricia258/cali-workspace-v2).
- Backend informado no handoff: CALI MAPA, schema `cali_workspace`. Nenhuma conexão foi criada nesta análise.
- Vercel, proteção e domínios são informações documentadas; configuração ativa não verificada.

Usar fixtures sintéticos. Integração futura exige ambiente isolado, contratos reconciliados e testes de acesso. Publicação e migração de produção dependem de escopo próprio.
