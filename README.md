# CALI Workspace V2

Base escolhida para evolução do sistema, conforme confirmação do usuário em 25/10/2026. Frontend React/TypeScript/Vite possui composição demonstrativa ou integração ao backend hospedado autorizado em DEC-27. Auth/MFA/termos e leitura de empresas já têm consumidores reais; laboratório local preserva provas de adesão/códigos/revogação sem que sua baseline tenha sido aplicada no hospedado.

**CALI administra; cliente acompanha, participa, valida e avalia.** Equipe cadastrada não equivale a usuários com acesso.

## Estado atual — 05/11/2026

- DEC-28 confirma o CALI MAPA como staging de testes, com backup e restauração dispensados para os lotes autorizados nesse ambiente. Produção será outro projeto, com baseline e migrations validadas, sem fixtures. [Plano e critérios](docs/RUNBOOK.md#backup-restauração-e-ambientes--dec-28).
- A 2A, a 2B e a 2C estão homologadas funcionalmente no piloto sintético A/B do CALI MAPA. A fase 1 continua em andamento no escopo global. A fase 3, perfil comportamental DISC, foi implementada no piloto, com worker v7 publicado. A execução temporária do cron passou e a agenda voltou a ficar desligada. Aceite para coleta real continua pendente. [Estado por fase](docs/ROADMAP.md).
- Cliente conectado usa Início, Minha empresa, Termos e privacidade, Equipe e gestão DISC liberada. Equipe deriva a empresa da sessão e permite cadastro, edição, arquivamento, privados com declaração, importação CSV com prévia, estrutura e histórico. Demais módulos conectados apresentam sua preparação. A composição simplificada foi autorizada para os testes. A paridade visual com a publicação 83 será implementada e validada no frontend final antes do lançamento.
- Admin conectado mantém Empresas e acessos, seleciona A/B em Equipe e administra campanhas/avaliador/gestão DISC, com MFA. O piloto validou cadastro, comprovação por versão documental, ficha administrativa, convites individuais e transições do ciclo. O limite de quatro vagas sob concorrência foi comprovado na cópia descartável. As referências e limitações ficam nos [contratos de empresas/acesso](docs/contracts/ACCESS_COMPANIES.md) e [Equipe](docs/contracts/TEAM_2B.md).
- Dados mensais estão conectados no piloto: primeiro lançamento Cliente, correção Admin com motivo, confirmação/reconfirmação, vagas e indicadores essenciais de até 12 referências. A pendência no Início é exclusiva do Cliente, sem ativar e-mail. [Contrato mensal](docs/contracts/TEAM_MONTHLY_2C.md).
- A homologação de Equipe no navegador integrado cobre Admin e Clientes A/B. Equivalência de dois Clientes da mesma empresa e corte individual têm prova em banco descartável. A coleta de dados reais exige validação de finalidade, necessidade e guarda. Demonstrações dos demais módulos continuam disponíveis como referência de composição.
- TanStack Router controla URLs Cliente/Admin. SDK Supabase 2.118.0, adapter Auth, namespace próprio, eventos/revalidação e guardas estão conectados às telas de código/MFA/termos e callback PKCE. A cobertura global de sessão e os cenários de callback continuam no roadmap.
- API organizada por módulos em `src/api/modules`, com schemas, services, hooks e query keys `as const`. DS do recorte contém tokens, Button, Field, Checkbox e FeedbackState; demais componentes continuam propostos. Acesso e empresas têm composição por etapas/tarefas, hooks de coordenação e mapas tipados; isso não encerra a migração global do frontend.
- Tailwind 4 integrado ao Vite; Button, Field e empresas migrados. Legado migra por fluxo, com limpeza global após retirar seus consumidores. Ver [política e inventário](docs/DESIGN_SYSTEM.md#inventário-da-migração-de-estilos).
- A rodada histórica de 01/11 identificou leitura com JWT anterior ao corte e recuperação da sessão após reativação. As provas posteriores da 2A homologaram o corte no piloto A/B. A cobertura de outras superfícies segue por domínio. [Rodada histórica](docs/LOCAL_ENVIRONMENT.md#rodada-cliente-ab--0111) e [estado corrente](docs/contracts/ACCESS_COMPANIES.md).
- A admissão do piloto usa convite individual e sessão admitida pelo servidor. A2 completou o primeiro acesso e a revogação no CALI MAPA, com A1 e B preservados. O destinatário temporário foi retirado e o provisionamento voltou a ficar desligado. [Prova isolada](docs/LOCAL_ENVIRONMENT.md#homologação-isolada-de-convites-e-sessão--0411) e [contrato do piloto](docs/contracts/ACCESS_COMPANIES.md).
- Mocks executados pela aplicação ficam em `src/mocks`; cenários exclusivos ficam em `tests/fixtures` e `tests/mocks`. Aplicação não importa testes. Ver [organização e fronteiras](docs/ARCHITECTURE.md#mocks-da-aplicação-e-suporte-exclusivo-de-testes).
- Tipos de contratos são inferidos dos schemas Zod; props/modelos locais ficam no consumidor. Ver [tipagem](docs/ARCHITECTURE.md#tipagem-e-validação) e [restrições de lint](docs/RUNBOOK.md#regras-de-lint-implantadas).
- [Contratos mínimos de acesso/empresa](docs/contracts/ACCESS_COMPANIES.md) e persistência local de adesão, com autoria/instante do servidor, histórico e RLS; Auth/MFA reais foram testados pelo driver local; jornada Admin/aceite e Clientes A/B têm evidência hospedada no recorte descrito abaixo. Admin exige os dois passos e aceite corrente na V2. Predicados/RLS do laboratório não comprovam as mesmas guardas no hospedado; ver contrato vigente DEC-27.
- Códigos locais usam Edge/Mailpit/Auth, consumo único e limites no banco. Termos têm versões imutáveis, hash/aceite do servidor e bloqueio por ausência/nova versão; conteúdo dos testes é sintético, sem aprovação jurídica de produção. Ver [contrato](docs/contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910).
- [Ambiente local dedicado](docs/LOCAL_ENVIRONMENT.md) executado/testado, com serviços em rede internal e proxy de loopback; procedimentos, parada e limites registrados. Não inicia como efeito do build.
- Interações demonstrativas não comprovam persistência, envio, aprovação ou ciência. Consumidores conectados precisam da confirmação da operação; evidências atuais e limites estão no changelog.
- Escopo confirmado: padronizar todos os fluxos de Cliente e Admin e consolidar identidade bordô, marfim e dourado.
- O código de `patricia258/app.cali` foi consultado somente em leitura como referência de contratos. Não é o destino da refatoração.

O [contrato DISC](docs/contracts/DISC_3.md) distingue implementação local, worker hospedado v7 e prova temporária da agenda. O incremento SQL, Vault e hash da credencial estão configurados no CALI MAPA. O [roteiro da Patrícia](docs/HOMOLOGACAO_PATRICIA.md) fica reservado para o aceite final, após a conclusão e a validação interna da V2. O processamento de envios é manual e restrito; nenhum cron novo DISC está ativo.

## Executar

```bash
npm ci --ignore-scripts
npm run verify
npm run dev
```

Runtime local fixado: Node 24.22.1 e npm 11.19.1, com lockfile e versões exatas. Gates e limites estão no [runbook](docs/RUNBOOK.md). Workflow de verificação está definido; execução remota não foi realizada nesta etapa.

`.env.example` documenta a demonstração. No `.env` ignorado, URL Supabase e chave pública completas selecionam a integração hospedada; sem ambas, configuração parcial falha sem fallback. Não há credencial administrativa no frontend. Sessão da V2 é independente do online; veja [operação e comparação](docs/LOCAL_ENVIRONMENT.md#backend-hospedado--dec-27). Fixtures usam exclusivamente o adapter Axios em memória; a composição conectada não apresenta métricas sintéticas dos módulos ainda em migração.

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

- V1 publicada para referência, sem uso operacional conforme confirmação da Patrícia. [Aplicação](https://app.calirh.com) · [Código](https://github.com/patricia258/app.cali).
- V2 em desenvolvimento para o primeiro lançamento operacional. [Repositório](https://github.com/patricia258/cali-workspace-v2).
- Backend informado no handoff: CALI MAPA, schema `cali_workspace`. Leitura autenticada verificada em 31/10; desenvolvimento com atores/dados sintéticos autorizado em 01/11, DEC-27.
- Vercel, proteção e domínios são informações documentadas; configuração ativa não verificada.

Usar fixtures sintéticos. Fase 1 iniciada localmente, a partir da `main` `c9baea7`, na branch `codex/fase-1-base`, enviada para revisão no [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) em rascunho. Concluído e pendente estão no [acompanhamento da fase 1](docs/ROADMAP.md#acompanhamento-da-fase-1--pacote-para-revisão); a fase ainda não está encerrada. Integração ao backend hospedado autorizada em DEC-27, sem deploy. Contratos efetivos e testes por ator continuam necessários; baseline local não foi aplicada no hospedado. Publicação e migração de produção dependem de escopo próprio.
