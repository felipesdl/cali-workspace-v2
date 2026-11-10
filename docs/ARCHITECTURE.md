# Arquitetura de desenvolvimento

Atualização em 09/11/2026. A V2 organiza a interface por área e página. A main da V2 é a referência visual. A [publicação 83](BASELINE_REFERENCE_2026-10-26.md) é referência funcional histórica. Evidências e limites de ambiente ficam no [runbook](RUNBOOK.md) e no [roteiro de homologação](HOMOLOGACAO_PATRICIA.md).

Ler [Regras de produto](PRODUCT_RULES.md), [referência funcional publicação 83](BASELINE_REFERENCE_2026-10-26.md), [fichas](flows/README.md) e [roadmap](ROADMAP.md). Estrutura de código não aprova regra nova. A V2 é a base, o repositório oficial permanece somente leitura; uso do backend hospedado segue DEC-27.

## Bibliotecas escolhidas

Felipe definiu em 27/10: TanStack Form (`@tanstack/react-form`), Query (`@tanstack/react-query`) e Router (`@tanstack/react-router`), date-fns, Axios e Zod. Vite permanece o bundler; TanStack Router é a escolha de roteamento do projeto. React Router deixa de ser a proposta da V2. React 18 foi preservado.

Tailwind CSS 4.3.3 com `@tailwindcss/vite` 4.3.3 e `prettier-plugin-tailwindcss` 0.8.1 foi integrado em 28/10 (DEC-24). Bootstrap importa tokens e folha Tailwind uma vez; DS/features usam utilities `tw:` e aliases CALI, sem Preflight nesta coexistência. [Política e inventário de estilos](DESIGN_SYSTEM.md#política-de-css) definem migração por consumidor e limpeza final.

Versões são fixadas em package/lockfile; Node e npm estão documentados no [runbook](RUNBOOK.md). Escolha de versões foi conferida por documentação primária via Context7, peer dependencies e execução local. Não instalar biblioteca adicional por analogia nem criar abstração sem consumidor.

## Fronteiras e estado implementado

Fluxo atual de dados: **view → hook de consulta do módulo → service → adapter Supabase ou Axios/fixtures, selecionado na composição**. Zod valida filtros, datas e retorno; Query controla ciclo assíncrono/cache. Os caminhos virtuais do adapter são contrato interno dos mocks de desenvolvimento, não endpoints oficiais nem substitutos de RPC Supabase.

| Dono | Responsabilidade e estado |
| --- | --- |
| `src/main.tsx` | Bootstrap, validação do ambiente e composição dos serviços e controller |
| `src/app` | Router, providers, guardas, navegação e shell por área |
| `src/modules` | Páginas de Admin, Cliente, Partner, acesso e fluxos públicos |
| `src/components` | Componentes de produto usados por mais de uma página, agrupados pelo domínio |
| `src/components/ds` | Primitivas, controles e feedback com tokens CALI e variantes tipadas |
| `src/api/admin/companies` | Contratos, queries, composição e operações de empresas e acessos |
| `src/api/access` | Contratos e adapter de Auth, MFA, termos, Edge e sessão |
| `src/api/supabase.ts` | Cliente oficial com chave pública, namespace Auth próprio e refresh |
| `src/api/query-client.ts` | Configuração do QueryClient por instância do router |
| `src/mocks` | Dados e adapters sintéticos de desenvolvimento |
| `src/styles` | Tokens, folha Tailwind e base visual CALI |
| `src/lib/dates.ts` | Formatação de data civil com date-fns, preservando o dia informado |

Não criar árvores paralelas `data` e `hooks/api` para repetir a responsabilidade agora consolidada no módulo de API. Adaptador real futuro entra na fronteira do respectivo módulo, após contrato/autorização; essa mudança não transforma o frontend em backend nem exige proxy HTTP artificial.

## Organização das páginas

```text
src/
  app/
  modules/
    admin/
      overview/
        AdminOverview.tsx
        components/
      companies/
        CompaniesPage.tsx
        components/
    client/
      home/
        ClientOverview.tsx
        components/
      reports/
        ClientReportsPage.tsx
        components/
    partner/
      home/
    access/
      sign-in/
    public/
      disc/
      forms/
      proposals/
  components/
    ds/
    projects/
    reports/
    team/
    workspace/
  api/
    access/
    admin/
      companies/
      workspace/
    client/
      company/
    partner/
      pilot/
    shared/
      disc/
      notifications/
      team/
      workspace/
  mocks/
```

A página fica na raiz da sua pasta. Peças exclusivas ficam em `components/` da página. Componentes de produto usados por páginas diferentes ficam no `src/components` global. Primitivas independentes de domínio ficam em `src/components/ds`. Um módulo importa componentes compartilhados e contratos da API. Componentes compartilhados recebem a composição específica por props quando necessário, como nos relatórios de Admin e Cliente.

As rotas de Admin e Cliente usam o mesmo shell com dados locais ou conectados. Empresas usa o adapter de memória quando executada em modo demonstrativo. Os módulos sem serviço local mostram indisponibilidade ou retornam ao Início conforme a rota. Páginas, CSS e fixtures exclusivos das prévias foram retirados em 09/11.

## Organização dos módulos de API

```text
src/api/
  query-client.ts
  admin/companies/
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

## Ficha administrativa demonstrativa — 02/11

`administration-schemas.ts` possui vocabulários/contratos; `administration.ts` compõe transporte virtual dentro da capacidade existente, sem imports de mocks. Keys e hooks Query/mutation ficam no módulo de empresas. `src/mocks/adapters/company-administration.ts`, instanciado por adapter, possui os registros/revisões/eventos; ledger permanece no adapter de empresas. A nova projeção não estende artificialmente o DTO hospedado nem modifica plano/acessos da empresa.

`CompanyAdministration` controla consulta/edição e retorno de foco. `AdministrationEditor` compõe grupos/campos e ações; `useAdministrationEditor` guarda snapshot/requestId/rascunho. `AdministrationSummary` e `AdministrationHistory` apresentam dados, sem lógica de transporte. Configuração tipada de campos/labels fica local à feature e reutiliza vocabulários do schema; `Field` recebe controles nativos incluindo textarea. Valores do formulário são strings e transformados/validados explicitamente antes da mutation. Revisão antiga não é trocada por refetch de fundo; conflito mantém rascunho até descarte/reconsulta. Não foi criado context, dependência ou runtime novo. [Contrato e limites](contracts/ACCESS_COMPANIES.md#fase-2a--ficha-administrativa-demonstrativa).

## Dados cadastrais complementares — 03/11

`registration-schemas.ts` possui serviços/planos, valores, logo preparada, registros/revisões/comandos/eventos; tipos são inferidos. Transporte virtual em `registration.ts` compõe a capacidade existente; keys/hooks ficam no módulo de empresas. Estado de cadastro/histórico fica por instância em `mocks/adapters/company-registration.ts`, com o ledger já existente do adapter principal. Mapeamento de plano roda dentro do comando vencedor, sem tocar Auth ou ficha financeira. Não foi estendido o DTO hospedado com campos não verificados.

Feature separa `CompanyRegistrationData`, editor/hook, campos, resumo/histórico e logo. `CompanyField` compartilha controle/label/erro/ajuda entre cadastro e administração, sem importar hooks de formulário; binders continuam tipados por dono. `useLogoSelection` coordena preparo/cancelamento/gerações; `company-logo.ts` usa APIs nativas, limites da referência e rasterização SVG, sem dependência/runtime novo. Prévia é data URL validada em memória, não endereço de storage. Formulário guarda snapshot/revisão original durante refetch; histórico compara arrays/logos por conteúdo para evitar mudanças falsas. [Contrato e limites](contracts/ACCESS_COMPANIES.md#fase-2a--dados-cadastrais-complementares-demonstrativos).

## Tipagem e validação

Tipos ficam junto do dono: contratos de empresas em `src/api/admin/companies/schemas.ts`; props e modelos exclusivos de uma composição permanecem locais. Não criar uma pasta global `types` sem consumidores que justifiquem compartilhamento.

- Quando existe schema de runtime, inferir o tipo com `z.infer<typeof schema>`: `Company`, `CompanyAccess`, `CompanyFilters` e `CompanySearch`. Não repetir manualmente a mesma estrutura em uma interface que possa divergir do schema. Esses contratos são projeções locais de demonstração, não tipos do banco oficial.
- Para props/modelos locais sem validação externa, usar um `type` específico ou inferência quando a estrutura já estiver clara. Mensagens e comentários usam a identidade do item como chave de renderização.
- O vocabulário de variantes UI fica em `src/components/ds/variants.ts`: constante `UiVariant` com `Primary`/`Secondary` e tipo derivado. Componentes reutilizam o tipo quando a semântica coincide; consumidores podem usar strings tipadas no JSX, sem importar a constante de valores. Ver [design system](DESIGN_SYSTEM.md#vocabulário-compartilhado-de-variantes).
- Usar `as const` para constantes e tuplas de query keys. Para mapas conhecidos, usar anotação ou `satisfies Record<Chaves, Valor>`; `Record<Section, string>` é um mapa fechado legítimo. Não substituir um objeto de domínio por um dicionário genérico para evitar sua modelagem.
- `import type` e modificadores inline `type` separam tipos dos valores executados. A interface `Register` do router existe para ampliação de módulo do TanStack; essa necessidade não justifica duplicar os DTOs inferidos.
- Entrada bruta não ganha tipo confiável por cast. O service recebe respostas Axios como `unknown`, faz parse Zod e confere o vínculo da empresa antes do retorno. Configuração externa passa por `safeParse`. São exceções locais justificadas no lint, não tipos propagados ao domínio. O helper de teste aceita payload arbitrário para exercitar respostas inválidas.

O lint restringe `any`, `unknown` fora dessas entradas justificadas, casts de objetos/arrays literais e imports de tipo incorretos. `as const` continua permitido; as regras não proíbem toda assertion possível. TypeScript permanece `strict`; esta configuração não ativa o conjunto de regras ESLint com análise de tipos `no-unsafe-*`. Não alegar essa garantia. Regras/exceções completas estão no [runbook](RUNBOOK.md#regras-de-lint-implantadas).

## Contratos de acesso e laboratório local — 28/10

`src/api/access/schemas.ts` contém requests/respostas de workspace-access e projeções mínimas planejadas de perfil/aceite. `companies/records.ts` separa records de empresa/convite do DTO de demonstração. Schemas não habilitam Auth, transportes, guardas ou RLS; [contrato e lacunas](contracts/ACCESS_COMPANIES.md). Admin exige os dois passos em DEC-21.

DEC-22/25 usam Supabase local dedicado com serviços internal e proxy de loopback. `local-environment.ts` confere configuração; `local-database.ts` confere alvo/topologia e aplica somente baseline conhecida com journal/digest. `supabase/migrations/20261029090000_access_adhesion_baseline.sql` contém empresa/perfil/adesão, helpers privados e RLS; testes SQL e driver API/Auth provam esse recorte. Scripts de runtime são explícitos e não fazem parte do verify/CI comum. O recorte descrito neste histórico usou SPA demo; DEC-27 integra a SPA ao hospedado, sem reutilizar automaticamente o SQL do laboratório; [ambiente, comandos e limites](LOCAL_ENVIRONMENT.md).

## Código, termos e preparação de sessão — 29/10

`supabase/functions/workspace-access` é backend local: handler compartilha os schemas Zod de entrada, ports explícitos e adapter Edge com destinos internos fixos. `scripts/build-local-functions.ts` usa Vite para bundle autocontido ignorado; nenhum npm import é resolvido em execução na rede internal. O build está no verify sem Docker/rede/segredos; runtime e testes continuam comandos explícitos.

Migrations `20261029120000_codes_terms.sql` e `20261029123000_access_revocation.sql` adicionam códigos privados, serialização/uso único, versões/aceites imutáveis, estado de acesso e revogação. Runner aceita apenas lista revisada em ordem com journal/digest; não altera migrations já aplicadas. Schema de códigos é novo da V2, não recuperação do DDL ausente. [Contrato e limites](contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910).

`src/api/access/session.ts` é dono do contrato validado do estado/conteúdo corrente. `src/app/session/controller.ts` recebe fonte por injeção, controla cancelamento/gerações/cache e não guarda tokens. `guard.ts` decide por status/papel e saneia retorno; Router beforeLoad e assinatura no App têm consumidores reais nos testes. Nenhum context global foi adicionado. Fonte Auth/refresh/eventos e telas de acesso ainda não estão conectados; DEC-27 conecta adapter/telas e composição por ator real. `mock-admin` continua exclusivo da demonstração; a agregação hospedada não equivale à RPC/policies da baseline local.

## Mocks da aplicação e suporte exclusivo de testes

```text
src/mocks/
  http/client.ts             # Axios restrito ao adapter em memória
  adapters/companies.ts      # Simulação das operações de empresas
  fixtures/companies.ts      # Empresas/acessos usados pela aplicação
tests/
  fixtures/companies.ts      # Empresa ausente e acessos de outra empresa
  mocks/http.ts              # Respostas controladas para casos adversos
```

Fixtures são dados sintéticos; mocks simulam respostas/comportamentos. Código executado pela aplicação fica em `src/mocks`; arquivos usados exclusivamente por testes ficam em `tests/fixtures` ou `tests/mocks`. Testes de integração podem consumir os mocks da aplicação para exercitar a mesma composição, sem copiar suas fixtures. Cenários de erro específicos usam os dados/adapters exclusivos dos testes. Spies locais de uma única asserção permanecem no próprio teste.

A aplicação nunca importa `tests`. Em módulos, componentes compartilhados e DS, imports de mocks também são bloqueados; no módulo de API, apenas `api.ts` seleciona a implementação mock. Schemas, services e hooks não importam fixtures/adapters diretamente. ESLint verifica essas fronteiras.

O nome `demo` continua nas variáveis de configuração e nos textos que identificam o modo demonstrativo; não é uma pasta nem um segundo mecanismo de dados. Integração futura substitui a composição do serviço por transporte real após contrato/ambiente autorizados. Mocks de desenvolvimento só permanecem em um modo explícito; sua remoção da execução normal não elimina os cenários necessários aos testes. Não importar `tests` no runtime nem tratar mock como autorização de servidor.

## Navegação e continuidade

TanStack Router usa árvore definida em código, sem plugin de geração de rotas. `src/app/navigation.ts` é o catálogo de caminhos; as rotas pai de Cliente e Admin mantêm o shell entre páginas filhas. Cada rota folha referencia o módulo da página correspondente.

`/admin/clientes` já possui busca, situação e empresa selecionada na URL com validação Zod; formulário TanStack mantém rascunho e aplica filtros por submit. Back/Forward restaura lista/formulário; acesso por link direto consulta o detalhe independentemente da lista.

A tela de empresas é carregada sob demanda. Bootstrap/provider/router não são fonte de autorização; o modo local usa os serviços sintéticos disponíveis. Há erro de configuração e rota não encontrada, sem login fictício tratado como sessão real.

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

Páginas e componentes não importam SDK ou transporte direto. O DS não depende de app, módulos ou API. O lint verifica as fronteiras e roda sobre todas as páginas atuais. Ver escopo e comandos no runbook.

Não transportar runtimes DOM como arquitetura definitiva. Por operação, localizar evento, permissão, transição e efeito; mover regra para domínio/adaptador e interação para componente/hook com prova de paridade. Proposta não é implementada só porque sua pasta aparece no mapa.

Referências primárias consultadas: [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/guide/code-based-routing), [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [TanStack Form](https://tanstack.com/form/latest/docs/framework/react/guides/validation), [Axios](https://axios-http.com/docs/req_config), [Zod](https://zod.dev/api) e [date-fns](https://date-fns.org/docs/parseISO).

## Arquivos contratuais — 03/11

`document-schemas.ts`, `document-files.ts` e `documents.ts` pertencem ao módulo companies; a capacidade `management.documents` é exclusivamente demonstrativa. `company-documents.ts` guarda bytes e versões por instância; o adapter principal coordena ledger e vínculo com empresa. DTOs/Query cache carregam somente metadados. FormData e Blob usam APIs nativas, sem dependência ou contexto novos. `CompanyContractDocuments`, formulário/hook, lista, retirada e histórico têm tarefas separadas; `useDocumentDownload` limita URLs ao download explícito e limpa resultados tardios. [Contrato](contracts/ACCESS_COMPANIES.md#fase-2a--contratos-e-aditivos-demonstrativos).

## Comprovação administrativa — 03/11

`evidence-schemas.ts` e `evidence.ts` definem contratos/transportes exclusivos de `management.evidence` demonstrativo. `adhesion-evidence.ts` deriva vigência do snapshot imutável, retirada e versão documental corrente. Adapter principal aplica gate de acesso junto do limite/preimagem/ledger; nenhuma condição exclusivamente visual autoriza o comando. Referência DEC-23, termos individuais e arquivos mantêm donos independentes.

Feature separa `AdhesionReferenceForm`, `AdhesionEvidencePanel`, formulário/hook, lista/histórico e retirada. Checkbox se invalida quando conteúdo conferido muda; queries de empresa/ator são invalidadas após confirmação de mutation. Hospedado permanece sem `management`, sem novo contexto ou dependência. [Contrato](contracts/ACCESS_COMPANIES.md#fase-2a--comprovação-administrativa-da-adesão).

## Consulta Cliente conectada — 03/11

ClientEntry escolhe composição pela existência do controller de sessão; ConnectedClientWorkspace usa layout compartilhado e Outlet, com filhos reais de Início, empresa e termos. Títulos/destinos de módulos pendentes permanecem identificáveis por URL. WorkspaceLayout recebe navegação contextual, permite quebra de linha e move foco ao título quando a página muda; efeito estritamente local de foco permanece no dono da apresentação.

`CompaniesService.account` possui projeção mínima própria, validada por companyAccountSchema e companyIdentityRecordSchema. `identity.ts` compartilha o GET hospedado de identidade entre acesso e empresas; SDK/banco continuam na fronteira de dados. `useClientCompany` deriva ator/vínculo da sessão, separa cache de detalhe Admin e não aceita seleção por URL. Revalidação não reabre leitor de identidade anterior. TermsContent é peça de domínio reutilizada por aceite e consulta, sem novo contexto, dependência ou operação de escrita. [Contrato/limites](contracts/ACCESS_COMPANIES.md#cliente-2a--consulta-conectada-da-própria-empresa).

## DISC V2

`src/api/shared/disc` concentra schemas, serviços e hooks. Os módulos separam questionário público, avaliador Admin e gestão. O conteúdo narrativo e renderer PDF são exclusivos do servidor. `cali_v2_disc` guarda campanhas, respostas, fila, eventos e revisões congeladas, com wrappers por público. O worker autenticado constrói anexos em memória e revalida documento antes da resposta; WebP usa WASM incorporado. `pdf-lib` 1.17.1 e `@jsquash/webp` 1.5.0 atendem geração de PDF e compatibilidade da foto já existente; não trocam stack da SPA. [Contrato](contracts/DISC_3.md).

A agenda preparada usa `pg_cron` para chamar `kick()` e `pg_net` para transporte fixo ao worker. Vault fornece o JWT de serviço; hook privado e flag controlam a autorização de execução. Despertares são agrupados em intervalo mínimo de um minuto; reserva usa `SKIP LOCKED`, tentativas e idempotência já existentes. Relógio ajustável existe somente em função privada para provas descartáveis. Não há componente, contexto ou acesso do frontend a credenciais da agenda. O incremento está instalado no CALI MAPA e o cron segue desligado.
