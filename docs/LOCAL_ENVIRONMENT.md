# Ambiente isolado da fase 1

Atualização: 01/11/2026. **DEC-27 autoriza a continuidade no backend hospedado existente, ainda não lançado, com atores e dados sintéticos identificados.** A V2 local possui adapter Auth/empresas e telas de código, MFA, termos e callback. O laboratório descrito abaixo permanece como evidência histórica e opção de teste, sem que suas migrations tenham sido aplicadas no hospedado. Não houve deploy da aplicação.

## Backend hospedado — DEC-27

- Configuração local fica em `.env`, ignorado pelo Git, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Sem modo explícito, a presença de ambos seleciona Supabase. `demo` é composição com fixtures, não outro projeto hospedado; configuração parcial/contraditória ou chave privilegiada é rejeitada, sem fallback.
- Somente chave pública no frontend. Sessão pertence ao namespace `cali-v2-<project-ref>-auth`, separado da referência online e de outros aplicativos. Login pela V2 é necessário; não copiar tokens do navegador para arquivos/chat nem importar a sessão do oficial automaticamente.
- Auth usa o SDK oficial 2.118.0; códigos usam a Edge existente `workspace-access`, sem deploy de função nova. A origem localhost está prevista no código consultado; entrega efetiva e cada transição precisam de teste. Cadastro Auth do Cliente ocorre na primeira solicitação de código elegível, não ao inserir um convite.
- Duas empresas `[TESTE V2] Empresa A/B` foram criadas por POST (HTTP 201), com marcadores `CALI_V2_TEST_A_20261101` / `CALI_V2_TEST_B_20261101` em `notes` e automações de empresa desabilitadas. Dois vínculos foram criados inicialmente inativos (201) e ativados (PATCH 200 + GET de confirmação) após aprovação específica de Felipe. Destinatários foram fornecidos na sessão e não são versionados. Nenhum perfil/vínculo preexistente foi alterado; solicitação de código posterior retornou 200 para A/B, com perfil Cliente ativo/vinculado confirmado por GET. Sessão Admin ficou inalterada. A rodada A/B abaixo registra a verificação posterior de login/aceite e isolamento no recorte consultado.
- Preparação é fixture autorizada, não comprovação de adesão jurídica real ou implementação do cadastro completo de 2A. Sem assinatura, aceite ou data de adesão fictícios. Não executar expurgo/reset para repetir testes; consultar marcador/vínculo antes de criar e parar em colisão.
- Na rodada de 01/11, o catálogo OpenAPI retornou 401 enquanto as leituras autenticadas de usuário, perfil e empresas funcionaram. A aplicação hospedada da publicação de aceite em 04/11 está registrada abaixo.
- Para repetir testes, usar a V2 local (`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`), os atores aprovados e a própria interface. Evitar disparos repetidos de código: a Edge limita a 120 segundos. Nunca imprimir código, token, segredo MFA ou resposta Auth integral.

### Comparação da V2 local com o online

O online é referência funcional, não o artefato deste PR. Comparar o mesmo ator/empresa e os mesmos registros; sessão em cada origem é independente. A V2 apresenta acesso real e leitura de empresas no novo shell; módulos ainda não integrados ficam em preparação, sem métricas sintéticas no modo conectado. O modo demo preserva a navegação legada para inventário/migração. Diferença planejada de cobertura não é paridade comprovada nem regressão por si só.

O usuário concluiu login Admin e aceite pela V2; a lista conectada mostrou quatro empresas, busca `[TESTE V2]` mostrou duas, detalhe de A mostrou um vínculo do destinatário esperado e limpeza restaurou quatro. Comparação por nomes no DOM confirmou o mesmo conjunto de quatro empresas. Layout conferido em 1440 e 390 px; em 390, documento permaneceu com 390 px e tabela em região horizontal própria. Online mostrou as mesmas quatro empresas; o contador legado de acessos soma um principal fixo, divergência rastreada em FLOW-02. Sem erros/warnings no console da página após a correção/atualização. A rodada A/B abaixo acrescenta provas próprias de Cliente/logout/inativação; callback válido e refresh/expiração da SPA ativa ainda permanecem pendentes. Escopo atual do teste anterior: próprio perfil Admin e amostra de empresas, HTTP 200, AAL2 e token inalterado em 31/10.

