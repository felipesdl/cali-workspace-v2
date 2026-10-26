# Arquitetura de desenvolvimento

Estado: **proposta para esta V2**, em 25/10/2026. Nenhuma das pastas ou dependências abaixo foi criada nesta análise. Estado implementado: [baseline](BASELINE_2026-10-25.md).

Antes de extrair uma feature, localizar sua tarefa no [Catálogo de fluxos](FLOW_CATALOG.md) e suas questões no [Registro de decisões](DECISIONS.md). Organização de código não substitui especificação de [UX/UI](UX_UI.md) nem aprovação de regra funcional.

Contrato vigente: [Regras de produto](PRODUCT_RULES.md) e [referência funcional publicação 83](BASELINE_REFERENCE_2026-10-26.md). O [roadmap](ROADMAP.md) cresce por entregas completas: fundação mínima para o primeiro fluxo e DS/rotas/hooks/dados/testes junto dos consumidores. Não exigir todos os módulos demo antes de integrar a primeira jornada. Públicos DISC seguem DEC-13; finalidade/projeção/guarda constam em [Dados pessoais](DATA_PRIVACY.md).

## Decisões e alcance

| Decisão | Estado | Justificativa |
| --- | --- | --- |
| V2 como base; oficial somente como referência | Confirmada pelo usuário | Evolução deve ocorrer neste repositório |
| Todos os fluxos de Cliente e Admin | Confirmada pelo usuário | Padronização transversal, não uma tela isolada |
| Identidade bordô/marfim/dourado | Confirmada pelo usuário | Consolidar design existente |
| Manter React/TypeScript/Vite | Recomendada | Oficial e V2 já compartilham stack; troca de framework não resolve acoplamento |
| React Router para URLs/layouts | Recomendada | Roteador já usado no oficial; permite preservar contratos de navegação |
| TanStack Query para dados assíncronos | Recomendada, ainda sem dependência | Dono de cache, loading, retry e invalidação por domínio |
| CSS com tokens e escopo por componente | Recomendada | Evitar migração de ferramenta de estilo junto da reorganização |
| Contexts apenas para sessão/workspace/UI transversal justificada | Recomendada | Não substituir URL, cache ou estado local |
| Store global adicional | Sem necessidade demonstrada | Estado transversal exige fonte, consumidores e ciclo de vida definidos |

Versões de novas dependências devem ser escolhidas e fixadas na fase de fundação. Não confundir recomendações atuais da biblioteca com a versão React Router 6 declarada no oficial.

## Fronteiras

Fluxo principal: **rota / layout → view → hook de modelo → hook de dados → adaptador → Supabase**. Regra pura fica no domínio; primitivas visuais ficam no DS. Fixtures entram pelo adaptador demo, usando os mesmos contratos da integração futura.

| Camada | Dona de | Não deve fazer |
| --- | --- | --- |
| `app` | Bootstrap, rotas, providers e layouts persistentes | Consultas de negócio ou páginas monolíticas |
| `components/ds` | Aparência/comportamento genéricos e acessibilidade | Conhecer empresa, perfil, tabela ou SDK Supabase |
| `features` | Jornadas, composição, seleção e modelo de apresentação | Consultar banco diretamente ou duplicar regras oficiais |
| `hooks/api` | Lifecycle assíncrono, query keys, mutações e invalidação | JSX ou regras de autorização como fonte de verdade |
| `data` | Contratos tipados, mapeamento de respostas e acesso por domínio | Estado de UI ou regras baseadas em texto do DOM |
| `lib/domain` | Regras puras compartilhadas e semântica de negócio | Efeitos de React, globais DOM ou SDK |
| `lib/navigation` | Parse/serialização/validação de contexto navegável | Autorizar acesso a uma empresa |
| `lib/supabase` | Cliente configurado, tipos gerados e limite de schema | Fallback silencioso para produção ou secrets de servidor |
| `demo` | Fixtures sintéticos coerentes e cenários | Dados reais ou segunda implementação de fórmula oficial |

Essa separação substitui a dependência atual `CalendarView → NoticesView.noticeSamples`. Ambos devem consumir o domínio de avisos.

## Estrutura proposta

