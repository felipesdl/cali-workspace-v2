# Ambiente isolado da fase 1

Atualização: 29/10/2026. **Baseline mínima e persistência de adesão aplicadas/testadas no laboratório local. Frontend continua somente com mocks, sem SDK/URL/chave Supabase.** Não houve conexão ao oficial, importação de seus dados/SQL, comunicação externa ou publicação. A fase 1 permanece em andamento.

## Topologia vigente — DEC-22 e DEC-25

| Item | Estado/definição |
| --- | --- |
| CLI | Supabase `2.122.0`; binário oficial arm64 com SHA-256 conferido; usado em `/tmp/cali-cli-2.122.0`, sem instalação global/login/link |
| Docker observado em 29/10 | `29.9.2`, contexto Unix local |
| Projeto | `cali-workspace-v2-local` |
| Serviços de negócio | Postgres, Auth, PostgREST, Kong e captura Mailpit; somente `cali-workspace-v2-isolated`, bridge internal |
| Ingress dedicado | `cali-workspace-v2-ingress`; proxy HAProxy na rede internal e em bridge exclusiva homônima, sem outros serviços nessa bridge |
| Proxy | Imagem oficial fixada por digest em `supabase/local/compose.yaml`; destinos TCP fixos em `haproxy.cfg`, sem CONNECT/SOCKS, sem encaminhamento IP |
| Restrições do proxy | Usuário sem privilégios, filesystem readonly, cap_drop ALL, no-new-privileges, forwarding IPv4/IPv6 desligado, mount de configuração readonly; sem Docker socket/credenciais |
| Portas efetivas | Somente proxy publica `127.0.0.1:56321` API, `56322` Postgres, `56324` Mailpit e `56325` SMTP; sem IPv6/0.0.0.0 |
| Portas reservadas | `56320` shadow/canário temporário e `56323` Studio desabilitado |
| Postgres testado | `17.11`, imagem CLI `public.ecr.aws/supabase/postgres:17.11.0.006`; não presume versão do oficial |
| Schema exposto | `cali_workspace`; helpers/controle em `cali_private`, não exposto na API |
| Migrations/seeds automáticos | Continuam desabilitados; baseline de negócio aplicada explicitamente pelo runner local |
| Serviços/canais externos | Realtime, Storage, Edge Runtime, Analytics, OAuth e SMTP externo desabilitados |
| Cadastro/login local | Signup público/anônimo bloqueado; provider de e-mail habilitado. Senha serve somente ao driver sintético de Auth; não implementa nem substitui workspace-access por código |
| MFA | TOTP habilitado; operação Admin exige perfil ativo, AAL2 e fator TOTP verificado ainda existente |