### Rodada Cliente A/B — 01/11

Duas instâncias da mesma revisão local usam origens `127.0.0.1:5181` e `:5182`, separando armazenamento Auth; Admin permanece em `:5173`. O usuário concluiu código e aceite dos dois Clientes pelas telas. Consultas diretas usaram JWT original, projeções mínimas e `cache: no-store`, sem exportar credenciais. Ferramenta/manual em [Runbook](RUNBOOK.md#qa-manual-de-sessão-cliente-ab).

| Cenário | Resultado observado |
| --- | --- |
| A e B ativos | Auth 200; próprio perfil e empresa: 200/uma linha; lista: somente a própria empresa. Perfil, empresa e convites da outra empresa: 200/zero linhas para ambos |
| URL Admin por Cliente | `/admin/clientes` redirecionou para `/cliente` para A e B; consumidor Admin de empresas ausente |
| Inativar somente perfil A | PATCH condicionado retornou uma linha/200. SPA bloqueou A; JWT ainda passou no Auth (200), mas própria empresa/lista retornaram zero linhas. Perfil B permaneceu ativo e sua tela disponível |
| Restaurar A | PATCH condicionado recompôs `active=true`; B permaneceu inalterado. Mesmo JWT antigo voltou a ler a própria empresa e SPA retornou ao Workspace sem código novo |
| Logout real A e B | Botão Sair retornou à tela de acesso; namespace Auth removido, comprovado também pela pré-condição da prova de refresh. JWT antigo: Auth 403; refresh antigo: POST 400 para ambos |
| API do banco após logout | JWT antigo continuou recebendo 200/uma linha para próprio perfil/empresa/lista nos dois atores. Outra empresa/perfil/convites continuaram retornando zero linhas. Não houve leitura cruzada no recorte testado |
| Expiração natural | Confirmada A/B: saídas CALI_AB_EXPIRED registraram remainingTokenSeconds=-62, Auth 403 e banco 401/PGRST303 nas seis projeções. Leituras únicas agendadas para 22:15:47 B/22:16:55 A de Brasília em 01/11; coleta dos logs às 22:18–22:19. Timestamp da coleta não é instante exato da requisição. Sem mudança de relógio/TTL ou novo login |

Prova de expiração usa JWTs originais já deslogados, retidos somente em memória até a leitura; a ferramenta descartou suas referências ao terminar. Não comprova ciclo de refresh/expiração de uma SPA ainda autenticada. Nenhuma requisição adicional de código ou mutação de dados nesta coleta.

**Lacunas técnicas bloqueantes:** logout retirou a sessão no Auth, mas a API do banco ainda aceitou o JWT não vencido; inativação restringiu dados sem revogar a sessão, que recuperou acesso após reativação. Diferem do corte de sessão testado no laboratório. Revisar predicados de sessão vigente e operação de revogação no servidor; correção frontend não substitui esse controle. Não alterar schema/policies nem aplicar a baseline local por consequência desta prova.

**Estado ao encerrar a rodada:** perfis A/B ativos como antes; A foi restaurado, B não foi alterado. Ambos fizeram logout; Admin preservado. Nenhum convite foi revogado nem empresa bloqueada. Prova de inativação não equivale à revogação completa de convite/conta. Escopo de leitura limita-se a profiles/companies/client_invites, sem homologação dos demais domínios, escritas ou Storage.

**Envios:** auditoria confirmou quatro pedidos de código para A e três para B desde 20:40 de Brasília. Agente fez três por ator entre preparação e recuperação do formulário; quarto de A veio da origem A sem autoria identificável. Log confirma aceite do provedor, não recebimento em caixa. Novos disparos suspensos; nenhuma tentativa nova de login para repetir o teste.

Correção preparada, não aplicada: [proposta, limites, catálogo e aceite](contracts/ACCESS_COMPANIES.md#correção-do-corte-no-servidor--candidata-não-aplicada). SQL fora de migrations; nenhuma execução de banco, inclusive no laboratório, autorizada por esta preparação.

## Continuidade isolada e suspensão de runtime — 02/11

Relatório local preservado em `output/runtime/session-cut/026e9d79/result.json`, concluído em 02/11 às 00:02 de Brasília: 40 verificações, SQL com rollback, Auth/PostgREST reais, corte de leitura após logout/reativação, refresh sem recuperar dados, novo login, RPC e convite no recorte. Projeção sintética da referência, não catálogo/dump ativo; owners/ACL precisaram de adaptação local. Cinco serviços passaram no controle interno e nas negativas de IP externo/canário do host. Nenhuma escrita hospedada ou e-mail externo nessa rodada.

A execução reproduziu hash Auth pendente que ainda gerava sessão após corte/reativação; `readyForHosted=false`. O resultado inclui reprodução de falhas esperadas e não significa aprovação global. A conversa foi interrompida pela plataforma antes de registrar o fechamento no PR.

A pedido de Felipe, a bateria de runtime não foi retomada. A correção local de troca/admissão está no [contrato dono](contracts/ACCESS_COMPANIES.md#correção-local-da-troca-e-admissão--0211), com regressões unitárias, sem executar seus SQLs. O novo Edge exige `consume_workspace_code_v2` e `admit_workspace_session_v2`: não iniciar laboratório/Edge nem executar drivers antigos até reconciliar esse protocolo com o destino isolado. Builds continuam autocontidos e sem ativação de serviços. Runner experimental preservado como texto privado ignorado, fora do typecheck e sem entrypoint de execução.

Catálogo hospedado, adapter de códigos efetivo e aplicação permanecem pendentes. Chave pública de `.env` e papel Admin da aplicação não concedem leitura do catálogo PostgreSQL. Não solicitar credenciais no chat nem ampliar grants para obter metadados.

## Homologação isolada de convites e sessão — 04/11

O [cenário dedicado](../scripts/local-access-auth-acceptance.ts) usa uma cópia descartável do schema Auth local sem usuários anteriores, fixtures de catálogo e GoTrue, PostgREST, Mailpit, Kong e Edge Runtime descartáveis em rede Docker interna. As imagens já precisam estar no cache. Com o PostgreSQL do laboratório disponível, gerar o bundle com `npm run local:functions:build` e executar `node scripts/local-access-auth-acceptance.ts --run`. O script remove os recursos que criou ao sair. O teste usa endereços `example.test` e TOTP sintético.

A montagem revelou um erro de sintaxe no adapter local de códigos. `authorization` foi renomeada para `authorization_id` em `local-code-admission.sql`. O contrato da RPC e a chave `authorizationId` da resposta são os mesmos.

As 35 verificações passaram. O Admin obteve JWT AAL2 pelo GoTrue. Mailpit capturou os dois convites enviados pelo Auth. A primeira sessão emitida diretamente pelo Auth para A recebeu zero linhas por falta de admissão. Depois, A e B entraram com código da Edge e leram o próprio perfil pelo PostgREST. Revogar A removeu sua leitura e preservou B. O Auth renovou o JWT de A mantendo o ID da sessão e o PostgREST retornou zero linhas antes e depois da reativação. O hash Auth pendente gerou uma sessão após a reativação e essa sessão também recebeu zero linhas. O código emitido antes do corte foi recusado. Um novo código admitiu uma nova sessão e recuperou o acesso de A.

O primeiro ensaio executou o handler no Node. A rodada de provisionamento chama o bundle no Edge Runtime e reserva os convites pela RPC com Admin AAL2. O pedido de código de A cria a conta Auth e o perfil. Para B, a fixture cria só a conta Auth com o marcador do convite para reproduzir falha antes do vínculo. A Edge retoma a mesma identidade. Uma conta sem marcador ou vínculo compatível é recusada. O cenário passou em 34 verificações de Auth, e-mail, Data API e corte. Os drivers da rodada de 02/11 seguem suspensos.

Para a jornada da SPA, forneça em `CALI_QA_PLAYWRIGHT_CLI` o caminho absoluto do entrypoint JavaScript do Playwright CLI instalado e execute o mesmo comando. O driver usa Chrome em sessão descartável, Vite em loopback sem carregar o arquivo de ambiente e encaminha as requisições de Auth, Edge e Data API apenas para a cópia isolada. Os termos têm uma projeção de teste compatível com a forma de gravação da SPA. O Admin revoga pela RPC e o navegador Cliente verifica o efeito na próxima recarga.

O Chrome solicitou e confirmou o código recebido no Mailpit, registrou o aceite e abriu Minha empresa com os dados vinculados. Após a revogação pela RPC, a recarga exibiu acesso indisponível. A consulta de pós-verificação confirmou o aceite e o convite e perfil desativados. Na V1 publicada, uma sessão Admin de teste abriu a lista de clientes e o painel de acessos da empresa sintética como referência. O callback hospedado da V2 segue pendente para o primeiro lançamento.

A regressão após uniformizar a resposta de solicitação da Edge V2 passou no Chrome. A SPA recebeu `{ok:true}`, exibiu o campo de código, confirmou o código do Mailpit, registrou o aceite sintético e consultou a empresa. Após revogar pela RPC, a recarga bloqueou a sessão.

### Guardas das RPCs administrativas legadas

O cenário `--run` passou em 48 verificações com GoTrue e PostgREST. Cadastro, renovação e envio recusaram Admin AAL1, papel de serviço e JWT Admin cuja sessão foi removida. As negativas iniciais não criaram empresa, convite nem captura de envio. Com AAL2, o cadastro preservou convite, ciclo e auditoria. Renovação e envio alcançaram somente o convite de perfil selecionado, usando captura SQL sem transporte externo. A RPC de contato principal aceitou a empresa fora da gestão e recusou a gerenciada. O predicado Admin da fixture usa perfil sintético e a guarda adicional verifica TOTP real.

### Variante com Storage

Em 04/11/2026, o CALI MAPA recebeu a [publicação vigente do aceite V2](../supabase/proposals/hosted-terms/apply.sql). A consulta posterior confirmou quatro recibos legados, zero confirmações V2, publicação `2026-10-15` com SHA-256 do texto oficial já versionado na SPA e execução do aceite restrita a `authenticated`. A transação não ativou a guarda de Storage. O ensaio descartável `sh supabase/proposals/hosted-terms/test.sh` validou confirmação separada de A/B, preservação de data e user agent legados, repetição, troca de versão, sessão removida e [rollback que preserva histórico](../supabase/proposals/hosted-terms/rollback.sql).

Os dois PDFs sintéticos foram preparados no bucket privado e conferidos pelo caminho exato de cada empresa. Pela API hospedada, a RPC anônima de leitura retornou 401 e os dois GETs anônimos de PDF retornaram 400. As fixtures têm perfis e convites ativos e estavam sem sessão no preflight. O [roteiro A/B](RUNBOOK.md#aceite-vigente-e-arquivos-da-fase-2a) inclui prova de bytes, acesso cruzado e cache. A policy candidata passou no teste PostgreSQL com sobreposição permissiva e rollback. Auth, Storage e cache hospedados ainda exigem a rodada autenticada após ativação.

A rodada de navegador do novo contrato não concluiu. O relay de loopback perdeu a conexão (`ECONNRESET`) antes da confirmação pela SPA. A rodada anterior do Chrome continua válida para a publicação sintética anterior. Não houve envio de código aos destinatários hospedados neste lote.

Com a imagem oficial `supabase/storage-api:v1.81.0` no cache local, execute `node scripts/local-access-auth-acceptance.ts --run --storage`. A variante adiciona a API do Storage, sem porta publicada, com arquivos locais descartáveis e a mesma cópia de PostgreSQL. A API cria o bucket privado e recebe quatro objetos sintéticos. A comprovação de adesão usa o ID e a versão retornados pelos metadados desse Storage. Os grants da fixture e a política Cliente reproduzida são exclusivos da cópia. O teste exercita download, assinatura, revogação e reativação pela API e o corte de uma RPC privilegiada pelo PostgREST.

Em 04/11, passaram 54 verificações. A baixou só o arquivo da própria empresa e a sessão sem admissão foi recusada. Revogar bloqueou download direto, nova assinatura e a RPC de perfil. B manteve acesso. O link emitido antes da revogação ainda entregou bytes sem JWT. A reativação preservou o corte da sessão antiga e um novo código restaurou o download de A. O ensaio usou Storage sem CDN. A rodada do Chrome acima cobre a jornada de acesso, enquanto esta variante comprova bytes e RPC pela API.

A rodada seguinte passou em 61 verificações com a candidata de filtro. A API entregou documento e entregável ao Cliente admitido. A assinatura individual foi recusada. A assinatura em lote respondeu sem URL para os dois objetos. Ao desmarcar a empresa sintética para gestão, a assinatura voltou a funcionar. O código da imagem local declara a mesma operação de download autenticado na rota explícita e na rota usada pelo SDK instalado. O ensaio HTTP usou a rota explícita.

O ensaio de aceite passou em 89 verificações. A API recusou bytes sem publicação, antes do aceite e após recibo com hash incorreto. O Cliente consultou o texto vigente antes de aceitar. Depois de uma nova publicação, o recibo antigo perdeu acesso mesmo com uma política permissiva sobreposta na fixture. Após reativação, a sessão cortada não registrou aceite. A sessão nova registrou a versão vigente e recuperou o download. O recibo de A não liberou B. A prova usa publicação sintética e não mede CDN.

## Topologia vigente — DEC-22 e DEC-25

| Item | Estado/definição |
| --- | --- |
| CLI | Supabase `2.122.0`; binário oficial arm64 com SHA-256 conferido; usado em `/tmp/cali-cli-2.122.0`, sem instalação global/login/link |
| Docker observado em 29/10 | `29.9.2`, contexto Unix local |
| Projeto | `cali-workspace-v2-local` |
| Serviços de negócio | Postgres, Auth, PostgREST, Kong, Edge Runtime e captura Mailpit; somente `cali-workspace-v2-isolated`, bridge internal |
| Ingress dedicado | `cali-workspace-v2-ingress`; proxy HAProxy na rede internal e em bridge exclusiva homônima, sem outros serviços nessa bridge |
| Proxy | Imagem oficial fixada por digest em `supabase/local/compose.yaml`; destinos TCP fixos em `haproxy.cfg`, sem CONNECT/SOCKS, sem encaminhamento IP |
| Restrições do proxy | Usuário sem privilégios, filesystem readonly, cap_drop ALL, no-new-privileges, forwarding IPv4/IPv6 desligado, mount de configuração readonly; sem Docker socket/credenciais |
| Portas efetivas | Somente proxy publica `127.0.0.1:56321` API, `56322` Postgres, `56324` Mailpit e `56325` SMTP; sem IPv6/0.0.0.0 |
| Portas reservadas | `56320` shadow/canário temporário e `56323` Studio desabilitado |
| Postgres testado | `17.11`, imagem CLI `public.ecr.aws/supabase/postgres:17.11.0.006`; não presume versão do oficial |
| Schema exposto | `cali_workspace`; helpers/controle em `cali_private`, não exposto na API |
| Migrations/seeds automáticos | Continuam desabilitados; baseline de negócio aplicada explicitamente pelo runner local |
| Serviços/canais externos | Realtime, Storage, Analytics, OAuth e SMTP externo desabilitados; Edge local habilitado para workspace-access |
| Cadastro/login local | Signup público/anônimo bloqueado; provider de e-mail habilitado. Senha serve somente ao driver de regressão; workspace-access local usa código enviado ao Mailpit e troca de hashed_token por sessão Auth |
| MFA | TOTP habilitado; operação Admin exige perfil ativo, AAL2 e fator TOTP verificado ainda existente |

O primeiro desenho tentou publicar portas dos serviços ligados somente à rede internal. A reprodução em Docker mostrou `HostConfig.PortBindings` preenchido e `NetworkSettings.Ports` vazio; CLI falhou por ECONNREFUSED. A [explicação no projeto Docker](https://github.com/moby/moby/discussions/53256) confirma que publicação depende de uma rede com gateway. DEC-25 adota ingress separado: serviços de negócio permanecem internal, só o proxy tem a segunda bridge. O proxy tem conectividade própria; não declarar que ele não possui egress. Destinos fixos e forwarding desligado evitam usá-lo como saída genérica para os serviços.

Os seis namespaces dos serviços, incluindo Edge, passaram no controle de conexão ao Postgres interno e nas negativas de IP externo `1.1.1.1:443` e canário controlado do host em `host.docker.internal:56320`. Isso comprova esses caminhos testados, não uma auditoria de todo caminho possível de rede/host. Não sondar portas de outros projetos. Cada ativação exige repetir a topologia e essas provas antes de integrar dados.

## Arquivos e guardas

- [local-environment.ts](../scripts/local-environment.ts) gera/confere [config.toml](../supabase/config.toml); recusa vínculo remoto, variáveis de conexão/credenciais/overrides e `.env` não revisados, sem imprimir valores.
- [local-database.ts](../scripts/local-database.ts) confere CLI/contexto, rede, labels, todos os serviços CALI, bindings e restrições do proxy. Digests dos dois arquivos de ingress são conferidos; alteração exige revisão e atualização explícita. `--apply` aceita somente a lista ordenada de migrations conhecidas, em transação, com journal/digest. Repetição idêntica não escreve; divergência exige migration nova, sem reset/sobrescrita.
- `scripts/build-local-functions.ts` gera bundle autocontido em `supabase/.temp/workspace-access/index.ts` antes da inicialização; Zod é resolvido no host. Configuração permite somente esse entrypoint e origem `http://127.0.0.1:5173`; função rejeita backend fora dos nomes internos. Código-fonte fica em `supabase/functions/workspace-access`.
- [Baseline SQL](../supabase/migrations/20261029090000_access_adhesion_baseline.sql) é implementação nova limitada à V2 local. Não é dump, reprodução completa do banco ativo ou conjunto de migrations do oficial. [Contrato/limites](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910).
- [Teste SQL](../supabase/tests/adhesion.sql) usa claims sintéticos e rollback. [Driver API/Auth](../scripts/local-adhesion-api.ts) usa Auth local, JWT verificado pelo PostgREST e TOTP real. Chaves, senhas, tokens e segredo TOTP ficam somente em memória.
- [Prova de isolamento](../scripts/local-isolation.ts) usa controles positivos e canário próprio; erro de ferramenta não conta como bloqueio. [Captura local](../scripts/local-mail.ts) envia somente mensagem sintética ao SMTP local e confere Mailpit.

Neste laboratório, cadastro/convite completos, limite de quatro acessos e integração das telas ao contrato local continuam pendentes; a composição hospedada de DEC-27 usa adapter próprio. Códigos/termos/estado de sessão e RLS da própria empresa foram implementados/testados no servidor local. Leitura Cliente da referência de adesão continua negada; o próprio perfil exige sessão vigente. Não ampliar grants para satisfazer a demonstração.

## Ativação reproduzível

Ferramentas Docker/CLI precisam estar no PATH. Nesta execução foi usado `PATH="/tmp/cali-cli-2.122.0:$PATH"`; esse diretório é temporário. Em outra máquina/sessão, instalar o binário oficial da versão fixada e conferir seu checksum; não fazer download implícito via npx nem reutilizar token/config do oficial.

Antes de iniciar, conferir ausência de `supabase/.temp/project-ref`, overrides e arquivos não revisados. Criar redes somente se ausentes, após inspecionar eventual recurso homônimo:

```bash
docker network create --internal --driver bridge \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  cali-workspace-v2-isolated
docker network create --driver bridge \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  cali-workspace-v2-ingress
npm run local:preflight
npm run local:functions:build
docker compose -f supabase/local/compose.yaml config -q
docker compose -f supabase/local/compose.yaml up -d
```

`local:preflight` verifica preparação com portas livres; depois do proxy/stack ativo elas estarão ocupadas por desenho. Usar `local:db:inspect` para topologia ativa. Nenhum script tenta outro alvo quando uma verificação falha.

**Banco novo:** iniciar bootstrap sem PostgREST, porque a API expõe `cali_workspace` e esse schema ainda não existe. Não usar ignore-health-check. O CLI cria seus schemas/roles e Auth executa suas migrations internas; isso é distinto da baseline de negócio e dos SQLs oficiais, que não foram executados.

```bash
umask 077
supabase start --network-id cali-workspace-v2-isolated \
  --exclude postgrest,realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
  > /tmp/cali-local-bootstrap-private.log 2>&1
npm run local:db:inspect
npm run local:isolation:test
npm run local:db:apply
npm run local:db:test
supabase stop --project-id cali-workspace-v2-local
```

**Baseline já aplicada:** gerar bundle e iniciar os seis serviços, preservando volume. O CLI pode imprimir chaves locais; capturar saída em arquivo privado fora do Git e não colar seu conteúdo.

```bash
umask 077
npm run local:functions:build
supabase start --network-id cali-workspace-v2-isolated \
  --exclude realtime,storage-api,imgproxy,postgres-meta,studio,logflare,vector,supavisor \
  > /tmp/cali-local-start-private.log 2>&1
npm run local:db:inspect
npm run local:isolation:test
npm run local:db:apply
npm run local:db:test
npm run local:access:test
npm run local:adhesion:test
npm run local:mail:test
```

O bundle Edge foi testado minificado/autocontido; o build mantém o arquivo existente (emptyOutDir=false), pois remover o arquivo montado pelo Docker fazia workers posteriores falharem. Rebuild e endpoint foram verificados juntos; a primeira tentativa com referências internas em comentários falhou na resolução de arquivo pelo CLI, sem fallback de rede. Os testes de runtime são explícitos, fora de `npm run verify`; não executar Docker/SQL/Auth como efeito do build/CI comum. SQL reverte suas fixtures. O driver API cria empresas/atores e evidência **sintéticos persistentes**, com referência marcada como teste; tentativas interrompidas podem deixar fixtures parciais. Não importa dados nem limpa evidências/atores anteriores. A mensagem sintética permanece na captura local. Limpeza de volume/dados precisa de recorte próprio.

## Evidência de 29/10 e pendências

- CLI verificado, duas redes dedicadas e proxy fixo ativados; serviços de outros projetos não foram alterados.
- Bootstrap inicial falhou por porta sem publicação; segunda tentativa completa revelou necessidade de criar schema antes de iniciar PostgREST. Procedimento acima corrige ambas as condições, sem abrir rede de negócio nem ignorar healthcheck.
- Baseline aplicada em transação; repetição com mesmo digest não escreveu. Testes SQL passaram e foram repetidos com dados persistentes já presentes.
- Driver inicial API/Auth de adesão passou em **30 verificações**: signup bloqueado, primeiro fator, cadastro/erro/confirmação TOTP, gravação/leitura Admin, autoria extra e escrita direta negadas, Cliente A/B, anônimo/service role, perfil inativo e AAL2 antigo após remover fator.
- Negativas iniciais passaram nos cinco namespaces; a ampliação para Edge também passou, totalizando seis. SMTP sintético foi capturado/conferido no Mailpit. Não é teste do envio de workspace-access/Resend, de OTP de produção ou do resumo operacional.
- Persistência após reinicialização, gates finais e estado da parada são registrados no [changelog](CHANGELOG.md); não inferir que o stack está ativo apenas pela existência dos arquivos.

OPEN-10 tem ambiente executado e provas de códigos/termos/estado/revogação no servidor. O driver `local:access:test` testa concorrência/uso único, Auth e duas versões sintéticas; `local:adhesion:test` foi atualizado para aceitar termos antes da operação Admin. Ainda faltam sessão/adapter/eventos e telas do frontend, convite/quatro acessos e RLS dos demais domínios. Não existe texto jurídico de produção aprovado; ausência de versão publicada bloqueia. Drivers alteram somente a publicação sintética do laboratório e mantêm fixtures. Evidência final no changelog.

## Parada e rollback

```bash
supabase stop --project-id cali-workspace-v2-local
docker compose -f supabase/local/compose.yaml stop ingress
```

Esses comandos preservam os volumes. Não usar `--all`, `--no-backup`, prune ou remoção global. Dados/adesões já gravados não são desfeitos por git revert; alteração de schema exige migration revisada. Não apagar evidência para reexecutar teste. Nunca usar link/login/db pull/push/deploy ou credenciais oficiais como alternativa à falha local.

Fontes técnicas: [CLI local](https://supabase.com/docs/guides/local-development), [MFA/RLS](https://supabase.com/docs/guides/auth/auth-mfa), [funções e privilégios](https://supabase.com/docs/guides/database/functions), [HAProxy DNS](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/proxying-essentials/dns-resolution/) e [publicação Docker](https://docs.docker.com/engine/network/port-publishing/). Consultas não enviaram código privado, dados ou credenciais.
