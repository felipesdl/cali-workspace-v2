# Operação local e verificação

Atualização: 01/11/2026. Fase 1 iniciada na branch local `codex/fase-1-base`, a partir de `main` `c9baea7`. O pacote está em revisão no [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) em rascunho, conforme solicitação de 27/10; o acompanhamento de concluído/pendente fica no [roadmap](ROADMAP.md#acompanhamento-da-fase-1--pacote-para-revisão). Commits/push/PR são etapas de revisão distintas de merge/deploy. DEC-27 autoriza integração ao backend hospedado e fixtures sintéticas identificadas; não houve publicação da aplicação.

## Backup, restauração e ambientes — DEC-28

Felipe confirmou em 09/11/2026 que o CALI MAPA atual é produção, já online e com dados de produção. Concluir os ajustes e validar esse ambiente antes de criar a homologação separada. A dispensa de backup e restauração prevista para staging na versão anterior da DEC-28 não se aplica a produção. Não existe backup integral pré-alterações comprovado. A consulta histórica à Management API retornou lista vazia de backups, objeto vazio de metadados físicos, PITR desligado e mecanismo WAL-G habilitado. Nenhum arquivo de backup foi baixado ou restaurado nessa consulta. Um backup futuro preservará o estado da sua captura, não o estado anterior às mudanças.

Para concluir os ajustes no ambiente atual e preparar a homologação, seguir o plano de separação e recuperação:

1. Inventariar em leitura o estado efetivo: schemas, dados, funções, triggers, RLS, grants, roles, extensões, agendas, Auth, Storage, Edge Functions, destinos e configurações. Correlacionar horário e commit de código com a captura; a `main` sozinha não identifica o estado do banco. Registrar cobertura e exclusões.
2. Preservar banco e arquivos do Storage, com manifesto, contagens e hashes dos artefatos. Registrar configuração e revisões dos serviços; tratar segredos por procedimento protegido, sem imprimi-los ou versioná-los. Dados Auth e outros conteúdos privados exigem destino com acesso restrito. O [backup de banco do Supabase](https://supabase.com/docs/guides/platform/backups) não inclui os bytes dos objetos do Storage; não chamar exportação somente do schema de backup completo.
3. Restaurar em destino isolado, com envios e agendamentos externos bloqueados. Conferir cobertura e integridade, funções/permissões, objetos do Storage e referências; validar acesso por atores sintéticos sem copiar sessões de uso para o novo ambiente. Registrar evidência, limitações, tempo de recuperação e limpeza do destino. Falha de restauração mantém o gate aberto. Este ensaio é distinto da bateria Auth/Edge/Docker suspensa, que não será retomada implicitamente.
4. Consolidar baseline efetiva e cadeia ordenada de migrations a partir do inventário e dos SQLs já aplicados. Propostas históricas não constituem automaticamente uma cadeia reproduzível; não reaplicar `candidate.sql` em schema existente nem executar rollbacks para tentar fabricar o passado. Provar criação limpa e atualização em isolamento.
5. Concluir os ajustes autorizados no CALI MAPA atual com conferência de destino, recuperação e rollback compatíveis com cada mudança. Registrar commit, versão de schema, funções e configuração efetiva após a validação.
6. Depois da validação de produção, provisionar homologação em projeto separado a partir dessa revisão de código e schema, com configuração equivalente. Usar URLs, chaves, Auth, usuários, Storage, funções, segredos, callbacks, agendas e canais de e-mail próprios, com dados sintéticos e destinatários controlados. Para as próximas versões, validar o mesmo código e as mesmas migrations em homologação antes de promover para produção.

O ensaio local já executado com `sh scripts/rehearse-phase4-recovery.sh` restaurou fixtures em um segundo PostgreSQL descartável. Conferiu hashes, contagens, função, grants e bytes de um arquivo sintético. O encerramento removeu os clusters e arquivos temporários. A prova se limita às fixtures do ensaio.

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

1. Os rascunhos e a comprovação A/B foram registrados pelo Admin. A [RPC](../supabase/proposals/hosted-access-pilot/prepare-drafts.sql) está instalada no CALI MAPA, exige sessão Admin e MFA e devolve o mesmo rascunho em nova tentativa. Cada adesão referencia um PDF sintético privado e sua versão exata. Conferir os escritores legados antes de ativar o piloto.
2. A [base](../supabase/proposals/hosted-access-pilot/base.sql), os [códigos](../supabase/proposals/hosted-access-pilot/codes.sql) e a guarda de arquivos foram instalados com o cadastro privado vazio. O helper `current_company_id()` preserva o contrato original fora do piloto e nega sessões A/B sem admissão. A instalação verifica a definição anterior. A guarda de perfil também bloqueia a escrita legada de um ator A/B sem sessão admitida.
3. `workspace-access-pilot` foi publicada no CALI MAPA. Usa o remetente existente `workspace@calirh.com`, a [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email) e uma chave de idempotência por solicitação. A chave HMAC dos códigos é derivada por HKDF do segredo de serviço do projeto com rótulo exclusivo do piloto. A chamada com endereço fictício fora do piloto retornou sucesso genérico sem envio.
4. O [cadastro A/B](../supabase/proposals/hosted-access-pilot/enroll.sql) foi aplicado. A leitura posterior confirmou duas contas e o bucket privado. A rodada única usou as portas `5181` e `5182` com `VITE_CALI_PILOT_ACCESS=true`. Identificar a conta pelo nome em **Minha empresa**. A porta sozinha não determina a empresa. A e B receberam o código, confirmaram os termos e consultaram a empresa vinculada. A revogação de A no Admin bloqueou a sessão após recarga. B continuou com acesso.
5. Para suspender, aplicar [pause.sql](../supabase/proposals/hosted-access-pilot/pause.sql) e retirar a função piloto da homologação. A suspensão recusa novos códigos e sessões já admitidas de A/B. Recibos e histórico técnico são preservados.

A primeira rodada usou texto simples no e-mail. O Gmail recebeu mais tarde e usou o mesmo código. A versão atual da função restaura o HTML Cliente V3, com o botão de acesso apontando para a aba local do piloto. O código de envio registra o identificador de aceite do provedor sem gravar e-mail ou código no log. A correção foi publicada e verificada em renderização local. A rodada concluída não foi repetida para conferir a nova mensagem nas caixas.

O [comando de reautorização](../supabase/proposals/hosted-access-pilot/reauthorize.sql) está instalado no CALI MAPA. A ficha Admin consulta o estado do vínculo específico e exige confirmação da revogação vigente. O servidor revalida adesão, sessão Admin com MFA, e-mail e pareamento original. Reautorizar não envia mensagem: o Cliente deve solicitar um código novo na aba de teste. A sessão anterior permanece cortada. A consulta de catálogo e a interface conectada foram verificadas, com A revogada e B ativa; a gravação foi testada somente em PostgreSQL descartável.

Para retirar somente a reautorização, revogar `EXECUTE` de `authenticated` em `cali_workspace.v2_reauthorize_pilot_access(uuid,timestamptz,uuid)` e recarregar o cache de schema do PostgREST. Preservar a consulta do vínculo e a tabela privada de histórico. Para suspender a emissão e as sessões de todo o piloto, usar a suspensão do passo 5.

#### Pré-condições para quatro vagas hospedadas

O [inventário somente leitura](../supabase/proposals/hosted-access-pilot/catalog-slots.sql) não retorna dados de clientes. Em 04/11, o CALI MAPA confirmou matrícula com chave `company_id`, chaves únicas por convite, perfil e destinatário, e histórico de reautorização por empresa e pedido. Em `client_invites`, a unicidade é por empresa e e-mail. O gatilho existente conta convites ativos, sem filtrar `platform_access` nem bloquear a empresa para serializar gravações. O gatilho de perfil força a desativação em empresa fechada.

Antes de ampliar o piloto: endereçar os comandos e o histórico pelo ID do convite e validar que pertence à empresa; preservar os IDs, cortes e admissões A/B existentes na migração; serializar ocupação e reautorização por empresa, incluindo os escritores aplicáveis ao recorte. O gatilho atual não prova o limite sob concorrência. Homologar um segundo Cliente na mesma empresa, recusa da quinta vaga e revogação individual, preservando os demais vínculos. O inventário não ativou vagas nem enviou códigos.

A [migração individual](../supabase/proposals/hosted-access-pilot/individual-invites.sql) foi aplicada ao CALI MAPA em transação. Manteve duas matrículas, duas admissões e o corte de A. A ficha Admin exibiu as ações junto dos convites corretos. O gatilho adicional serializa ocupação só em A/B e protege a correspondência dos convites já matriculados. A [prova isolada](../supabase/proposals/hosted-access-pilot/test-invite-capacity.sh) usou duas conexões concorrentes e terminou com quatro convites ativos. Não matricular destinatários extras sem a etapa de provisionamento e homologação.

Se for preciso suspender ações, retirar `EXECUTE` de `authenticated` nas novas RPCs de revogação e reautorização por convite. Preservar a chave, a guarda de capacidade e os registros de corte. Não reativar as RPCs por empresa após permitir mais de um vínculo.

#### Ciclo de serviço A/B

A [transição de ciclo](../supabase/proposals/company-onboarding/transition-service-cycle.sql) foi aplicada ao CALI MAPA. Na ficha Admin, usar a ação do ciclo escolhido, confirmar e recarregar. O ciclo de novembro de A ficou encerrado com 12,5 h e dois eventos; B permaneceu aberto com 12,5 h. Planejado para aberto e recusas foram verificados em PostgreSQL descartável. Para suspender a escrita, retirar `EXECUTE` de `authenticated` na RPC `v2_transition_service_cycle(uuid,uuid,text,text)`. Preservar os estados e a auditoria; não desfazer ciclo por atualização em lote.

#### Cadastro complementar e convite novo

A [edição cadastral](../supabase/proposals/company-onboarding/update-pilot-registration.sql) usa os campos existentes em `companies`. A leitura exibe serviço e plano. No Admin de desenvolvimento, as duas empresas A/B permitem editar segmento, horas, endereço e filiais. A escrita verifica `updated_at` e registra os nomes dos campos alterados em `activity_log`. Segmento e cidade foram confirmados após recarga em B. Contato comercial, logo, troca de plano e condições contratuais precisam dos respectivos contratos hospedados.

O [SQL de reservas](../supabase/proposals/hosted-access-pilot/provision-invites.sql) está instalado com lista de destinatários vazia. A reserva privada ocupa uma vaga antes da criação do convite visível ao fluxo legado. Somente o papel de serviço pode preparar o login. Uma conta criada pela Edge é vinculada quando seu metadado corresponde ao identificador do convite. Cancelar antes do vínculo libera a vaga e preserva o registro. Uma identidade criada no intervalo entre reserva e cancelamento fica sem perfil ou acesso e exige reconciliação separada antes de reutilizar aquele destinatário.

Para a homologação, conferir um novo e-mail de teste e vincular a aprovação somente à empresa escolhida. Publicar a revisão da Edge com `CALI_PILOT_PROVISIONING=true` e abrir a ficha Admin de desenvolvimento com `VITE_CALI_PILOT_PROVISIONING=true`. Reservar uma vaga, pedir um código na aba Cliente, validar admissão e revogação individual com os demais vínculos como controle. Para suspender após ativação, desligar a flag da Edge e retirar os GRANTs das RPCs de reserva e preparação. Preservar o histórico.

Em 04/11, a versão 3 da Edge foi publicada pelo terminal, com verificação de JWT preservada. O Admin reservou A2 para um destinatário temporário aprovado. A2 entrou, confirmou o aceite e abriu a empresa A. A1 abriu a mesma empresa em sessão separada. Após revogar A2 pelo Admin, a recarga de sua aba foi bloqueada e a recarga de A1 manteve a empresa acessível. A leitura do banco confirmou que A2 perdeu acesso e que as sessões de A1 e B continuaram válidas.

Ao encerrar, a limpeza exigiu correspondência entre conta, metadado Auth, convite, reserva e destinatário temporário já revogado. A consulta confirmou zero contas, perfis, convites, reservas e permissões para A2, com as duas matrículas originais preservadas. A flag de provisionamento foi desligada. A homologação de arquivos após corte tem roteiro separado.

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

Vitest limita a execução a dois workers em `vitest.config.ts`. A rodada de 05/11 com concorrência automática abriu 33 workers e teve oito falhas de espera/timeout nas jornadas de UI. O limite reduz a disputa de recursos; os timeouts e as asserções permanecem inalterados. O conjunto continua executando todos os arquivos.

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

A ponte de OTP Partner usada em homologação tem uma exceção local de recarga, somente em Vite dev com ticket temporário. A recarga acontece após o SDK persistir a sessão e evita a disputa com o controlador Admin/Cliente. O canal não está publicado; a exceção não se aplica aos fluxos de produto.

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

## DISC V2 — piloto manual

`npm run disc:functions:build` gera bundle autocontido em `supabase/.temp/workspace-disc-pilot`; não inicia runtime, não envia e-mail e não faz deploy. `bash supabase/proposals/disc-3/test.sh` executa prova PostgreSQL descartável por socket Unix com limpeza; não inicia a bateria suspensa de Auth/Edge/Docker. O contrato detalha precondições e rollback: [DISC](contracts/DISC_3.md).

No CALI MAPA, `workspace-disc-pilot` versão 7 está ativa com JWT obrigatório, allowlist de dois destinatários e `config.enabled=false`. Felipe autorizou explicitamente a revisão de PDF após esclarecer a separação do plano de banco. As versões 2, 3 e 4 foram preservadas em artefatos locais ignorados sob `output/runtime/disc-deploy`; o retorno exige redeploy do código preservado, não alteração no banco. Conferência de retorno confirmou bundle remoto idêntico ao testado. Nenhum cron novo DISC está instalado. Não ativar agenda, migrar schema, alterar dados ou publicar a SPA por consequência desse deploy. O [contrato](contracts/DISC_3.md) registra provas e limites.

### Agenda DISC — preparação local e ativação separada

O CALI MAPA recebeu o incremento SQL e o worker v7 com JWT obrigatório. Vault e hash do JWT da agenda configurados. A agenda segue desligada. A chamada sem JWT recebeu HTTP 401. A comparação pós-migration confirmou as políticas, triggers, funções fora da RPC alterada e grants verificados. Os quatro registros concluídos na fila foram preservados. `bash supabase/proposals/disc-3/test-scheduler.sh` usa somente banco descartável, socket Unix e transportes sintéticos. O `verify` constrói o bundle sem executar worker, Auth, Docker ou envios. Frontend permanece no recorte funcional já homologado.

Preflight em leitura de 05/11/2026, 19h22 de Brasília: `pg_cron` 1.6.4, `pg_net` 0.20.4 e Vault 0.3.1 instalados; assinatura de `net.http_post` disponível. Não há cron DISC nem segredo `cali_disc_worker_bearer`. Worker v4 ativo com JWT obrigatório, flag desligada e incremento ausente. Os corpos das duas funções conferidas correspondem ao rollback versionado. Os grants da RPC permanecem exclusivos do papel servidor, sem uso direto do schema privado.

Dois destinatários na allowlist, duas campanhas abertas e quatro tarefas concluídas; nenhuma pendente, em trânsito ou elegível para retentativa. Projeção somente de leitura para 06/11 às 8h não apontou novos jobs; repetir a conferência antes de ligar. A [listagem de backups](https://supabase.com/docs/reference/api/v1-list-all-backups) retornou zero itens, sem metadados físicos e com PITR desativado. Não foi demonstrada restauração isolada, e a conexão de backup não está configurada localmente. Felipe dispensou backup para o lote posterior. O preflight foi somente leitura.

Em 05/11 Felipe autorizou uma execução de teste com desligamento logo após. A tentativa 170 chegou ao worker v5 e recebeu 403. O JWT do Vault tinha hash diferente da credencial interna usada pelo worker. A versão 7 compara o JWT recebido com o SHA-256 configurado em `CALI_DISC_SCHEDULER_BEARER_SHA256`, mantendo o hook privado e a verificação do gateway. A tentativa 171 teve execução do cron bem-sucedida e HTTP 200, com zero tarefas processadas, zero falhas e os quatro registros de fila preservados. O cron de teste tinha expiração de contingência de três minutos. A flag foi desligada e a agenda removida após a resposta.

Para a próxima janela aprovada no CALI MAPA, executar os passos 1 e 4 a 6. Os passos 2 e 3 documentam a instalação já concluída. Conferir também o [roteiro da Patrícia](HOMOLOGACAO_PATRICIA.md).

1. Em leitura, conferir projeto, dois destinatários autorizados, fila/tentativas em trânsito, grants efetivos, extensões `pg_cron`/`pg_net`, Vault, nomes de cron e preimagem de `kick()`/`v2_disc_worker`/configuração/código. Preservar versão 4 e histórico; não interpretar cópia de função como backup do banco.
2. Manter flag desligada; aplicar somente `supabase/proposals/disc-3/scheduler.sql` em transação. Publicar o bundle correspondente com `verify_jwt=true` e conferir hash/configuração. As alterações são independentes da SPA e não mudam o schema legado. Não reaplicar a criação inicial `candidate.sql`.
3. Configurar no Vault `cali_disc_worker_bearer` com o JWT legado de serviço aprovado para o agendador, por canal protegido. Configurar o SHA-256 desse mesmo JWT no ambiente do worker em `CALI_DISC_SCHEDULER_BEARER_SHA256`. Reconciliar ambos em caso de rotação. Não imprimir seu valor, usar `VITE_`, embutir em cron ou trocar por `sb_secret_*`. Conferir igualdade sem expor credenciais. Não há nova chave a gerar no frontend.
4. Reconciliar tarefas antigas e destinatários antes do primeiro consumo. Aplicar separadamente `scheduler-enable.sql`: verifica preparação, segredo JWT e exatamente dois destinatários, protege nome/comando/proprietário e instala `cali-v2-disc-pilot` a cada minuto. A transação não altera outras agendas. Reaplicação mantém uma agenda.
5. Com tarefa sintética autorizada, conferir `last_kick_at/last_request_id/last_kick_error`, execução do cron, status HTTP do request e recibo do provedor por job. Nunca registrar headers ou corpo sensível. Enfileiramento HTTP, resposta do worker e confirmação do provedor são três evidências distintas. Conferir uma retentativa e janela de horário sem repetir a bateria inteira. Sem tarefa elegível, ausência de envio não prova entrega.
6. Para interromper: `scheduler-disable.sql` primeiro. A flag impede novas reservas/envios automáticos nos pontos de rechecagem; HTTP já enviado ao provedor não pode ser desfeito. Conferir tarefas em trânsito e recibos antes de repetir. Processamento manual Admin continua independente.

Rollback de SQL: `rollback-scheduler.sql` já chama desligamento e restaura as funções originais, remove somente auxiliares/colunas novas e preserva campanhas, convites, respostas, revisões, eventos e jobs. Se a preimagem hospedada divergir da base versionada, reconciliar o rollback antes de aplicar o incremento. Retorno de código: publicar a preimagem preservada da versão 4 mantendo JWT obrigatório e agenda desligada. Não revogar uma chave compartilhada com outros serviços por consequência do rollback; o segredo Vault deste recorte pode ser retirado após conferir seus consumidores.

Referências oficiais consultadas: [pg_net, assinatura e execução após commit](https://supabase.com/docs/guides/database/extensions/pg_net), [cron nomeado e desligamento](https://supabase.com/docs/guides/cron/quickstart). O desenho usa o JWT legado exigido pelo gateway. A prova hospedada confirmou cron, transporte e autenticação com fila vazia. A entrega de e-mail pelo cron exige uma rodada com tarefa elegível e destinatário aprovado.

## Prova local do build e das URLs

O build servido pelo Vite em loopback respondeu HTTP 200 com o mesmo HTML de entrada para `/`, `/admin/projetos`, `/admin/horas`, `/cliente/relatorios` e `/auth/callback`. Os ativos JavaScript e CSS referenciados pelo HTML também responderam com seus tipos de conteúdo. O callback ainda exige prova de sessão no domínio de homologação. As áreas piloto de Equipe, DISC e fase 4 continuam condicionadas à configuração de desenvolvimento.

O JavaScript inicial passou de 1.061,90 para 926,16 kB antes de gzip e de 306,88 para 275,20 kB após gzip. O CSS inicial passou de 141,15 para 14,68 kB antes de gzip. O Vite continua sinalizando o tamanho do JavaScript principal. No build de demonstração separado, o navegador abriu Admin e carregou Cliente pelo botão de troca. Reverter os imports sob demanda restaura o empacotamento anterior.

A preparação do ambiente de homologação ainda exige domínio de teste protegido, fallback para URLs diretas, origens e redirects conferidos, callback autenticado, observabilidade e separação operacional de staging e produção. Registrar os resultados no [roteiro de homologação](HOMOLOGACAO_PATRICIA.md).


## Candidata da V2 para o domínio de produção

A opção `VITE_CALI_RELEASE_CORE=true` conecta edição da própria conta, notificações próprias e resumo global da carteira Admin no build publicado. A configuração exige o projeto CALI MAPA e a origem exata `https://app.calirh.com`. A carteira global funciona sem carregar a área piloto de Projetos. As notificações mostram os atalhos de detalhe somente quando a rota correspondente estiver disponível. A flag controla a composição do frontend. Os contratos do servidor continuam responsáveis por sessão, papel, aceite e vínculo. A configuração padrão mantém a opção desativada.

Na Visão executiva, o resumo global tem consulta e recuperação independentes da lista de empresas. A regressão local cobre as duas respostas da listagem, com e sem falha, sem acesso ao ambiente publicado.

A conferência em leitura de 09/11/2026 encontrou:

| Superfície | Evidência | Trabalho antes de ativar |
| --- | --- | --- |
| Site atual | O domínio respondeu pelo Vercel e serviu `index-D3-QXOYI.js` com referência ao CALI MAPA. O arquivo `report-print-ready-v64.js` bate com o blob de `app.cali@773c9d4`. O GitHub da V2 não listou deploys. | Identificar o projeto e a revisão que receberão a V2 no Vercel. Registrar o deploy atual como alvo de rollback. |
| Catálogo de dados | Os 180 nomes de RPC chamados literalmente nos adaptadores inventariados estão nos schemas `cali_workspace` ou `public`. Perfil próprio, notificações, Equipe e carteira Admin têm execução autenticada e recusam o papel anônimo no catálogo. As quatro RPCs abertas correspondem a superfícies públicas do DISC, proposta e formulário. | Confirmar as permissões e o comportamento com sessões reais antes da ativação. Equipe ainda exige vínculo com a lista de empresas do piloto. Sua liberação operacional requer contrato de servidor e validação próprios. |
| Acesso e rotas | `workspace-access` aceitou o domínio no preflight CORS. `/admin/equipe`, `/cliente/perfil` e `/auth/callback` responderam HTTP 200 com o HTML da publicação atual. Auth tem Site URL em outra origem e o callback da V2 não consta como entrada exata na lista de redirects. | Conferir a entrada existente com wildcard, definir o redirect exato sem interromper o fluxo atual e provar login, MFA e callback no build candidato. |
| Edge e canais | Acesso piloto, PDF privado piloto e DISC piloto responderam 403 para o domínio. PDF executivo, OTP QA de Partner, e-mail Comercial, devolutiva do Mapa e worker de resumo Admin responderam 404. | Preparar somente as funções necessárias ao rollout, com origem exata, JWT conforme o contrato e teste controlado. OTP QA, simuladores e agendadores de teste ficam fora da configuração de produção. |

O inventário conferiu metadados e preflight HTTP. O funcionamento com sessão real e a revisão efetivamente publicada da V2 ficam para o lote de validação. Reverter a composição candidata removendo `VITE_CALI_RELEASE_CORE` e reconstruindo o frontend, ou reapontando para o deploy anterior se a candidata já estiver publicada. Nenhum SQL, flag remota ou deploy foi aplicado neste lote.

## Preview protegido para homologação

A rodada anterior usou localhost conectado ao CALI MAPA e a conferência externa ficou com Felipe. O roteiro a seguir se aplica ao preview futuro da homologação separada, após validar os ajustes na produção atual.

A primeira dependência externa é identificar o projeto da V2 no provedor e reservar a origem HTTPS de preview com proteção de acesso. O repositório não listou deployments no GitHub nesta conferência. A árvore local não possui vínculo com o projeto Vercel. O painel integrado do Vercel exigiu login. O endereço publicado usado como referência visual não serve como destino de staging. O build local respondeu com o HTML de entrada em seis rotas, incluindo Minha conta Admin/Cliente, Projetos, Documentos e callback. Os ativos JavaScript e CSS também responderam. Essa prova cobre o fallback HTTP, sem autenticação no domínio externo.

| Ordem | Preparação | Prova esperada |
| --- | --- | --- |
| 1 | Vincular a revisão candidata do PR ao projeto de preview. Habilitar proteção no provedor e conceder acesso somente aos participantes autorizados. | Uma sessão sem autorização recebe a tela de proteção antes de carregar a V2. Produção e preview têm URLs distintas. |
| 2 | Fixar a URL HTTPS exata e apontar o preview para o projeto separado de homologação. Configurar somente URL e chave pública no frontend. | Sem fallback para o banco de produção. URL direta recebe o HTML da V2 e mantém o caminho original. |
| 3 | Adaptar os gates de loopback dos módulos e autorizar a origem exata nas funções usadas. Conferir Acesso Admin, Acesso A/B, PDF privado, PDF executivo e DISC. Alinhar redirects de Auth e links emitidos pelas funções. | Login e MFA, convite de teste, aceite, callback e download funcionam na origem definida. Um domínio fora da lista é recusado. |
| 4 | Executar a regressão interna da revisão candidata em 375 e 1366 px. Preparar atores e dados sintéticos. Manter desligados os agendadores e fluxos de envio que não fazem parte da rodada. | Perfil, isolamento A/B, operação, PDF e rollback têm evidência na mesma revisão. A Patrícia recebe acesso apenas após o fechamento interno. |

Reversão do preview: retirar a revisão candidata e remover sua origem dos redirects e das funções configuradas no projeto de homologação. [Roteiro de homologação](HOMOLOGACAO_PATRICIA.md).