O primeiro desenho tentou publicar portas dos serviços ligados somente à rede internal. A reprodução em Docker mostrou `HostConfig.PortBindings` preenchido e `NetworkSettings.Ports` vazio; CLI falhou por ECONNREFUSED. A [explicação no projeto Docker](https://github.com/moby/moby/discussions/53256) confirma que publicação depende de uma rede com gateway. DEC-25 adota ingress separado: serviços de negócio permanecem internal, só o proxy tem a segunda bridge. O proxy tem conectividade própria; não declarar que ele não possui egress. Destinos fixos e forwarding desligado evitam usá-lo como saída genérica para os serviços.

Os cinco namespaces dos serviços passaram no controle de conexão ao Postgres interno e nas negativas de IP externo `1.1.1.1:443` e canário controlado do host em `host.docker.internal:56320`. Isso comprova esses caminhos testados, não uma auditoria de todo caminho possível de rede/host. Não sondar portas de outros projetos. Cada ativação exige repetir a topologia e essas provas antes de integrar dados.

## Arquivos e guardas

- [local-environment.ts](../scripts/local-environment.ts) gera/confere [config.toml](../supabase/config.toml); recusa vínculo remoto, variáveis de conexão/credenciais/overrides e `.env` não revisados, sem imprimir valores.
- [local-database.ts](../scripts/local-database.ts) confere CLI/contexto, rede, labels, todos os serviços CALI, bindings e restrições do proxy. Digests dos dois arquivos de ingress são conferidos; alteração exige revisão e atualização explícita. `--apply` aceita somente a baseline conhecida, em transação, com journal/digest. Repetição idêntica não escreve; divergência exige migration nova, sem reset/sobrescrita.
- [Baseline SQL](../supabase/migrations/20261029090000_access_adhesion_baseline.sql) é implementação nova limitada à V2 local. Não é dump, reprodução completa do banco ativo ou conjunto de migrations do oficial. [Contrato/limites](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910).
- [Teste SQL](../supabase/tests/adhesion.sql) usa claims sintéticos e rollback. [Driver API/Auth](../scripts/local-adhesion-api.ts) usa Auth local, JWT verificado pelo PostgREST e TOTP real. Chaves, senhas, tokens e segredo TOTP ficam somente em memória.
- [Prova de isolamento](../scripts/local-isolation.ts) usa controles positivos e canário próprio; erro de ferramenta não conta como bloqueio. [Captura local](../scripts/local-mail.ts) envia somente mensagem sintética ao SMTP local e confere Mailpit.

Não há RLS/serviço de convites, limite de quatro acessos, códigos de login, termos versionados ou provider de sessão implementados neste recorte. A leitura Cliente de empresas e de referências da adesão não foi liberada por esta baseline; o próprio perfil pode ser consultado para tratar o estado de acesso. Não ampliar grants para satisfazer a demonstração.

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

**Baseline já aplicada:** iniciar os cinco serviços, preservando volume. O CLI pode imprimir chaves locais; capturar saída em arquivo privado fora do Git e não colar seu conteúdo.

```bash
umask 077
supabase start --network-id cali-workspace-v2-isolated \
  --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
  > /tmp/cali-local-start-private.log 2>&1
npm run local:db:inspect
npm run local:isolation:test
npm run local:db:test
npm run local:adhesion:test
npm run local:mail:test
```

Os testes de runtime são explícitos, fora de `npm run verify`; não executar Docker/SQL/Auth como efeito do build/CI comum. SQL reverte suas fixtures. O driver API cria empresas/atores e evidência **sintéticos persistentes**, com referência marcada como teste; tentativas interrompidas podem deixar fixtures parciais. Não importa dados nem limpa evidências/atores anteriores. A mensagem sintética permanece na captura local. Limpeza de volume/dados precisa de recorte próprio.

## Evidência de 29/10 e pendências

- CLI verificado, duas redes dedicadas e proxy fixo ativados; serviços de outros projetos não foram alterados.
- Bootstrap inicial falhou por porta sem publicação; segunda tentativa completa revelou necessidade de criar schema antes de iniciar PostgREST. Procedimento acima corrige ambas as condições, sem abrir rede de negócio nem ignorar healthcheck.
- Baseline aplicada em transação; repetição com mesmo digest não escreveu. Testes SQL passaram e foram repetidos com dados persistentes já presentes.
- Driver API/Auth passou em **30 verificações**: signup bloqueado, primeiro fator, cadastro/erro/confirmação TOTP, gravação/leitura Admin, autoria extra e escrita direta negadas, Cliente A/B, anônimo/service role, perfil inativo e AAL2 antigo após remover fator.
- Negativas de rede passaram nos cinco namespaces. SMTP sintético foi capturado/conferido no Mailpit. Não é teste do envio de workspace-access/Resend, de OTP de produção ou do resumo operacional.
- Persistência após reinicialização, gates finais e estado da parada são registrados no [changelog](CHANGELOG.md); não inferir que o stack está ativo apenas pela existência dos arquivos.

OPEN-10 tem ambiente executado e provas deste recorte; faltam ampliar autorização/sessão/termos/códigos e os estados de empresa previstos na fase 1. Paridade de login por código, concorrência/uso único, convite/revogação e RLS dos demais domínios não foram comprovados.

## Parada e rollback

```bash
supabase stop --project-id cali-workspace-v2-local
docker compose -f supabase/local/compose.yaml stop ingress
```

Esses comandos preservam os volumes. Não usar `--all`, `--no-backup`, prune ou remoção global. Dados/adesões já gravados não são desfeitos por git revert; alteração de schema exige migration revisada. Não apagar evidência para reexecutar teste. Nunca usar link/login/db pull/push/deploy ou credenciais oficiais como alternativa à falha local.

Fontes técnicas: [CLI local](https://supabase.com/docs/guides/local-development), [MFA/RLS](https://supabase.com/docs/guides/auth/auth-mfa), [funções e privilégios](https://supabase.com/docs/guides/database/functions), [HAProxy DNS](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/proxying-essentials/dns-resolution/) e [publicação Docker](https://docs.docker.com/engine/network/port-publishing/). Consultas não enviaram código privado, dados ou credenciais.