```text
src/
  main.tsx                         # somente bootstrap
  app/
    App.tsx
    router.tsx                     # catálogo de rotas e layouts
    routes/                        # entradas finas para features
    layouts/
      workspace-shell/WorkspaceShell.tsx
      client-layout/ClientLayout.tsx
      admin-layout/AdminLayout.tsx
    providers/                     # somente quando houver responsabilidade real
  components/
    ds/
      foundations/
      actions/button/Button.tsx
      navigation/tabs/Tabs.tsx
      overlays/dialog/Dialog.tsx
      overlays/drawer/Drawer.tsx
      feedback/
      index.ts                     # catálogo real de vários componentes
  features/
    team/
      team-view/
        TeamView.tsx
        types.ts                   # se compartilhado dentro do slice
        constants.ts               # se houver configuração local
        hooks/useTeamModel.ts
        components/person-row/PersonRow.tsx
    hours/
    projects/
    records/
    calendar/
    documents/
    reports/
    notices/
    accounts/
    proposals/
  hooks/api/<dominio>/
    keys.ts
    queries.ts
    mutations.ts                   # apenas se houver escrita autorizada
    types.ts                       # apenas se compartilhado
  data/<dominio>/
    contracts.ts
    demo.ts
    supabase.ts                    # somente na fase de integração
    mappers.ts                     # quando transporte e modelo diferirem
  lib/
    domain/
    navigation/
    supabase/
  demo/fixtures/
  styles/
    tokens.css
    reset.css
    typography.css
tests/                             # suítes conforme responsabilidade
docs/
```

Não criar todos esses diretórios vazios. Cada extração deve trazer consumidores reais. Um arquivo TSX por componente extraído; componente trivial pode permanecer como markup do pai. Nomes de pasta em kebab-case, componente em PascalCase, hook em `use...`.

Tipo usado em um arquivo permanece nele. `constants.ts` não recebe regra de negócio nem objetos sem consumidor. Imports canônicos diretos; barrel somente com API real. Alias `@/` é opcional e exige configurar TS e bundler juntos.

## Layout e navegação

Um `WorkspaceShell` compartilha estrutura, slots e responsividade. `ClientLayout` e `AdminLayout` fornecem menus, cabeçalhos e ações permitidas. Não duplicar sidebar/topbar por página. Layout pai recebe o conteúdo da rota por `Outlet`; navegação entre filhos não remonta o shell.

