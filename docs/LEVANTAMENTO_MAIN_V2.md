# Levantamento da main da CALI Workspace V2

Recorte de 10/11/2026. A `main` do GitHub e a referência local conferidas apontam para `69a0e9e3dd616eeef04eba59af488a78f4d72da5`. O inventário usa essa árvore e seu histórico. As alterações locais em `codex/functional-parity` ficam fora deste recorte.

- **PR #1.** Três commits consolidaram contexto, regras, catálogo de fluxos, roadmap e contrato do resumo diário Admin. [PR #1](https://github.com/patricia258/cali-workspace-v2/pull/1)
- **PR #2.** Merge em 10/11 às 10h30, horário de Brasília. Trouxe 211 commits e alterou 794 arquivos, com 84.457 linhas adicionadas e 858 removidas. Os números incluem documentação, SQL, testes e lockfile. [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) · [Merge auditado](https://github.com/patricia258/cali-workspace-v2/commit/69a0e9e3dd616eeef04eba59af488a78f4d72da5)

## 1. Estrutura e padronização de código

| Área | O que entrou na main |
| --- | --- |
| Aplicação | `src/app` concentra bootstrap, providers, roteador, navegação, composição dos workspaces e guardas. Rotas de módulos usam carregamento sob demanda. |
| Módulos | `src/modules/<admin\|client\|partner\|access\|public>/<página>`. Componentes, hooks e modelos específicos ficam junto à página ou no ancestral comum da área. A organização evita uma pasta intermediária genérica de páginas. |
| Componentes | `src/components` concentra composições compartilhadas. `src/components/ds` concentra as primitivas e variantes visuais, independentes de regras de negócio, API e banco. |
| APIs | `src/api` por área, com contratos compartilhados em `src/api/shared`. Schemas Zod validam as fronteiras e fornecem tipos inferidos. A composição seleciona o serviço conectado ou o mock previsto. |
| Fixtures | `src/mocks` para cenários locais da aplicação. `tests/fixtures` e `tests/mocks` para cenários exclusivos de teste. Modo local usa o mesmo shell da aplicação e mantém mocks de Empresas. Áreas sem serviço local exibem a indisponibilidade prevista. |
| Legado de UI | Remoção das prévias separadas de Admin e Cliente, de oito folhas CSS associadas e da fixture de Avisos exclusiva das prévias. CSS e compatibilidades ainda usados por fluxos ativos têm tratamento próprio. |
| Stack | React, TypeScript estrito, Vite, TanStack Router/Query/Form, Zod, Tailwind 4, Supabase SDK e Vitest. Node e npm têm versões delimitadas no projeto. |

Mudanças concretas nos pontos levantados na revisão de código:

- **Efeitos e hooks.** A inscrição do roteador na sessão foi para `useSessionBridge`. O callback ficou em `useAuthCallback`. O fluxo de acesso, o aceite e o MFA ganharam hooks e componentes próprios. A extração deixa assinaturas, navegação, limpeza e estado junto do fluxo que os controla.
- **Condições e composição.** Acesso foi dividido por etapa. Empresas passou a compor filtro, tabela, painel e formulários, com consultas separadas. A Visão executiva passou a tratar a consulta e a falha da carteira global independentemente da listagem de empresas. A reorganização reduz condicionais e JSX extensos nos pontos migrados.
- **Valores tipados.** `workspaceRole` padroniza guardas de papel. `UiVariant` centraliza variantes visuais. O código usa objetos `as const`, mapas tipados e tipos derivados de schemas. Comparações com literais tipados e condicionais continuam válidas conforme o contrato de cada fluxo.
- **Estado e navegação.** Filtros, seleção e detalhe usam a URL nos fluxos migrados, com retorno de navegação coberto. Consultas e cache respeitam o escopo do ator e da empresa. Respostas tardias de formulários são tratadas para preservar o contexto atual.

[Arquitetura](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/ARCHITECTURE.md) · [Changelog](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/CHANGELOG.md)

## 2. Design system e correções visuais

