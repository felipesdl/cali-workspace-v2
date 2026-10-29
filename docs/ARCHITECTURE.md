# Arquitetura de desenvolvimento

Atualização: 29/10/2026. **Fundação local iniciada; fase 1 em andamento.** A base sincronizada é `c9baea7` da `main`, após merge do PR documental. Rotas, Query/Form, módulo demonstrativo de empresas, tokens e duas primitivas existem; sessão no frontend e integração de produto continuam pendentes. Laboratório local já testa Auth/MFA, código, termos, adesão, estado/revogação de sessão e RLS do recorte. Controller/guardas do frontend estão preparados por injeção; adapter e telas reais permanecem pendentes.

Ler [Regras de produto](PRODUCT_RULES.md), [referência funcional publicação 83](BASELINE_REFERENCE_2026-10-26.md), [fichas](flows/README.md) e [roadmap](ROADMAP.md). Estrutura de código não aprova regra nova. A V2 é a base, o oficial permanece somente leitura.

## Bibliotecas escolhidas

Felipe definiu em 27/10: TanStack Form (`@tanstack/react-form`), Query (`@tanstack/react-query`) e Router (`@tanstack/react-router`), date-fns, Axios e Zod. Vite permanece o bundler; TanStack Router é a escolha de roteamento do projeto. React Router deixa de ser a proposta da V2. React 18 foi preservado.

Tailwind CSS 4.3.3 com `@tailwindcss/vite` 4.3.3 e `prettier-plugin-tailwindcss` 0.8.1 foi integrado em 28/10 (DEC-24). Bootstrap importa tokens e folha Tailwind uma vez; DS/features usam utilities `tw:` e aliases CALI, sem Preflight nesta coexistência. [Política e inventário de estilos](DESIGN_SYSTEM.md#política-de-css) definem migração por consumidor e limpeza final.

Versões são fixadas em package/lockfile; Node e npm estão documentados no [runbook](RUNBOOK.md). Escolha de versões foi conferida por documentação primária via Context7, peer dependencies e execução local. Não instalar biblioteca adicional por analogia nem criar abstração sem consumidor.

## Fronteiras e estado implementado

Fluxo atual de dados: **view → hook de consulta do módulo → service → Axios com adapter local → fixtures**. Zod valida filtros, datas e retorno; Query controla ciclo assíncrono/cache. Os caminhos virtuais do adapter são contrato interno dos mocks de desenvolvimento, não endpoints oficiais nem substitutos de RPC Supabase.

| Dono | Responsabilidade e estado |
| --- | --- |
| `src/main.tsx` | Bootstrap e validação da configuração demo; sem JSX de negócio |
| `src/app` | Router, Query provider e ponte de navegação para composições existentes |
| `src/app/ClientWorkspace.tsx` | Composição cliente extraída do bootstrap, ainda com estado/fixtures legados a migrar por fluxo |
| `src/AdminPreview.tsx` | Layout/prévias Admin existentes com seção controlada pela URL; empresas usa o novo consumidor |
| `src/features/companies` | Formulário de filtros, lista e consulta de acessos locais; sem SDK, Axios ou fixture importados diretamente |
| `src/api/modules/companies` | Schema/tipos, keys, service, composição do adapter mock e hooks Query com consumidores reais |
| `src/mocks/http/client.ts` | Axios com adapter obrigatório; destinos, baseURL e transporte alternativos recusados; nenhum modo de rede nesta etapa |
| `src/api/query-client.ts` | Configuração do QueryClient, criado por instância do router; não guarda dados em context |
| `src/components/ds` | Button/Field com utilities Tailwind e variantes tipadas; sem dependência de app, feature ou API |
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

As consultas de lista, detalhe e acessos têm cache separado. Não usar dados anteriores de outra empresa como placeholder. Na integração real, ator/vínculo virão da sessão autenticada e logout/revogação deverão cancelar/limpar cache e detalhes; isso ainda não está implementado nem comprovado pelo isolamento de chaves demo.

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

DEC-22/25 usam Supabase local dedicado com serviços internal e proxy de loopback. `local-environment.ts` confere configuração; `local-database.ts` confere alvo/topologia e aplica somente baseline conhecida com journal/digest. `supabase/migrations/20261029090000_access_adhesion_baseline.sql` contém empresa/perfil/adesão, helpers privados e RLS; testes SQL e driver API/Auth provam esse recorte. Scripts de runtime são explícitos e não fazem parte do verify/CI comum. A SPA permanece em modo demo; [ambiente, comandos e limites](LOCAL_ENVIRONMENT.md).

## Código, termos e preparação de sessão — 29/10

`supabase/functions/workspace-access` é backend local: handler compartilha os schemas Zod de entrada, ports explícitos e adapter Edge com destinos internos fixos. `scripts/build-local-functions.ts` usa Vite para bundle autocontido ignorado; nenhum npm import é resolvido em execução na rede internal. O build está no verify sem Docker/rede/segredos; runtime e testes continuam comandos explícitos.

Migrations `20261029120000_codes_terms.sql` e `20261029123000_access_revocation.sql` adicionam códigos privados, serialização/uso único, versões/aceites imutáveis, estado de acesso e revogação. Runner aceita apenas lista revisada em ordem com journal/digest; não altera migrations já aplicadas. Schema de códigos é novo da V2, não recuperação do DDL ausente. [Contrato e limites](contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910).

`src/api/modules/access/session.ts` é dono do contrato validado do estado/conteúdo corrente. `src/app/session/controller.ts` recebe fonte por injeção, controla cancelamento/gerações/cache e não guarda tokens. `guard.ts` decide por status/papel e saneia retorno; Router beforeLoad e assinatura no App têm consumidores reais nos testes. Nenhum context global foi adicionado. Fonte Auth/refresh/eventos e telas de acesso ainda não estão conectados; bootstrap demo continua recusando configuração real. A composição/mock-admin de empresas não virou identidade autenticada.

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
