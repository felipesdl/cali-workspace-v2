# Operação local e verificação

Atualização: 29/10/2026. Fase 1 iniciada na branch local `codex/fase-1-base`, a partir de `main` `c9baea7`. O pacote está em revisão no [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) em rascunho, conforme solicitação de 27/10; o acompanhamento de concluído/pendente fica no [roadmap](ROADMAP.md#acompanhamento-da-fase-1--pacote-para-revisão). Commits/push/PR são etapas de revisão distintas de merge/deploy. Sem conexão ao Supabase oficial ou publicação da aplicação.

## Runtime e instalação

Node `24.22.1` em `.nvmrc`; npm `11.19.1` em `packageManager`. `engines`/`.npmrc` recusam runtime incompatível. Dependências diretas são fixas e a resolução completa está em `package-lock.json`.

```bash
nvm use
npm ci --ignore-scripts --no-fund
npm run verify
npm run dev -- --host 127.0.0.1
```

`nvm` é opcional se Node/npm compatíveis já estiverem selecionados. Scripts de instalação de dependências não são necessários para a instalação/build verificados nesta máquina; CI usa o mesmo modo. Não reutilizar node_modules de outro projeto.

## Comandos implementados

| Script | O que executa |
| --- | --- |
| `dev` | Vite local; usar URL/porta efetivamente informadas |
| `typecheck` | TypeScript sem emissão, incluindo app, testes e configs |
| `lint` | ESLint, hooks React e fronteiras DS/features/API; falha com warnings |
| `format` / `format:check` | Prettier para código/configuração do escopo atual |
| `test` / `test:watch` | Vitest e cenários de configuração, transporte mock, contratos/cache, datas e navegação/formulário |
| `docs:check` | Links/âncoras locais e fechamento de blocos de código em README/AGENTS/docs |
| `build` | TypeScript e Vite; artefatos em dist |
| `preview` | Servidor local do build; não publica nem comprova hosting |
| `local:config:check` | Integridade da configuração versionada do laboratório; sem Docker, CLI ou banco |
| `local:preflight` | Preparação em leitura, antes do proxy: vínculo/overrides, versões, rede e portas livres |
| `local:db:inspect` | Alvo/topologia ativos, proxy e digests de configuração, sem SQL de negócio |
| `local:db:apply` | Lista revisada de migrations locais em ordem, transações/journal/digest; não executa SQL desconhecido nem reset |
| `local:db:test` | Suítes SQL de adesão, códigos/termos, grants e imutabilidade; fixtures com rollback |
| `local:functions:build` | Vite gera bundle Edge autocontido, sem Docker/rede/segredos; integra verify |
| `local:access:test` | Código/Mailpit/Auth, concorrência, versões/aceites, RLS e revogação reais locais; fixtures persistentes |
| `local:isolation:test` | Controle interno e negativas de IP externo/canário próprio do host por serviço |
| `local:adhesion:test` | Driver API/Auth/TOTP local; cria fixtures sintéticas persistentes, não inicia o frontend |
| `local:mail:test` | Mensagem sintética no SMTP local e conferência da captura Mailpit |
| `verify` | Format check, lint, typecheck, testes, local config check, docs check e build |

Formatação exclui Markdown e TSX/CSS legados explicitados em `.prettierignore`. As oito composições de prévia enumeradas no ESLint mantêm exceção de variáveis/imports não usados; regras de hooks continuam ativas. Não chamar isso de normalização integral do legado. Ao migrar uma feature, remover sua exceção e validar no mesmo recorte.

## Estilos e formatação

Tailwind 4.3.3 e plugin Vite 4.3.3 são dependências de desenvolvimento fixas; Prettier usa `prettier-plugin-tailwindcss` 0.8.1 e `tailwindStylesheet: ./src/styles/tailwind.css`. Executar `npm run format` após alterar classes. Tema/utilities usam prefixo `tw:`, sem Preflight/cascade layers durante a coexistência; tokens e breakpoints ficam na folha canônica, sem configuração JS paralela. [Política, consumidores migrados e inventário restante](DESIGN_SYSTEM.md#política-de-css).

Não eliminar CSS compartilhado enquanto houver consumidores legados. Cada recorte confere desktop/mobile, foco/teclado e estados reais; a limpeza final revisa a base global somente após migrar todos os consumidores.

## Regras de lint implantadas

Configuração canônica: `eslint.config.js`; `npm run lint` usa `--max-warnings=0`. Sem dependências novas para esta revisão.

| Regra/grupo | Restrição efetiva |
| --- | --- |
| JS/TypeScript recomendados | Erros estáticos básicos; TypeScript também passa pelo typecheck separado |
| `@typescript-eslint/no-explicit-any` | Erro em código e testes, sem liberação geral para testes |
| `@typescript-eslint/consistent-type-imports` | Imports usados somente como tipo recebem `type`; fix inline para imports nomeados |
| `@typescript-eslint/consistent-type-assertions` | Estilo `as`; sem casts de objetos/arrays literais para simular contrato; `as const` permitido |
| `@typescript-eslint/no-unused-vars` | Variáveis/imports não usados; argumento ignorado pode começar com `_`; oito arquivos legados têm exceção enumerada |
| `no-alert` | Sem alert/confirm/prompt nativos nas áreas verificadas |
| `no-restricted-syntax` | `unknown` exige exceção local justificada; bloqueia chamadas diretas `window.location.reload()`/`location.reload()` e keys por identificadores `i`/`idx`/`index`, diretos ou interpolados; strings na prop `variant` são permitidas, com valores aceitos definidos pelo tipo compartilhado do DS |
| Hooks React recomendados | Regras de hooks e dependências de effects; warnings também interrompem o gate |
| React Refresh | Exports de componentes compatíveis com atualização durante desenvolvimento |
| `no-restricted-imports` | Aplicação não importa testes; DS não importa domínio/infraestrutura; features não importam transporte/service/mocks; API não importa UI e somente composição seleciona mocks |

Exceções de `unknown` são cinco linhas com justificativa: três respostas brutas no service de empresas, a entrada de configuração e o payload deliberadamente arbitrário do helper `tests/mocks/http.ts`. Cada fronteira de aplicação valida a entrada antes de expô-la. Não remover validação nem espalhar `unknown` por tipos de negócio para satisfazer o lint. Exceção não libera o arquivo inteiro.

Keys antigas por índice foram corrigidas: coleções estáticas usam identidade dos dados; comentários/mensagens locais recebem IDs na criação. Integrações futuras devem usar identificadores persistidos; nomes/composições de fixtures não definem contrato de identidade do backend. Não houve exceção nova para keys ou casts do legado.

As restrições sintáticas reconhecem os padrões descritos; não detectam toda forma indireta/alias equivalente nem substituem revisão. `tests/lint.test.ts` exercita exemplos permitidos/negados contra a configuração real, incluindo fronteiras. ESLint não usa aqui análise de tipos `no-unsafe-*`; `tsc` continua `strict`, com unused delegado ao lint por causa das exceções legadas.

## Configuração e fronteira de dados

`.env.example` contém `VITE_DATA_MODE=demo` e `VITE_DEMO_MODE=true`. O bootstrap agora consome/valida a configuração com Zod. Modo não demonstrativo, flag false ou URL de API/Supabase preenchida resulta em erro de configuração, sem fallback de produção. Não copiar chaves reais para VITE_: configurações expostas ao navegador são públicas.

O cliente Axios de `src/mocks/http/client.ts`, selecionado na composição do módulo empresas, exige adapter em memória; recusa URL absoluta, baseURL diferente, caminho fora do prefixo local e substituição de adapter. Não existe backend HTTP demo ouvindo uma porta. Os endpoints virtuais não representam contratos oficiais. Não há SDK Supabase, autenticação, convites ou gravação real.

Empresas e acessos usam dados sintéticos; o ator `mock-admin` não é sessão autenticada. O módulo demonstra leitura/filtros/keys e validação, não RLS, revogação real ou limite de convites imposto no banco. Contratos de login/contas ausentes e configuração isolada continuam no [registro](DECISIONS.md).

Fontes/imagens externas do protótipo permanecem nos seus consumidores; são distintas da API do produto. Não afirmar que a aplicação inteira funciona offline ou sem qualquer recurso externo.

## Organização dos mocks

Mocks executados pela aplicação ficam em `src/mocks`: adapters, fixtures de empresas/avisos e cliente Axios sem rede. `tests/fixtures` contém cenários exclusivos de teste; `tests/mocks` contém adapters de resposta controlada. Testes de integração podem reutilizar mocks de `src`; o caminho inverso é proibido pelo lint. Não duplicar dados da aplicação apenas para preencher uma pasta de testes. Detalhes e árvore atual estão na [arquitetura](ARCHITECTURE.md#mocks-da-aplicação-e-suporte-exclusivo-de-testes).

As variáveis `VITE_DATA_MODE=demo` e `VITE_DEMO_MODE=true` continuam identificando o modo demonstrativo, agora organizado como mocks; não houve alteração do contrato de configuração nem habilitação de backend.

## Laboratório local executado em 29/10

Ler [Ambiente isolado](LOCAL_ENVIRONMENT.md) para bootstrap/parada reproduzíveis. CLI 2.122.0 foi usado em diretório temporário com checksum conferido. Serviços de negócio ficam somente na rede internal; proxy dedicado publica quatro portas em loopback, com destinos fixos/forwarding desligado. Primeiro bootstrap exclui PostgREST até criar o schema, sem ignorar healthcheck. Migrations/seeds automáticos de negócio continuam desabilitados; o CLI/Auth fazem seu bootstrap interno, distinto dos SQLs oficiais, que não foram executados.

Baseline mínima de empresa/perfil/adesão aplicada pelo runner; SQL com rollback e driver API/Auth/TOTP passaram, assim como captura local e negativas de rede. Digests de proxy/compose e journal da baseline bloqueiam divergência/reaplicação acidental. Comandos de runtime são explícitos e ficam fora de `verify`/CI comum. O build do bundle Edge integra verify, sem iniciar serviços; gerar antes de subir o sexto serviço (Edge Runtime). Driver API preserva fixtures sintéticas locais; não apaga histórico. O frontend permanece somente com mocks. Contratos, lacunas e limites de comprovação documental: [Acesso/empresas](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910).

## CI configurada

`.github/workflows/verify.yml` define instalação/verificação em pull requests e push na main, com permissão somente de leitura e sem deploy/segredos operacionais. O workflow foi enviado no PR #2. Na consulta registrada para a revisão `abec452`, GitHub não reportou checks ou execuções de Actions; a validação remota continua pendente, sem inferir a causa pela ausência de execução. Referências: [checkout](https://github.com/actions/checkout) e [setup-node](https://github.com/actions/setup-node).

## Validação e limites

Executar `npm run verify` para conferir o conjunto atual. Testes de mocks/adapters locais não certificam Supabase, envio de e-mail, Calendar/Meet/Drive ou sessão real. QA de navegador deve registrar revisão e viewport, incluindo o comportamento da tela empresas; não extrapolar esse resultado para todas as prévias.

Retomar contratos de acesso/empresa e ambiente isolado antes da primeira conexão de teste real. O oficial é somente leitura. Não iniciar migrations, outbound, deploy ou sincronização com produção como consequência de um build verde.