- Tokens CALI para bordô, marfim, dourado, superfícies, texto, estados, foco, espaçamentos e breakpoints. Inter local e utilitários semânticos Tailwind com prefixo `tw:`, sem Preflight global.
- Primitivas comuns de botão, rótulo, texto, área de texto, seleção, arquivo e checkbox. Upload em português com nomes dos arquivos, seleção múltipla quando permitida e reset do estado. Select com recuo de 12 px para texto e seta, preservando o menu nativo.
- `FormActions` padroniza botões relacionados com mesmas dimensões lado a lado e intervalo de 12 px. Empilha em espaço insuficiente. Variantes indicam ação principal e secundária.
- `Field`, `FeedbackMessage` e `FeedbackState` padronizam rótulo, validação, carregamento, vazio, sucesso e erro. Rótulo a 8 px do campo. Validação e recibos a 12 px do campo ou ação associada. Sucesso em verde e erro em vermelho com texto, borda, ícone e anúncio acessível.
- Correções de overflow em formulários, textos longos, Kanban, estrutura de Equipe, extrato de Horas, proposta por link e DISC público. Datas da Agenda e grades passam para uma coluna quando a largura exige. Tabelas mantêm rolagem no contêiner previsto.
- Correções de foco após falha, nova tentativa, download, publicação, retirada, revogação e navegação. Formulários preservam dados digitados em falhas exercitadas. Layouts usam os mesmos tokens em 375 px e 1366 px.

[Design system](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/DESIGN_SYSTEM.md) · [UX/UI](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/UX_UI.md) · [Evidências de navegador](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/HOMOLOGACAO_PATRICIA.md)

## 3. Segurança, permissões e integridade

| Área | Mudança incorporada |
| --- | --- |
| Autenticação | Entrada por código com resposta genérica ao pedir envio. O laboratório implementa expiração, limitação de solicitações e tentativas, consumo único e armazenamento protegido do código. Callback PKCE, retorno interno por papel e namespace próprio de sessão da V2. MFA com AAL2 no Admin desde a primeira entrada. Partner passou pelo piloto de código, MFA e aceite. |
| Sessão e revogação | Admissão vinculada ao ator e à sessão no servidor. Revogação de acesso ou mudança impeditiva da empresa corta a admissão. Reativação exige novo acesso. O frontend revalida a sessão, invalida rotas e limpa consultas ao trocar de ator ou perder autorização. |
| Banco e APIs | Guardas de sessão, papel, empresa e aceite em contratos do piloto. Revisão de GRANTs, RLS e RPCs, incluindo guardas em RPCs legadas e escrita de perfil. Notificações são lidas e marcadas pelo destinatário, sob sessão vigente. |
| Convites | Convite individual e até quatro acessos equivalentes por empresa. Adesão conferida antes da autorização. Reserva no servidor e idempotência para repetição e concorrência. A prova isolada registrou quatro autorizações entre cinco pedidos concorrentes. Revogar um acesso preserva os demais vínculos válidos. |
| Termos e adesão | Aceite vinculado ao ator e à versão vigente dos termos. Histórico de aceites preservado. Comprovação administrativa de adesão referencia a versão exata do contrato ou aditivo no Storage. Retirada e substituição têm histórico. |
| Arquivos | Contratos, entregáveis, documentos, relatórios e anexos usam escopo e revisão próprios. Nos fluxos pilotados, a leitura exige sessão atual, vínculo e revisão autorizada. O canal privado do piloto respondeu sem cache e recusou nova leitura após corte. Cópias já baixadas permanecem sob controle do navegador ou do destinatário. |
| Gravações e auditoria | Revisão esperada, validação de estado, histórico e identificador de operação nos fluxos que exigem consistência. Protegem contra repetição, atualização concorrente e aprovação ou retirada da versão errada. Exportação de dados e prévia de eliminação foram exercitadas com escopo sintético. |
| Comunicação e dados pessoais | Audiências distintas em DISC. Coleta e publicação públicas condicionadas ao estado e ao contrato de cada fluxo. Workers, cron e envio de pilotos têm autenticação e destinatários delimitados. Credenciais privilegiadas ficam no servidor. |

A homologação A/B documenta separação entre empresas, preservação de outros acessos quando um convite é revogado e controle de leitura dos PDFs sintéticos. As provas cobrem as operações e revisões identificadas em cada contrato. O histórico registra as diferenças entre laboratório, piloto hospedado, propostas SQL e o que ainda depende de habilitação.

