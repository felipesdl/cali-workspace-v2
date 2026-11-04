# Operação local e verificação

Atualização: 01/11/2026. Fase 1 iniciada na branch local `codex/fase-1-base`, a partir de `main` `c9baea7`. O pacote está em revisão no [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) em rascunho, conforme solicitação de 27/10; o acompanhamento de concluído/pendente fica no [roadmap](ROADMAP.md#acompanhamento-da-fase-1--pacote-para-revisão). Commits/push/PR são etapas de revisão distintas de merge/deploy. DEC-27 autoriza integração ao backend hospedado e fixtures sintéticas identificadas; não houve publicação da aplicação.

## Suspensão do laboratório de acesso — 02/11

A bateria de sessão/revogação permanece suspensa por solicitação de Felipe. Não executar `local:access:test`, o runner experimental anterior ou iniciar Edge/laboratório nesta continuidade. O Edge V2 agora exige consumo/admissão de sessão no servidor; SQLs complementares estão somente em `supabase/proposals/session-cut`, sem aplicação. Antes de uma futura retomada autorizada, reconciliar schema, drivers e protocolo; não aplicar propostas por conveniência. [Contrato e limites](contracts/ACCESS_COMPANIES.md#correção-local-da-troca-e-admissão--0211).

`npm run verify` segue autorizado e sem Docker/rede/SQL: seus unitários não substituem essa validação suspensa. O driver experimental anterior foi preservado como texto em `output/runtime/session-cut/history`, ignorado pelo Git.

Na demonstração da 2A, selecionar uma empresa e usar **Editar ficha administrativa** para contrato, financeiro e referências documentais. Preencher somente dados sintéticos, salvar e conferir revisão/histórico; testar cancelamento, troca de empresa e erro mantendo rascunho. URL documental é somente texto; salvar não abre arquivo, cobra, envia aviso ou muda acesso/plano. Reload descarta a ficha. A operação não está disponível no hospedado; [limites do contrato](contracts/ACCESS_COMPANIES.md#fase-2a--ficha-administrativa-demonstrativa).

Para os dados restantes, na demo selecionar a empresa e **Editar cadastro da empresa**: serviço/horas/segmento, endereço/filiais e contato comercial sintéticos. Preparar uma logo local, conferir prévia e salvar; conferir plano correspondente na lista e revisão/histórico. Cancelar/remoção no rascunho não grava. Filiais ficam vazias ao salvar a opção Não. Logo usa até 12 MB de entrada e até 1200 px/700 KB preparada, sem upload; SVG é rasterizado. Reload descarta tudo. Não usar dados pessoais reais nem habilitar no hospedado; não iniciar a bateria suspensa.

## Demonstração da 2A — cadastro, adesão e acessos

A jornada nova é somente em memória. Para revisar a interface sem usar a configuração hospedada, iniciar explicitamente o frontend demo:

```bash
VITE_DATA_MODE=demo VITE_DEMO_MODE=true VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_API_URL= npm run dev -- --host 127.0.0.1 --port 5193 --strictPort
```

Em `/admin/clientes`, cadastrar uma identidade sintética; a ficha abre sem acessos. Registrar referência de formalização sintética e autorizar até quatro acessos com e-mails `example.test`. O quinto é recusado; revogar um libera uma vaga sem remover registro/histórico; reautorizar exige vaga e referência. Edição de nome não troca e-mail. As solicitações virtuais têm proteção de repetição; não enviam convites nem operam Auth.

Recarregar descarta empresas/referências/autorizações/eventos desta instância; não há persistência local ou remota nova. No modo hospedado, esses formulários não são oferecidos, sem fallback para demo. [Contrato do recorte](contracts/ACCESS_COMPANIES.md#fase-2a--cadastro-adesão-e-quatro-acessos-demonstrativos). Essa revisão de frontend não inicia Edge, Docker ou a bateria suspensa.

## Execução conectada e comparação

Configuração e atores sintéticos estão em [Ambiente hospedado](LOCAL_ENVIRONMENT.md#backend-hospedado--dec-27). `.env` e arquivos `*.env` ficam ignorados. Nunca enviar chaves privadas/service role ao Vite; o schema aceita somente URL hospedada HTTPS e chave `sb_publishable_`, sem fallback de configuração inválida para mocks. `demo` mantém a composição de fixtures quando não há backend configurado.

O SDK mantém sessão/refresh em namespace exclusivo; login/MFA/aceite acontecem pela UI. Não usar código de console para registrar aceite nem pedir tokens por chat. Callback PKCE está implementado, mas configuração/caminho de callback bem-sucedido ainda exigem prova. No modo conectado, apenas os módulos integrados mostram dados reais; demais módulos não exibem estatísticas fictícias.

`npm run verify` continua sem conexão de runtime, Docker, migrations ou envio de e-mail. O build pode incorporar URL/chave pública configuradas, como esperado para cliente Supabase; não distribuir artefato nem considerar build autorização de deploy. Scripts `local:*` continuam restritos ao laboratório e recusam o `.env` hospedado no preflight; não relaxar essas guardas para iniciar o laboratório.

Após alterar a interface do controller durante desenvolvimento, uma instância antiga preservada pelo hot reload pode exigir uma atualização da aba. Isso foi observado/corrigido no teste de 01/11; não adicionar reload automático como tratamento de erro do produto.

## QA manual de sessão Cliente A/B

Usar abas locais separadas (5181 para A, 5182 para B), mesmo checkout/backend e sessões por origem, preservando o Admin em 5173. Isso não cria outro banco/ambiente. Não reenviar código apenas porque a aba mudou de foco: a etapa deve permanecer montada durante revalidação. Recebimento de código, login e aceite são passos distintos, concluídos pelo próprio usuário.

`/scripts/hosted-access-probe.ts` é módulo manual importado pelo DevTools da aba de teste; não integra a SPA nem autentica/renova a sessão. `prepareFixtureProbe` exige UUIDs dos dois perfis/empresas sintéticos, confirma sessão Cliente ativa, vínculo e marcador da própria empresa antes de testar. Só aceita as duas origens locais dedicadas. Saída contém HTTP/contagens/flags, nunca tokens, códigos ou corpo Auth integral.

- `read('active')`: Auth, próprio perfil/empresa, perfil/empresa do outro ator, lista visível e convites da outra empresa. Resultado vazio ou negado deve ser avaliado por operação; HTTP 200 sozinho não comprova isolamento.
- `readFiles()`: GET sem cache do PDF próprio e do PDF da outra fixture. Registra status, correspondência do SHA-256 e cabeçalhos de cache disponíveis, sem mostrar bytes ou tokens. `readFiles('default')` repete as mesmas URLs com o cache normal do navegador.
- `read('revoked')` / `read('restored')`: repetir com o JWT retido em memória durante inativação/recomposição exclusivamente da fixture. Registrar separadamente guarda da SPA, permissão do banco e eventual recuperação do JWT antigo. Não alterar company_id, papel ou contas existentes.
- `captureBeforeLogout()`: captura a credencial corrente apenas em memória e informa a expiração. Depois do logout pela UI, `read('after_logout')` verifica o JWT anterior; `verifyRefreshRevoked()` exige armazenamento local vazio e tenta o refresh anterior uma vez. Se o servidor emitir sessão inesperadamente, a ferramenta tenta encerrá-la e reporta essa limpeza, sem persisti-la.
- `read('expired')`: somente depois do `exp` real do token retido. Não mudar relógio, assinatura ou TTL global para fabricar prova de expiração; negativa por assinatura inválida não é negativa por prazo. Ausência dessa execução permanece pendência explícita.
- `forget()`: descarta referências às credenciais na ferramenta. Não imprimir o objeto de sessão nem persistir arquivos com credenciais para repetir provas.

O módulo não aplica SQL/policies nem transforma HTTP negado em permissão. Resultados hospedados devem ser registrados no changelog/roadmap após execução; testes de fixture/controller não os substituem. Logout Supabase pode deixar JWT válido até `exp`; guardas/policies devem ser verificadas com a credencial anterior, sem confundir logout visual com recusa imediata no banco.

### Aceite vigente e arquivos da fase 2A

As empresas marcadas `CALI_V2_TEST_A_20261101` e `CALI_V2_TEST_B_20261101` têm um Cliente e um convite ativos cada. O bucket privado contém os PDFs sintéticos `documents/<empresa-A>/qa-aceite-2a-a.pdf` e `documents/<empresa-B>/qa-aceite-2a-b.pdf`. Os dois GETs anônimos foram negados. Consultar os UUIDs da fixture no catálogo por marcador.

1. Abrir `http://127.0.0.1:5181/cliente` e `http://127.0.0.1:5182/cliente`. Entrar apenas com os destinatários de teste já autorizados. Confirmar no banco que ambos têm sessão admitida e empresa gerenciada antes da prova de bloqueio do Storage.
2. Antes do aceite, consultar o texto na tela e executar `readFiles()` em ambas as abas. Esperar recusa de arquivo próprio e alheio. Aceitar em A, repetir as duas leituras e confirmar que só A baixa seu próprio PDF. Aceitar em B e conferir a mesma fronteira para B.
3. Abrir os arquivos com cache normal usando `readFiles('default')`. Revogar A pela gestão Admin e recarregar a aba de A. Conferir o bloqueio na tela. Repetir as leituras com e sem cache usando apenas a sessão corrente de cada aba. Se a sessão de A já foi encerrada, registrar o bloqueio na tela e a continuidade do download de B. Bytes indevidos servidos pelo cache mantêm a homologação pendente. Verificar previamente se havia links já emitidos para o recorte.
4. Reativar A, entrar pelo fluxo de código e confirmar o download do PDF próprio na nova sessão. Testar rotação da versão na cópia isolada. No destino, usar somente texto oficial aprovado e registrar o resultado efetivo.

A [ativação da política](../supabase/proposals/hosted-terms/activate-storage.sql) exige admissão e corte instalados. Antes de [reverter a política](../supabase/proposals/hosted-terms/rollback-storage.sql), retirar a disponibilidade dos arquivos do recorte e verificar links/cache no destino. O [rollback da publicação](../supabase/proposals/hosted-terms/rollback.sql) mantém recibos e confirmações.

### Piloto de admissão A/B

O CALI MAPA já tem um convite ativo por empresa A/B. O e-mail coincide com o perfil e a conta Auth. O piloto fixa os dois vínculos no cadastro privado e verifica essa correspondência antes de cada emissão. A conta recebe código somente após solicitar acesso na aba de teste.

1. Vincular os rascunhos às empresas existentes, comprovar adesão com versão de documento válida e conferir os escritores legados do recorte. Os dois PDFs de download não substituem a comprovação.
2. Revisar [base](../supabase/proposals/hosted-access-pilot/base.sql), [códigos](../supabase/proposals/hosted-access-pilot/codes.sql) e guarda de arquivos. Instalar com o cadastro privado vazio. O helper `current_company_id()` preserva a definição original fora do piloto e passa a negar sessões A/B sem admissão. O script interrompe a aplicação se a definição prévia divergir do catálogo revisado.
3. Preparar `workspace-access-pilot` no CALI MAPA. O painel confirmou `RESEND_API_KEY` configurada. Definir remetente verificado `CALI_PILOT_EMAIL_FROM` e segredo dedicado `CALI_PILOT_CODE_SECRET` no painel de segredos. O código usa a [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email) e uma chave de idempotência por solicitação. O build local passou. Entrega hospedada ainda pendente.
4. Com os gates anteriores conferidos, executar o [cadastro A/B](../supabase/proposals/hosted-access-pilot/enroll.sql). Abrir as abas locais nas portas `5181` e `5182` com `VITE_CALI_PILOT_ACCESS=true`. O fluxo exige a sessão devolvida pela Edge piloto. Fazer uma rodada de login com os dois destinatários, confirmar aceite e leitura, revogar A como Admin e verificar a continuidade de B.
5. Para suspender, aplicar [pause.sql](../supabase/proposals/hosted-access-pilot/pause.sql) e retirar a função piloto da homologação. A suspensão recusa novos códigos e sessões já admitidas de A/B. Recibos e histórico técnico são preservados.

## Candidata de corte no servidor — sem execução

[Contrato e sequência de revisão](contracts/ACCESS_COMPANIES.md#correção-do-corte-no-servidor--candidata-não-aplicada). `supabase/proposals/session-cut` contém catálogo somente leitura, candidata e aceite SQL futuro. Não é migration nem comando npm; runner local conserva a lista fechada das três migrations do laboratório. Nada foi aplicado ou executado em banco nesta preparação.

Não executar candidate/acceptance como diagnóstico. A candidata exige opt-in de revisão `cali.session_cut_review=reviewed-v1` e owner postgres com bypass; esse opt-in não é autorização de aplicação. Suíte exige `cali.session_cut_test=isolated-only` e configurações UUID `cali.qa.a_profile`, `cali.qa.a_session`, `cali.qa.b_profile`, `cali.qa.b_session`, nunca JWT/e-mail. Usar somente cópia isolada com outbound bloqueado e executor que aborte no primeiro erro; rollback SQL não desfaz efeitos externos de triggers. Catálogo revisado, suíte SQL/Auth real e autorização de aplicação continuam pendentes.

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

Baseline mínima de empresa/perfil/adesão aplicada pelo runner; SQL com rollback e driver API/Auth/TOTP passaram, assim como captura local e negativas de rede. Digests de proxy/compose e journal da baseline bloqueiam divergência/reaplicação acidental. Comandos de runtime são explícitos e ficam fora de `verify`/CI comum. O build do bundle Edge integra verify, sem iniciar serviços; gerar antes de subir o sexto serviço (Edge Runtime). Driver API preserva fixtures sintéticas locais; não apaga histórico. A composição do laboratório continua sem integração à SPA; DEC-27 conecta a SPA ao hospedado por adapter próprio. Contratos, lacunas e limites de comprovação documental: [Acesso/empresas](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910).

## CI configurada

`.github/workflows/verify.yml` define instalação/verificação em pull requests e push na main, com permissão somente de leitura e sem deploy/segredos operacionais. O workflow foi enviado no PR #2. Na consulta registrada para a revisão `abec452`, GitHub não reportou checks ou execuções de Actions; a validação remota continua pendente, sem inferir a causa pela ausência de execução. Referências: [checkout](https://github.com/actions/checkout) e [setup-node](https://github.com/actions/setup-node).

## Validação e limites

Executar `npm run verify` para conferir o conjunto atual. Testes de mocks/adapters locais não certificam Supabase, envio de e-mail, Calendar/Meet/Drive ou sessão real. QA de navegador deve registrar revisão e viewport, incluindo o comportamento da tela empresas; não extrapolar esse resultado para todas as prévias.

Retomar contratos de acesso/empresa e ambiente isolado antes da primeira conexão de teste real. O oficial é somente leitura. Não iniciar migrations, outbound, deploy ou sincronização com produção como consequência de um build verde.
