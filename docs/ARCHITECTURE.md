# Arquitetura de desenvolvimento

Atualização: 02/11/2026. **Fase 1 em andamento: sessão/guardas/telas e leitura de empresas conectadas ao hospedado conforme DEC-27.** A base é `c9baea7` da `main`. Laboratório local preserva provas próprias de Auth/MFA, código, termos, adesão e RLS; nenhuma migration local foi aplicada no hospedado. Provas de jornada e limites estão no [ambiente](LOCAL_ENVIRONMENT.md#backend-hospedado--dec-27).

Ler [Regras de produto](PRODUCT_RULES.md), [referência funcional publicação 83](BASELINE_REFERENCE_2026-10-26.md), [fichas](flows/README.md) e [roadmap](ROADMAP.md). Estrutura de código não aprova regra nova. A V2 é a base, o repositório oficial permanece somente leitura; uso do backend hospedado segue DEC-27.

## Bibliotecas escolhidas

Felipe definiu em 27/10: TanStack Form (`@tanstack/react-form`), Query (`@tanstack/react-query`) e Router (`@tanstack/react-router`), date-fns, Axios e Zod. Vite permanece o bundler; TanStack Router é a escolha de roteamento do projeto. React Router deixa de ser a proposta da V2. React 18 foi preservado.

Tailwind CSS 4.3.3 com `@tailwindcss/vite` 4.3.3 e `prettier-plugin-tailwindcss` 0.8.1 foi integrado em 28/10 (DEC-24). Bootstrap importa tokens e folha Tailwind uma vez; DS/features usam utilities `tw:` e aliases CALI, sem Preflight nesta coexistência. [Política e inventário de estilos](DESIGN_SYSTEM.md#política-de-css) definem migração por consumidor e limpeza final.

Versões são fixadas em package/lockfile; Node e npm estão documentados no [runbook](RUNBOOK.md). Escolha de versões foi conferida por documentação primária via Context7, peer dependencies e execução local. Não instalar biblioteca adicional por analogia nem criar abstração sem consumidor.

## Fronteiras e estado implementado

Fluxo atual de dados: **view → hook de consulta do módulo → service → adapter Supabase ou Axios/fixtures, selecionado na composição**. Zod valida filtros, datas e retorno; Query controla ciclo assíncrono/cache. Os caminhos virtuais do adapter são contrato interno dos mocks de desenvolvimento, não endpoints oficiais nem substitutos de RPC Supabase.

| Dono | Responsabilidade e estado |
| --- | --- |
| `src/main.tsx` | Bootstrap, validação demo/Supabase e composição dos serviços/controller; sem JSX de negócio |
| `src/app` | Router, Query provider e ponte de navegação para composições existentes |
| `src/app/ClientWorkspace.tsx` | Composição cliente extraída do bootstrap, ainda com estado/fixtures legados a migrar por fluxo |
| `src/AdminPreview.tsx` | Layout/prévias Admin existentes com seção controlada pela URL; empresas usa o novo consumidor |
| `src/features/companies` | Filtros, lista, detalhe/acessos e formulário de edição básica da empresa por composição; sem SDK, Axios ou fixture importados diretamente |
| `src/api/modules/companies` | Schemas/tipos, keys por ator/vínculo, service mock, adapter hospedado, hooks Query e mutation de nomes com confirmação/preimagem |
| `src/mocks/http/client.ts` | Axios com adapter obrigatório; destinos, baseURL e transporte alternativos recusados; nenhum modo de rede nesta etapa |
| `src/api/supabase.ts` | Cliente oficial com chave pública, namespace Auth próprio e refresh; SDK restrito à fronteira de dados |
| `src/api/modules/access` | Contratos e adapter Auth/Edge/MFA/termos, agregação de acesso e hook de snapshot |
| `src/features/access` | Formulários de código/MFA/aceite; sem SDK ou tokens |
| `src/app/WorkspaceLayout.tsx` | Shell conectado mínimo, sem métricas demonstrativas ou troca fictícia de papel |
| `src/api/query-client.ts` | Configuração do QueryClient, criado por instância do router; não guarda dados em context |
| `src/components/ds` | Button/Field/Checkbox/FeedbackState com utilities Tailwind e variantes tipadas; sem dependência de app, feature ou API |
| `src/styles/tokens.css` | Tokens iniciais consumidos pelas peças e página de empresas; não substitui ainda toda a cascata legada |
| `src/mocks/fixtures/notices.ts` | Seeds de Avisos compartilhados com as prévias de mural/calendário; alterações do mural ainda não compõem um domínio vivo comum |
| `src/lib/dates.ts` | Formatação de data civil com date-fns, preservando o dia informado |

Não criar árvores paralelas `data` e `hooks/api` para repetir a responsabilidade agora consolidada no módulo de API. Adaptador real futuro entra na fronteira do respectivo módulo, após contrato/autorização; essa mudança não transforma o frontend em backend nem exige proxy HTTP artificial.

## Organização dos módulos de API

```text
src/api/
  query-client.ts
  modules/companies/
    schemas.ts
    keys.ts
    service.ts
    api.ts
    hooks/useCompaniesQuery.ts
    hooks/useCompanyQuery.ts
    hooks/useCompanyAccessesQuery.ts
```

- `schemas.ts`: projeções e validações com Zod; tipos inferidos. Não modelar o banco oficial manualmente a partir de DTO demo.
- `service.ts`: contrato de leitura do módulo, transporte e validação do retorno. Consome AbortSignal e rejeita resposta de outra empresa. Não contém JSX ou estado de view.
- `keys.ts`: identificadores em objeto `as const` e factories de tuplas; sem enums TypeScript ou strings repetidas nos consumidores. Chaves incluem ator, módulo, operação, empresa e filtros que alterem resposta. Filtro equivalente produz chave equivalente.
- `hooks`: nomes de domínio, ciclo Query e `queryOptions` compartilháveis. Evitar wrappers que apenas renomeiam propriedades sem responsabilidade real.
- `api.ts`: composição da instância utilizada pela SPA com mocks de desenvolvimento; `mock-admin` é ator sintético fixo, não autenticação.
- Escrita futura: adicionar service e hook `use...Mutation` quando houver operação/consumidor reais, com mutation key tipada, confirmação do resultado e invalidação dos leitores afetados. Não criar mutation genérica ou arquivo vazio para aparentar estrutura.

As consultas de lista, detalhe e acessos têm cache separado. Não usar dados anteriores de outra empresa como placeholder. Na composição hospedada, ator/vínculo vêm do snapshot autenticado. Login/logout/troca invalidam e limpam cache; revalidação válida do mesmo contexto preserva trabalho. Bloqueio/erro removem dados. Testes de controller/rotas não equivalem à prova completa de revogação no servidor hospedado.

## Edição básica de empresas — 02/11

`CompanyBasics` contém a tarefa inline; `useCompanyQuery` lê o detalhe e `useUpdateCompanyBasics` coordena a gravação/invalidação. `CompanyBasicsEditor` mantém o snapshot original e rascunho local: refetch de fundo não sobrescreve campos editados; conflito exige descarte/reconsulta explícitos. Estado transitório não vira context. URL continua dona da empresa selecionada.

A fronteira hospedada atualiza somente os dois nomes, com filtros de preimagem e retorno validado; não modifica plano/convites/perfis/automações. Mocks de runtime têm estado por instância. [Contrato e limites](contracts/ACCESS_COMPANIES.md#fase-2a-iniciada--edição-básica-da-empresa-0211). Integração e mutação existem no código, sem prova nova de escrita/RLS hospedada.

## Cadastro, adesão e acessos demonstrativos — 02/11

A capacidade opcional `CompaniesService.management` mantém a composição explícita: adapter demonstrativo fornece transporte virtual tipado; hospedado usa null até reconciliar contratos. A feature só recebe disponibilidade e hooks, sem SDK, Axios ou fixtures. Não há contexto global novo nem seleção de mock em hooks/services.

`management-schemas.ts` define comandos virtuais/requestId e evento de acesso; reutiliza schemas de identidade/acesso e adesão de DEC-23. `management.ts` valida respostas e vínculo por empresa. `useCompanyManagement.ts` coordena consultas/mutations e invalidação por ator, sem optimistic updates/retry. `CompanyRegistration`, `CompanyAdhesions` e `CompanyAccessManagement` compõem as tarefas; a página continua dona da seleção por URL. Drafts/transitórios ficam locais e são desmontados ao trocar empresa. Resultado tardio de cadastro não restaura navegação após unmount.

`src/mocks/adapters/companies.ts` é o único dono do estado mutável demonstrativo: empresas, referências, autorizações, eventos e ledger de solicitações por instância. Gate/limite/preimagem/histórico são executados nessa fronteira antes da resposta, sem chamadas externas. Recarregar descarta tudo; não é backend alternativo persistente nem certificação de RLS. [Contrato e limites](contracts/ACCESS_COMPANIES.md#fase-2a--cadastro-adesão-e-quatro-acessos-demonstrativos).

## Consolidação de acesso e empresas — 02/11

Reorganização sem alteração dos contratos de transporte ou regras de autorização. `App` mantém apenas os providers; `useSessionBridge` possui assinaturas Auth/sessão/router e cleanup. `useAuthCallback` coordena callback, refresh e retorno; a página apresenta seu resultado. `useAccessFlow` reutiliza `useWorkspaceSession`, resolve a sessão e coordena o retorno seguro por papel. `useTermsAcceptance` mantém a concordância vinculada a ator/versão/hash no ciclo do fluxo; extrair o painel não permite reaproveitar concordância para outra identidade ou conteúdo. `useMfaEnrollment` possui consulta, retry e preparação do autenticador. Código, MFA e termos têm componentes separados, e `CodeInput` é um controle do domínio compartilhado pelos dois formulários de código.

A seleção de etapas de `AccessFlow` usa branches explícitos; motivos de acesso têm vocabulário fechado e mensagens em mapa tipado, com entrada desconhecida normalizada para indisponível. Isso preserva o fallback anterior. Não exige enum TypeScript nativo nem impede strings verificadas pelo tipo. Mapas de apresentação de empresas/planos e ações do histórico são conferidos contra os contratos donos com `satisfies Record`.

`CompaniesPage` compõe cadastro, filtros, tabela e detalhe/acessos. `CompanyFilters`/`useCompanyFilters` possuem o rascunho e a sincronização com URL/Back/Forward; seleção aplicada continua na URL. `CompaniesTable` possui sua consulta e apresenta resultados. `CompanyAccessPanel` possui consultas de detalhe/acessos; formulários, linha e histórico da gestão têm componentes próprios, preservando snapshot de edição, confirmação, requestId e foco. Queries/mutations continuam nos módulos existentes; não há service/context paralelo.

`Checkbox` e `FeedbackState` são primitivas DS com consumidores reais; mensagens, disponibilidade de retry e efeitos continuam no domínio. Efeitos estritamente locais de foco e proteção de resultado tardio permanecem junto dos consumidores. Esta consolidação não encerra a migração do legado, a homologação de acesso ou a fase 2A.

## Tipagem e validação

Tipos ficam junto do dono: contratos de empresas em `src/api/modules/companies/schemas.ts`; props e modelos exclusivos de uma composição permanecem locais. Não criar uma pasta global `types` sem consumidores que justifiquem compartilhamento.

- Quando existe schema de runtime, inferir o tipo com `z.infer<typeof schema>`: `Company`, `CompanyAccess`, `CompanyFilters` e `CompanySearch`. Não repetir manualmente a mesma estrutura em uma interface que possa divergir do schema. Esses contratos são projeções locais de demonstração, não tipos do banco oficial.
- Para props/modelos locais sem validação externa, usar um `type` específico ou inferência quando a estrutura já estiver clara. `PreviewMessage` e `NoticeComment` têm `id` e `text`; o ID é criado ao adicionar a entrada, permitindo conteúdos repetidos sem usar posição como identidade.
- O vocabulário de variantes UI fica em `src/components/ds/variants.ts`: constante `UiVariant` com `Primary`/`Secondary` e tipo derivado. Componentes reutilizam o tipo quando a semântica coincide; consumidores podem usar strings tipadas no JSX, sem importar a constante de valores. Ver [design system](DESIGN_SYSTEM.md#vocabulário-compartilhado-de-variantes).
- Usar `as const` para constantes e tuplas de query keys. Para mapas conhecidos, usar anotação ou `satisfies Record<Chaves, Valor>`; `Record<Section, string>` é um mapa fechado legítimo. Não substituir um objeto de domínio por um dicionário genérico para evitar sua modelagem.
- `import type` e modificadores inline `type` separam tipos dos valores executados. A interface `Register` do router existe para ampliação de módulo do TanStack; essa necessidade não justifica duplicar os DTOs inferidos.
- Entrada bruta não ganha tipo confiável por cast. O service recebe respostas Axios como `unknown`, faz parse Zod e confere o vínculo da empresa antes do retorno. Configuração externa passa por `safeParse`. São exceções locais justificadas no lint, não tipos propagados ao domínio. O helper de teste aceita payload arbitrário para exercitar respostas inválidas.

O lint restringe `any`, `unknown` fora dessas entradas justificadas, casts de objetos/arrays literais e imports de tipo incorretos. `as const` continua permitido; as regras não proíbem toda assertion possível. TypeScript permanece `strict`; esta configuração não ativa o conjunto de regras ESLint com análise de tipos `no-unsafe-*`. Não alegar essa garantia. Regras/exceções completas estão no [runbook](RUNBOOK.md#regras-de-lint-implantadas).

## Contratos de acesso e laboratório local — 28/10

`src/api/modules/access/schemas.ts` contém requests/respostas de workspace-access e projeções mínimas planejadas de perfil/aceite. `companies/records.ts` separa records de empresa/convite do DTO de demonstração. Schemas não habilitam Auth, transportes, guardas ou RLS; [contrato e lacunas](contracts/ACCESS_COMPANIES.md). Admin exige os dois passos em DEC-21.

DEC-22/25 usam Supabase local dedicado com serviços internal e proxy de loopback. `local-environment.ts` confere configuração; `local-database.ts` confere alvo/topologia e aplica somente baseline conhecida com journal/digest. `supabase/migrations/20261029090000_access_adhesion_baseline.sql` contém empresa/perfil/adesão, helpers privados e RLS; testes SQL e driver API/Auth provam esse recorte. Scripts de runtime são explícitos e não fazem parte do verify/CI comum. O recorte descrito neste histórico usou SPA demo; DEC-27 integra a SPA ao hospedado, sem reutilizar automaticamente o SQL do laboratório; [ambiente, comandos e limites](LOCAL_ENVIRONMENT.md).

## Código, termos e preparação de sessão — 29/10

`supabase/functions/workspace-access` é backend local: handler compartilha os schemas Zod de entrada, ports explícitos e adapter Edge com destinos internos fixos. `scripts/build-local-functions.ts` usa Vite para bundle autocontido ignorado; nenhum npm import é resolvido em execução na rede internal. O build está no verify sem Docker/rede/segredos; runtime e testes continuam comandos explícitos.

Migrations `20261029120000_codes_terms.sql` e `20261029123000_access_revocation.sql` adicionam códigos privados, serialização/uso único, versões/aceites imutáveis, estado de acesso e revogação. Runner aceita apenas lista revisada em ordem com journal/digest; não altera migrations já aplicadas. Schema de códigos é novo da V2, não recuperação do DDL ausente. [Contrato e limites](contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910).

`src/api/modules/access/session.ts` é dono do contrato validado do estado/conteúdo corrente. `src/app/session/controller.ts` recebe fonte por injeção, controla cancelamento/gerações/cache e não guarda tokens. `guard.ts` decide por status/papel e saneia retorno; Router beforeLoad e assinatura no App têm consumidores reais nos testes. Nenhum context global foi adicionado. Fonte Auth/refresh/eventos e telas de acesso ainda não estão conectados; DEC-27 conecta adapter/telas e composição por ator real. `mock-admin` continua exclusivo da demonstração; a agregação hospedada não equivale à RPC/policies da baseline local.

## Mocks da aplicação e suporte exclusivo de testes

```text
src/mocks/
  http/client.ts             # Axios restrito ao adapter em memória
  adapters/companies.ts      # Simulação das operações de empresas
  fixtures/companies.ts      # Empresas/acessos usados pela aplicação
  fixtures/notices.ts        # Avisos compartilhados nas prévias legadas
tests/
  fixtures/companies.ts      # Empresa ausente e acessos de outra empresa
  mocks/http.ts              # Respostas controladas para casos adversos
```

Fixtures são dados sintéticos; mocks simulam respostas/comportamentos. Código executado pela aplicação fica em `src/mocks`; arquivos usados exclusivamente por testes ficam em `tests/fixtures` ou `tests/mocks`. Testes de integração podem consumir os mocks da aplicação para exercitar a mesma composição, sem copiar suas fixtures. Cenários de erro específicos usam os dados/adapters exclusivos dos testes. Spies locais de uma única asserção permanecem no próprio teste.

A aplicação nunca importa `tests`. Em features e DS, imports de mocks também são bloqueados; no módulo de API, apenas `api.ts` seleciona a implementação mock. Schemas, services e hooks não importam fixtures/adapters diretamente. ESLint verifica essas fronteiras. As prévias legadas de Avisos/Calendário ainda consomem as fixtures diretamente até a migração do seu fluxo. Outros dados inline do protótipo permanecem pendentes de extração por recorte; esta reorganização não os migrou globalmente.

O nome `demo` continua nas variáveis de configuração e nos textos que identificam o modo demonstrativo; não é uma pasta nem um segundo mecanismo de dados. Integração futura substitui a composição do serviço por transporte real após contrato/ambiente autorizados. Mocks de desenvolvimento só permanecem em um modo explícito; sua remoção da execução normal não elimina os cenários necessários aos testes. Não importar `tests` no runtime nem tratar mock como autorização de servidor.

## Navegação e continuidade

TanStack Router usa árvore definida em código, sem plugin de geração de rotas. `src/app/navigation.ts` é o catálogo de caminhos; parents Cliente/Admin preservam as composições existentes entre filhos. As prévias ainda são uma ponte de migração, não features totalmente extraídas.

`/admin/clientes` já possui busca, situação e empresa selecionada na URL com validação Zod; formulário TanStack mantém rascunho e aplica filtros por submit. Back/Forward restaura lista/formulário; acesso por link direto consulta o detalhe independentemente da lista. Outros filtros/abas/rascunhos legados continuam locais até seu recorte.

A tela de empresas é carregada sob demanda. Bootstrap/provider/router não são fonte de autorização; alternar Cliente/Admin continua demonstração explícita. Há erro de configuração e rota não encontrada, sem login fictício tratado como sessão real.

### Mapa de rotas


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

## Dono de cada estado

| Estado | Dono |
| --- | --- |
| Caminho e filtros confirmados de empresas | Router/search validado; não duplicar em useState |
| Busca durante digitação | TanStack Form; restaurada quando muda a URL confirmada |
| Respostas de empresas/acessos | Query com keys por ator/empresa/recorte; sem arrays em context |
| Campos derivados | Função/modelo local; não copiar respostas em effects |
| Preferência ou estado local de prévia | Componente; continuidade declarada no recorte |
| Sessão e vínculo real | Provider futuro, somente após contrato e ambiente isolado |

## Contexts, limites e migração

QueryClientProvider e RouterProvider têm consumidores reais. Nenhum context de domínio foi criado. Sessão/workspace só recebem provider próprio com fonte, consumidores, validade e limpeza explícitos; DS recebe props e não conhece empresa.

Views não importam SDK/transporte; DS não importa app/features/API. ESLint verifica essas fronteiras para a nova estrutura. As composições legadas preservam exceção localizada de imports/variáveis não usados; sua formatação fica fora da rodada para não misturar uma migração global ao primeiro consumidor. Ver escopo e comandos no runbook.

Não transportar runtimes DOM como arquitetura definitiva. Por operação, localizar evento, permissão, transição e efeito; mover regra para domínio/adaptador e interação para componente/hook com prova de paridade. Proposta não é implementada só porque sua pasta aparece no mapa.

Referências primárias consultadas: [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/guide/code-based-routing), [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [TanStack Form](https://tanstack.com/form/latest/docs/framework/react/guides/validation), [Axios](https://axios-http.com/docs/req_config), [Zod](https://zod.dev/api) e [date-fns](https://date-fns.org/docs/parseISO).