[Permissões](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/PERMISSIONS.md) · [Acesso e empresas](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/contracts/ACCESS_COMPANIES.md) · [Privacidade](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/DATA_PRIVACY.md) · [Runbook](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/RUNBOOK.md)

## 4. Funcionalidades incorporadas

| Fase | Escopo na main |
| --- | --- |
| **1 — Fundação** | Roteamento Admin, Cliente, Partner e rotas públicas. Entrada, callback, MFA, termos, controle de sessão, isolamento local, contratos de dados e infraestrutura de validação. |
| **2A — Empresas e acessos** | Carteira e filtros, rascunho e cadastro definitivo, serviço/plano/horas, segmento, endereço e filiais, contato comercial, logo, ficha contratual e financeira. Contrato/aditivo versionado, comprovação de adesão, quatro acessos individuais, convite e revogação. Ciclo planejado, aberto, em revisão e encerrado. Cliente consulta a própria empresa e os termos. |
| **2B — Equipe** | Diretório, estrutura, filtros, histórico e campos com visibilidade definida por papel. Inclusão, edição, arquivamento, reativação e prévia de importação CSV. Ausência no arquivo de importação preserva o registro existente. |
| **2C — Dados mensais** | Referência por mês, coleta, confirmação, histórico e correção administrativa tardia com revisão. Consulta e atalho no Início Cliente. |
| **3A–3C — DISC** | Campanha, convite, prazo, resposta, recusa, comprovante e PDF do respondente. Relatório técnico Admin e visão gerencial com curadoria, publicação e retirada. Regra qualitativa para 5–14 respostas e agregados a partir de 15, conforme o contrato. Fila e cron exercitados com destinatários de teste. |
| **4A — Projetos e entregáveis** | Carteira, lista, Kanban, cronograma, execução, subtarefas, dependências, prazo, pausa e retomada. Conversa, ajuste por item, revisão, aprovação, reabertura e nova aprovação. Entregável PDF privado por revisão, com trilha. |
| **4B — Horas e agenda** | Lançamento manual, timer, pausa e retomada, extrato, capacidade, saldo e correção auditada. Horas ligadas a entregáveis, subtarefas e ocorrências. Agenda com remarcação e cancelamento. Encontros adicionais com opções, aprovação, realização, ata, materiais, participantes, despesas e comprovantes. |
| **4C — Ocorrências, documentos e avisos** | Interações e notas internas, estados, avaliação, reabertura e anexos múltiplos, inclusive Office. Biblioteca de PDFs com revisão, retirada, leitura e ciência. Avisos com destinatários, agenda, capa e interações moderadas. Resumo diário Admin com prévia, fila e ensaio de envio. |
| **4D — Relatórios e satisfação** | Curadoria, aprovação, PDF executivo e publicação por revisão. Indicadores e fontes visíveis ao Cliente consolidados na mesma revisão. Correção, retirada, histórico e ciência. Avaliação e acompanhamento de notas baixas. |
| **4E — Comercial e administração** | Propostas com edição, condições, calculadora, aprovação interna, PDF, ensaio de e-mail e aceite por link. Forms com editor, perguntas, condicionais, escala, bloco de texto, PDF, abertura, encerramento, triagem e exportação limitada. Mapa de People com jornada, triagem, relatório e devolutiva sintética. Equipe CALI, auditoria, pedidos de privacidade, exportação e prévia de eliminação. |
| **5 — Partner** | Login por código, MFA, convite, aceite, atribuição por empresa e revogação. Horas e timer próprios, projetos atribuídos, ocorrências com autoria e catálogos de Agenda, Documentos, Relatórios, Avisos e Equipe. PDFs publicados e decisões Admin sobre entregas. Canal temporário de OTP retirado após o piloto. |
| **6 — Regressão e áreas compartilhadas** | Carteira e agregados Admin por empresa, mês e situação. Horas, Agenda, prioridades e Satisfação. Localizador de módulos, edição do próprio nome/cargo/telefone/WhatsApp, recuperação de navegação, sino e marcação de notificações próprias. Rodadas desktop e mobile. |
| **7 — Preparação de lançamento** | Composição candidata optativa para edição do próprio perfil, sino e resumo global Admin no domínio oficial. Inventário de RPCs, origem, callback, rollback e separação futura de ambientes. |

