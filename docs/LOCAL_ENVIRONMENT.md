# Ambiente isolado da fase 1

Definição técnica: 28/10/2026, no escopo autorizado por Felipe. **Supabase local dedicado via Docker, sem projeto hospedado nem vínculo remoto. Configuração/preflight implementados; stack, schema de negócio e isolamento em execução ainda não comprovados.** O frontend permanece em modo demonstrativo e não recebeu SDK/URL/chave Supabase.

## Escolha e limites

Uma instância local permite preparar Auth/Postgres e atores sintéticos sem depender de credenciais/dados do oficial. Projeto hospedado de teste permanece alternativa futura se surgir necessidade concreta de colaboração remota; não é necessário criar serviço pago ou compartilhar projeto oficial para iniciar essa etapa.

| Item | Definição |
| --- | --- |
| CLI | Supabase `2.122.0`, versão publicada conferida; ferramenta separada do runtime npm da aplicação |
| Docker observado | Daemon `29.8.2` disponível na inspeção local |
| Projeto local | `cali-workspace-v2-local` |
| Rede exclusiva requerida | `cali-workspace-v2-isolated`, driver bridge, internal, bind IPv4 `127.0.0.1` |
| Postgres local | Major 17 na configuração de teste; versão do banco oficial não foi consultada nem presumida |
| API / Postgres / shadow | `127.0.0.1:56321` / `56322` / `56320` |
| Captura de e-mail / SMTP local | `127.0.0.1:56324` / `56325` |
| Studio | Desabilitado; porta 56323 reservada, sem UI administrativa iniciada |
| Schema de negócio planejado | `cali_workspace`; sem exposição de Portal/Mapa/public como contrato da V2 |
| Migrations/seeds automáticos | Desabilitados; nenhum SQL oficial foi copiado para execução |
| Serviços adicionais | Edge Runtime, Realtime, Storage/S3/vector e Analytics desabilitados neste recorte |
| Signup / provedores externos | Signup público e anônimo desabilitados; sem OAuth externo ou SMTP de produção |
| MFA TOTP local | Cadastro/verificação habilitados na configuração conforme DEC-21; não é prova de guardas/RLS |

Os campos são gerados pela definição em [local-environment.ts](../scripts/local-environment.ts); [supabase/config.toml](../supabase/config.toml) é a configuração versionada conferida pelo gate. Alteração exige revisão das duas representações, sem editar apenas portas/URL para contornar erro. Tokens locais, quando houver, não serão impressos ou versionados; não há chaves reais neste recorte.

`local_smtp` é o nome do campo no template do CLI fixado. O serviço de captura local (Mailpit na documentação atual) substitui entrega externa de e-mail Auth. Isso não redireciona automaticamente o `fetch` para Resend da função oficial; esse envio precisa de adapter local antes do teste de login por código. Nomes de projeto/ports não comprovam bloqueio de saída.

## Comandos disponíveis agora

```bash
npm run local:config:check
npm run local:preflight
```

- `local:config:check` confere o arquivo contra a configuração revisada; faz parte de `verify`, sem depender de Docker/CLI ou conexão a banco. Não certifica compatibilidade operacional do CLI.
- `local:preflight` lê configuração, vínculo remoto, nomes de overrides, existência de arquivos de ambiente, contexto Unix local/versão do Docker e CLI, rede e portas de loopback. Não instala ferramentas, cria rede, inicia container, executa SQL ou chama projeto Supabase.
- Antes de chamar ferramentas, o preflight recusa `supabase/.temp/project-ref`, variáveis SUPABASE_* / conexão Postgres / overrides Docker e arquivos `.env` não revisados. Exibe somente nomes, não valores de credenciais. A integração futura precisará de configuração local explicitamente validada; não liberar todos os arquivos/overrides por conveniência.
- Depois de iniciado um stack, portas ocupadas são esperadas; este preflight serve para preparação de uma instância nova, não healthcheck da instância ativa.

O CLI ainda não foi instalado; o script espera a versão exata no PATH e não faz download automático via npx. Uma instalação posterior deve ser específica para essa ferramenta, verificável e sem reutilizar token, config pessoal ou vínculo do oficial. A política npm da aplicação continua `npm ci --ignore-scripts`.

## Ativação posterior, com gates

Os comandos abaixo são orientação operacional futura, **não foram executados neste lote**. Nenhum comando remoto (`link`, `login`, `db pull/push`, deploy) é necessário ou autorizado por esta definição.