Referência: [layouts e rotas aninhadas](https://reactrouter.com/start/declarative/routing). Em hosting estático, resolver acesso direto a URLs válidas para `index.html`, preservando assets: [fallback de SPA](https://reactrouter.com/how-to/spa). Adaptar ao build Vite; não copiar comandos de Framework Mode do React Router.

### Mapa de rotas proposto

Preservar prefixos e caminhos do oficial para compatibilidade. Itens que não existem no protótipo são inventário de paridade, não novas funcionalidades aprovadas.

| Área | Rotas a preservar/planejar | Dono |
| --- | --- | --- |
| Entrada/sessão | `/login`, `/auth/callback` | Autenticação |
| Cliente | `/cliente` | Início |
| Equipe | `/cliente/equipe`, `/admin/equipe` | Team |
| Horas | `/cliente/horas`, `/admin/horas` | Hours |
| Agenda/cronograma | `/cliente/cronograma`, `/admin/calendario` | Calendar |
| Projetos/entregáveis | `/cliente/entregaveis`, `/admin/projetos` | Projects |
| Ocorrências | `/cliente/registros`, `/admin/registros` | Records |
| Documentos | `/cliente/documentos`, `/admin/documentos` | Documents |
| Relatórios | `/cliente/relatorios`, `/admin/relatorios`, respectivas `/impressao/:reportId` | Reports |
| Avisos | `/cliente/avisos`, `/admin/avisos` | Notices |
| Contas | `/admin/clientes` | Accounts |
| Propostas | `/admin/propostas`, `/admin/propostas/:submissionId/editar`, `/admin/propostas/proposta/:proposalId` | Proposals |
| Admin geral | `/admin` | Visão executiva |
| Fluxos adicionais oficiais | `/equipe/*`, equipe CALI, auditoria, satisfação, Mapa de People, formulários, perfil, frentes, ajuda e páginas públicas | Inventariar antes de definir migração |
| Integrações/legal | Callback Google e páginas legais existentes | Preservar contrato exato na fase de integração |

Detalhes de projeto, abas e filtros podem usar parâmetros/search params sem inventar novos caminhos nesta análise. Não trocar links oficiais por nomes internos como `records`/`overview`. Menu, título e breadcrumb derivam do mesmo catálogo de navegação.

### Dono de cada estado

| Estado | Dono proposto | Regra |
| --- | --- | --- |
| Página, aba compartilhável, período, filtros confirmados | URL | Parse tipado, defaults e serialização canônica; Back/Forward restaura contexto |
| Empresa selecionada Admin | URL validada e exposta pelo workspace | Uma fonte; não espelhar em outro `useState` |
| Empresa cliente | Vínculo autenticado/autorizado | URL não concede acesso; conflito de empresa deve falhar explicitamente |
| Usuário, sessão e acesso | Provider de sessão | Criar ao integrar Auth; sem papéis reais simulados como autorização |
| Respostas remotas | TanStack Query | Isolar identidade, empresa e recorte; não duplicar arrays em context |
| Busca durante digitação, drawer, menu, formulário | Componente/hook local | Definir política de descarte/preservação ao sair |
| Preferência transversal leve | Provider de UI, se necessário | Documentar consumidores; não instalar store antes da necessidade |
| Valores derivados | Função pura/modelo | Evitar effects para copiar props e sincronizar estados redundantes |

## Hooks reutilizáveis

- `useTeamModel`, `useHoursModel` etc. compõem dados, filtros, seleção e ações da feature. Componentes recebem props tipadas; não conhecem transporte.
- `hooks/api/<dominio>/queries.ts` consulta adaptador por contrato. `mutations.ts` define quais listas, detalhes, resumos e leitores invalidar; erro permanece observável.
- Query key inclui identidade do usuário/escopo de acesso, empresa, período e filtros que alteram resposta. Exemplo conceitual: `['workspace', userId, companyId, 'hours', period, filters]`.
- Normalizar listas de filtro; equivalente deve produzir chave equivalente. Não incluir `monthLabel` traduzido como identificador canônico de período.
- Trocar empresa deve fechar detalhes antigos, cancelar requisições pertinentes e impedir apresentação de dados anteriores como atuais. Remover cache sensível conforme política de acesso; logout limpa cache de query e mutation. Não usar `keepPreviousData` entre empresas inadvertidamente.
- Atualização otimista só com rollback e autorização definidos. Nas primeiras escritas, preferir confirmação do servidor e invalidação explícita.
- Hooks técnicos como debounce, fechamento externo ou URL só são extraídos com comportamento repetido. Acessibilidade de overlay pertence à primitiva, não a cada view.

Referências: [query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [invalidação por mutação](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) e [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient). Política de isolamento acima é uma decisão proposta do CALI apoiada nessas APIs, não uma garantia automática da biblioteca.

## Contexts

Criar somente quando houver dados realmente transversais: sessão e contexto do workspace são candidatos. Provider precisa declarar fonte, consumidores, validade e comportamento ao trocar usuário/empresa. Separar providers com frequência de atualização distinta; memoização não corrige responsabilidade excessiva.

Uma feature com estado complexo pode usar reducer/hook local antes de context. DS recebe propriedades; não depende de `WorkspaceContext`. Não criar context para listas de pessoas, relatórios ou horas remotas.

## Migração de comportamento oficial

Não copiar runtimes DOM para sustentar a estrutura nova. Para cada comportamento externo à árvore React: localizar evento, seletor, consulta/RPC, permissão, transição, efeito e feedback; criar contrato e teste de paridade; mover regra para domínio/adaptador e interação para hook/componente. Só remover a dependência depois de demonstrar a equivalência.

Esse trabalho é especialmente relevante para projetos/aprovações, relatórios, calendário e ocorrências. Um botão visualmente igual pode não preservar uma operação instalada por runtime. Base V2 deve ter ações explícitas em React.