O roadmap registra 2A, 2B e 2C fechadas no piloto A/B e Partner fechado no piloto técnico. DISC e 4A–4E têm evidências por recorte. A cobertura global de acesso, a homologação final e o rollout mantêm critérios próprios.

[Roadmap](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/ROADMAP.md) · [DISC](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/contracts/DISC_3.md) · [Fase 4](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/contracts/PHASE_4_READ.md) · [Partner](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/contracts/PARTNER_5.md)

## 5. Testes, infraestrutura e documentação

- **Automação.** A árvore tem 52 arquivos de teste. `npm run verify` encadeia formatação, lint com zero warnings, tipos, testes, configuração local, links da documentação, build da SPA e bundles de Edge para acesso, DISC, PDF e Comercial. Workflow definido para PR e push na main, com permissões de leitura.
- **Navegador.** Em 09/11, Chromium abriu 41 URLs a 375 × 812 e 1366 × 768. A regressão verificou títulos, redirecionamentos, largura, erros de JavaScript e retorno de filtro/detalhe em Empresas. Rodadas anteriores cobriram formulários, falha e repetição, histórico, foco e confirmação. A comparação de 20 telas documentada usou a main da V2 como referência.
- **Banco e Storage.** Laboratório local isolado com três migrations de baseline e ferramentas de configuração, banco, isolamento e e-mail. `supabase/proposals` reúne lotes SQL, provas e rollback de recortes. A execução de cada lote no CALI MAPA está registrada nos documentos donos. A existência de um SQL na árvore informa sua implementação ou proposta.
- **Documentação.** Catálogo e matriz de 18 fluxos, decisões de produto, contratos por domínio, permissões, privacidade, arquitetura, DS, changelog, política de mudanças e runbook. Roteiro de aceite da Patrícia com evidências e limites por piloto.

[Roteiro de homologação](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/HOMOLOGACAO_PATRICIA.md) · [Configuração local](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/LOCAL_ENVIRONMENT.md) · [Workflow](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/.github/workflows/verify.yml)

## 6. Publicação e paridade com app.cali

- A publicação precisa ser verificada pelo artefato servido e pela configuração do ambiente. A candidata do núcleo usa `VITE_CALI_RELEASE_CORE`, desativada por padrão e condicionada à origem oficial e ao CALI MAPA. Outros fluxos ainda usam condições de piloto. Isso pode deixar login, navegação e Visão Admin reduzidos, mesmo quando os módulos estão na main.
- A regressão de layout contra a main da V2 e a homologação dos fluxos comprovam os recortes documentados. A equivalência de layout, conteúdo, dados, ações e URLs com `app.cali` publicado continua em levantamento. As capturas de `/login` e `/admin` já mostram diferenças concretas.
- Fora desta revisão estão os trabalhos locais de landing, paridade de login e URLs públicas, FAQ Cliente, exportação da Visão geral, panorama e atalho de mensagem no Cliente, edição de foto e assinatura, cópia para Drive e complementos de Forms como QR, cartão, prévia social, e-mail e lixeira.
- Acervo legado, Google Calendar/Meet, operação real dos envios comerciais e devolutivas do Mapa, agendamento operacional, eliminação efetiva e aceite final têm etapas próprias de rollout. O CALI MAPA foi confirmado como produção na revisão mais recente da DEC-28. O histórico documenta pilotos com dados sintéticos e a ausência de backup integral pré-alterações comprovado.

[Candidata e ambientes](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/RUNBOOK.md) · [Decisões](https://github.com/patricia258/cali-workspace-v2/blob/69a0e9e/docs/DECISIONS.md)

## Como reproduzir o recorte

```sh
git show --no-patch --format=fuller 69a0e9e
git log --first-parent --oneline 69a0e9e
git rev-list --count 69a0e9e^1..69a0e9e^2
git diff --shortstat 69a0e9e^1 69a0e9e
git log --oneline 69a0e9e^1..69a0e9e^2
```

Levantamento estático da revisão e das evidências versionadas. A conferência atual cobriu o histórico Git e o commit remoto. Os resultados de testes e pilotos são os registrados no repositório.