1. Instalar/verificar o CLI `2.122.0` e conferir que nenhuma credencial/override remoto é herdado.
2. Criar somente a rede dedicada, se ainda ausente, preservando redes/containers dos outros projetos:

   ```bash
   docker network create --internal --driver bridge \
     --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
     cali-workspace-v2-isolated
   ```

3. Executar o preflight. Se houver porta ocupada, inspecionar o dono e revisar a definição; não parar o outro projeto nem reutilizar sua rede/banco.
4. Preparar uma baseline mínima **revisada** de acesso/empresa, incluindo schema, guards, RLS/grants e atores sintéticos. Há definições ausentes e diferenças aprovadas; não executar em lote as migrations do oficial nem copiar identidades/allowlists pessoais.
5. Só então preparar a primeira inicialização com a rede dedicada. O campo API `cali_workspace` não cria esse schema; a configuração atual não basta para funcionar como backend do produto. Migrations/seeds seguem desligados até revisão explícita do modo de bootstrap.
6. Comprovar bindings reais de todos os containers, ausência de egress externo e captura local, incluindo testes negativos de conexão/entrega. Rede internal + loopback é a configuração pretendida; não foi exercitada e não é garantia de isolamento contra caminhos pelo host ou containers ligados a outra rede.
7. Registrar revisão, imagens, status e testes antes de integrar o frontend. Nunca abrir bypass de MFA/termos porque a URL contém um marcador de QA.

O acesso por código deve manter os [contratos reconciliados](contracts/ACCESS_COMPANIES.md), inclusive uso único, rate limit e tentativas; ligar OTP nativo não prova paridade com workspace-access. `otp_length=6`, `otp_expiry=600` e `max_frequency=120s` alinham o laboratório com a referência, mas não substituem sua verificação/atomicidade no serviço.

## Cenários sintéticos previstos

Preparar Admin com MFA pendente/confirmado, Cliente A1/A2 da mesma empresa, Cliente B de outra empresa, perfil inativo, empresa sem adesão, empresa pausada/bloqueada/encerrada/arquivada e aceite ausente/antigo/corrente. Usar e-mails `example.test`, pessoas/empresas fictícias e captura local. Não são usuários já criados; não contêm nem importam dados do oficial.

Perfis com `is_primary` distintos devem manter as mesmas permissões Cliente aprovadas. Pausa e bloqueio são cenários distintos. Dados de Auth, vínculo, adesão e aceite devem ser preparados separadamente para não esconder uma dependência com cadastro completo da fase 2A.

## Evidência desta rodada

- Docker disponível; oito containers de outros contextos observados, nenhum CALI. Nenhum foi alterado/parado.
- Sem listener TCP nas seis portas escolhidas na inspeção de loopback; isso é uma fotografia, não uma reserva de porta.
- Nenhuma rede dedicada existente; CLI não instalado no PATH.
- `local:preflight` foi executado e **não passou** pelos motivos concretos: CLI ausente e rede ausente. Isso mantém a ativação pendente; não houve fallback para ambiente remoto.
- Nenhum stack iniciado, SQL/migration/seed executado, chave coletada, banco consultado ou comunicação disparada. Configuração estática e testes de precondição não provam RLS, Auth, retenção ou envio.

OPEN-10 passa de ambiente indefinido para **local definido, ativação/prova pendentes**. Fase 1 continua em andamento. Instalação/ativação, baseline revisada e teste de acesso real são os próximos gates; criação real de conta/convite continua na fase 2A.

## Parada e rollback futuros

Sem stack criado, o rollback deste lote é reverter contratos/configuração/scripts/docs, preservando trabalhos posteriores. Na ativação futura, parar somente `cali-workspace-v2-local`; não usar `supabase stop --all`, remoção global de volumes ou Docker prune. Exclusão de dados/volumes requer escopo próprio. Não há vínculo remoto para desfazer.

## Fontes técnicas consultadas

[Desenvolvimento local e rede](https://supabase.com/docs/guides/local-development), [testes de e-mail Auth](https://supabase.com/docs/guides/auth/testing-auth-flows), [template do CLI v2.122.0](https://github.com/supabase/cli/blob/v2.122.0/apps/cli-go/pkg/config/templates/config.toml) e [versão publicada](https://www.npmjs.com/package/supabase/v/2.122.0). A consulta às fontes não enviou código privado, credenciais ou dados de clientes.
