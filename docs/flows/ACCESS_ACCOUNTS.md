# Acesso, contas e propostas

Fichas FLOW-01/02/03. Estado: observado estaticamente com divergências registradas. Validação/estados comuns: [contrato comum](README.md). Permissões: [matriz](../PERMISSIONS.md).

## Alvo V2 confirmado em 26/10/2026

Referência: [publicação 83](../BASELINE_REFERENCE_2026-10-26.md), [regras de produto](../PRODUCT_RULES.md) e [informação sobre dados no acesso](../DATA_PRIVACY.md). Textos de uso/privacidade devem estar consultáveis; registrar versão/confirmação conforme DEC-08, sem inventar prazo de guarda ou declarar gate já implementado.

- **DEC-05:** até quatro acessos Cliente equivalentes por empresa, sem cadastro principal como hierarquia de acesso. Todos podem manter Equipe; revogar um não exige substituir principal nem deve retirar direitos dos demais.
- **DEC-08:** adesão registrada antes do convite; termos obrigatórios no primeiro acesso e em nova versão. Falha ao comprovar aceite bloqueia a entrada e oferece recuperação/retry; não repetir o fail-open observado no oficial.
- Contato comercial e papel/permissão de login são conceitos distintos. Dependências legadas de `is_primary` precisam ser inventariadas, sem remover campos ou alterar contratos agora.

As tabelas abaixo continuam descrevendo fontes oficiais, inclusive a guarda antiga de principal. O alvo é o contrato de construção futuro, não mudança aplicada ao backend.

## Contratos mínimos reconciliados — 28/10

[Contratos de acesso/empresas](../contracts/ACCESS_COMPANIES.md) detalham payloads, projeções, códigos de erro, fontes e lacunas por operação. Schemas de fronteira existem, sem service/Auth conectado. DEC-21 fecha MFA obrigatório Admin, incluindo primeiro uso e bloqueio em falha; tabelas de evidência abaixo preservam as exceções observadas no oficial. DEC-22/25 definem laboratório executado e prova do recorte de adesão em 29/10. Não considerar contratos totalmente fechados: corpo de create_client_account, DDL de códigos, termos/sessão e predicados dos demais domínios ainda exigem implementação/reconciliação.

## Persistência local verificada — 29/10

No laboratório, Admin ativo com AAL2 e fator TOTP verificado registra adesão por RPC; empresa/referência vêm da request, autoria/instante do servidor. Referência vazia, autoria extra, escrita direta, Cliente A/B, Admin inativo/sem MFA e fator removido são negados; histórico não pode ser reescrito/apagado. [Contrato e limites](../contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910). Frontend permanece desconectado; convite, comprovação documental, aceite individual e sessão completa continuam pendentes. Tabelas abaixo preservam a evidência histórica do oficial.

## Códigos/termos e estado no servidor — 29/10

Edge local e banco implementam código/limites/consumo, troca por sessão Auth, versões/aceites e revogação; [contrato detalhado](../contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910). Sessão e guardas do frontend estão preparadas por injeção; adapter/eventos/telas reais ainda pendentes. Textos de teste são sintéticos e não aprovam conteúdo jurídico. A referência histórica abaixo não descreve o runtime novo.

## Integração hospedada e comparação — 01/11

DEC-27 autoriza dados sintéticos no backend existente. A V2 tem SDK/adapter, eventos/revalidação, guardas, telas de código/MFA/termos/callback e leitura real de empresas/acessos. Usuário concluiu a jornada Admin/aceite e chegou às quatro empresas do banco. Busca, detalhe de A e limpeza de filtros foram observados na V2; primeiro enrollment MFA, callback e refresh/expiração da SPA ativa precisam de evidência por cenário. A existência da tela não encerra esses testes.

Clientes A/B concluíram login/aceite; API direta retornou somente empresa/perfil próprios, negando empresa/perfil/convites alheios. Rota Admin redirecionou ambos para Cliente. Logout de ambos limpou sessão local; Auth recusou JWT/refresh antigos, porém a API do banco ainda leu a própria empresa com JWT não vencido. Inativação/restauração de A também recuperou a sessão anterior. **Corte no servidor permanece bloqueio da fase 1**; nenhum ajuste de policy/schema foi executado. Expiração natural dos JWTs A/B comprovada (banco 401/PGRST303); refresh/expiração da SPA ativa permanece pendente. Resultados e limites no [ambiente](../LOCAL_ENVIRONMENT.md#rodada-cliente-ab--0111).

Corte proposto e limites em [contrato de servidor](../contracts/ACCESS_COMPANIES.md#correção-do-corte-no-servidor--candidata-não-aplicada): sessão vigente, marcos de revogação e restritivas das quatro tabelas, sem aplicação. Na referência, convite ativo pode reativar perfil pelo login; reconciliar esse caminho antes da revogação completa, sem reproduzir a ativação silenciosa como regra aprovada.

Foco/intervalo desmontavam o formulário de código antes do login; corrigido no controller para preservar snapshots resolvidos durante revalidação. Teste assíncrono reproduziu no código anterior e passou após correção. Logout/troca de identidade continuam invalidando cache/rota. Auditoria dos códigos: quatro pedidos A/três B; novos envios suspensos.

O aceite inicialmente falhou antes do POST por receber conteúdo/título além do payload estrito `version/contentHash`. Corrigido no consumidor; teste verifica transição após confirmação e permanência no bloqueio quando a gravação falha. Aceite real foi concluído pelo próprio usuário, sem inserir registro fora da UI.

Comparação com `/admin/clientes` online: mesmas quatro empresas e situação ativa. O online exibe dois acessos habilitados nas duas fixtures, mas há um vínculo de teste em cada uma. Fonte `AdminClientsPageV3.tsx`, blob `46265a2723530f10d26f81a4d1d86a5e8004277d`, linha 477, calcula `1 + extras habilitados`, mesmo sem principal. V2 lista vínculos recebidos, sem adicionar um acesso fictício. Não transportar essa soma para o limite de quatro equivalentes. Campos de contrato/horas/NPS/Drive, edição/ciclo e navegação global existem no online e ainda não foram migrados para o shell conectado; permanecem no escopo das fases, não foram removidos do produto.

Termos hospedados permanecem na versão oficial 2026-10-15; redação de principal/campos privados precisa da reconciliação indicada no [contrato vigente](../contracts/ACCESS_COMPANIES.md#integração-hospedada-vigente--0111). Baseline local não foi aplicada no hospedado. Ver [ambiente/evidências](../LOCAL_ENVIRONMENT.md#backend-hospedado--dec-27).

## Continuidade de 02/11 — FLOW-01

A cópia da referência executou 40 verificações locais e revelou hash Auth pendente capaz de gerar sessão após corte/reativação. Correção de código troca o hash dentro da Edge e devolve sessão somente após admissão vinculada à origem do código; complemento SQL exige essa admissão após marcos de corte. Código implementado, novos SQLs não executados nem aplicados no hospedado. Cliente mantém compatibilidade com a Edge hospedada legada, que continua pendente de correção. Bateria de runtime suspensa pelo Felipe; [mecanismo, contratos e limites](../contracts/ACCESS_COMPANIES.md#correção-local-da-troca-e-admissão--0211).

## Consolidação técnica de 02/11 — FLOW-01/02

Acesso foi decomposto em código, MFA e termos, com coordenação de sessão/callback/enrollment/aceite em hooks. Empresas separa filtros, tabela, painel, formulários, linha e histórico; URL/cache e ciclo dos rascunhos continuam com os mesmos donos. Mensagens por motivo e labels usam mapas tipados; checkbox e feedback têm primitivas DS. Reorganização não adiciona operação de servidor, não libera capacidade hospedada, não muda destinatários/payloads e não retoma a bateria suspensa. Paridade e limites de validação ficam no changelog.

## FLOW-01 — Convite, código, sessão, MFA e aceite

**Objetivo/atores:** pessoa autorizada acessa o workspace adequado como Cliente ou Admin. Empresa e papel vêm do perfil; não da seleção demonstrativa da V2. Adesão comercial e aceite de uso são eventos diferentes.

**Fontes:** [login EDGE](SOURCES.md#login), [sessão](SOURCES.md#auth), [troca do token](SOURCES.md#supabase), [guardas](SOURCES.md#route-guard), [MFA SQL](SOURCES.md#mfa), [predicado Admin posterior](SOURCES.md#admin-predicate), [MFA UI](SOURCES.md#mfa-ui), [termos UI](SOURCES.md#terms), [versão legal](SOURCES.md#legal), [RLS de aceite](SOURCES.md#terms-sql), [bloqueio de conta](SOURCES.md#access-close).

**Entrada/dados/composição:** `/login`, e-mail e código de seis dígitos; callback de autenticação; fluxo Admin de autenticador; conteúdo legal versionado e checkbox para Cliente. Sem cadastro de senha neste caminho. EDGE procura perfil/convite ativo e pode provisionar usuário/perfil. Criação/reativação deve ser lida junto dos triggers de conta encerrada.

| Anterior | Ação e ator | Guarda localizada | Seguinte/efeito observado |
| --- | --- | --- | --- |
| Sem código | Solicitar, Cliente/Admin | E-mail elegível; uma solicitação em dois minutos | Código com validade de dez minutos; solicita envio externo; e-mail não localizado não deve ser revelado |
| Código pendente | Verificar | Seis dígitos, não usado, não expirado, menos de cinco tentativas | Incrementa tentativa; se correto marca usado e gera token hash de magic link |
| Token recebido | Cliente do app verifica token | Resultado de `verifyOtp` | Sessão Supabase; carregamento de `profiles.role/active` |
| Perfil ausente/inativo | Entrar em rota protegida | Guarda UI exige usuário, papel e ativo | Redireciona para login; papel diferente redireciona para sua home |
| Admin autenticado | Cadastrar/verificar MFA | UI consulta fatores/nível; SQL exige AAL2 se já há fator verificado | Acesso administrativo conforme predicado; UI possui caminhos de erro que deixam seguir |
| Cliente sem aceite corrente | Aceitar | Versão `2026-10-15`, canal legal preenchido, fora de QA; checkbox antes de gravar | Insere `terms_acceptances`; libera UI após confirmação |
| Cliente ao consultar aceite | Consulta falha | `found.error` no TermsGate | UI libera acesso; não há comprovação de bloqueio jurídico no backend |
| Sessão ativa | Sair | Ação explícita | `signOut` e login; estratégia de cache da V2 ainda não implementada |

**Continuidade/falhas:** retorno por papel; não documentado um retorno universal ao destino anterior ao login. Verificação de código tem resultado explícito; envio de boas-vindas pode falhar sem impedir entrada. Marcar convite como aceito nessa função não demonstra leitura/aceite jurídico nem entrega do e-mail. Não repetir automaticamente verificação já consumida.

**Aceite proposto:** testar código incorreto/expirado/usado/limite; perfil inativo; empresa bloqueada; acesso direto cruzado Cliente/Admin; AAL1/AAL2; erro de consulta de termo; sair sem dados remanescentes. Testes reais dependem de ambiente isolado.

**Dúvidas:** `REF-01` (MFA e identidade administrativa não uniformes), `REF-02` (gate jurídico fail-open e adesão), `REF-03` (reativação/convites). Não transformar fallback encontrado em padrão desejado da V2.

## Recorte 2A autorizado — cadastro, adesão e quatro acessos

**Código implementado na demonstração, 02/11:** continuar sem depender do catálogo e sem retomar runtime suspenso. Na composição demonstrativa, Admin pode cadastrar identidade mínima da empresa sem criar contato/perfil/convite, registrar referências de adesão em histórico e gerir até quatro autorizações equivalentes. Esse transporte é exclusivamente virtual/em memória; nenhum novo endpoint/RPC hospedado será presumido.

**Jornada/aceite do recorte:** cadastro começa por ação explícita e abre a empresa criada pela URL após confirmação; empresa nasce sem acessos. Registrar referência não comprova documento nem aceite jurídico. Sem registro de adesão da mesma empresa, criação/reativação de acesso fica bloqueada no modelo demonstrativo. Todos os acessos contam pelo mesmo critério; o quinto ativo é recusado também na fronteira de dados. Revogar preserva registro/histórico e demais acessos; reautorizar é explícito e respeita o limite. E-mail existente não é reatribuído por edição de nome. Nenhum envio/provisioning Auth ocorre; permissões simuladas não revogam sessões reais.

**Continuidade:** formulários inline com Button/Field/tokens, validação, foco, cancelamento, erro mantendo rascunho, ação pendente bloqueada e confirmação de revogação. Troca de empresa limpa estado transitório; URL é dona da seleção, Query invalida leitores do ator. Histórico registra autoria/instante sintéticos na fronteira mock, sem campos de autoria aceitos da UI. Identidade de solicitação protege repetição dos novos comandos virtuais, sem prometer idempotência hospedada.

**Limites:** no hospedado, essas capacidades continuam indisponíveis até reconciliar cadastro, adesão e manutenção atômica dos acessos. Leitura e edição básica existentes permanecem na composição conectada. Testes do modelo/UI e QA demonstrativo foram executados; SQL/Auth/laboratório suspensos não foram executados. Gate/evidências no changelog.

## Próximo recorte 2A — ficha administrativa da empresa

**Código implementado somente na demonstração:** depois da identidade mínima, permitir ao Admin demonstrativo consultar/editar a configuração contratual, financeira e referências documentais da empresa selecionada. Fonte de campos/opções: `AdminClientsPageV3.tsx` da publicação 83, cadastro linhas 525–558 e manutenção linhas 573–575, consultados somente em leitura. Não copiar efeitos de ativação de conta/perfis ou automações da implementação de referência.

**Anatomia e continuidade:** ficha de consulta e ação explícita para editar; formulário inline dividido em Contrato, Financeiro e Documentos, sem context global ou uma página monolítica. Um único snapshot/revisão protege a gravação da ficha; rascunho não é substituído por refetch. Cancelar não grava; conflito mantém rascunho e exige descarte/reconsulta explícitos; troca de empresa desmonta o editor. Histórico append-only com autoria/instante sintéticos na fronteira mock. Leitura, erro, vazio, pendente, foco e mobile têm regressões locais e QA registrados no changelog, sem homologar o servidor.

**Limites:** campos de início/término, tipo/modelo, renovação e cláusula/base/parâmetro de multa; valor/recorrência/método/vencimento/aviso/prazo/multa/juros/observações; URL de pasta, responsável e observações documentais. Números não aceitam agrupamento ambíguo; datas civis e término anterior ao início são validados. Configuração não gera cobrança, projeção financeira ou distrato; referências não são abertas automaticamente nem comprovam documento/assinatura/adesão. Logo, serviço/plano/horas, endereço/filiais e contato comercial foram acrescentados no recorte demonstrativo de 03/11 abaixo; uploads de contrato/aditivo, comprovação, financeiro operacional e ciclo permanecem lacunas explícitas. Hospedado mantém capacidade indisponível; nenhum catálogo/runtime/SQL é necessário para este transporte virtual.

## Recorte 2A — dados restantes do cadastro, 03/11

**Implementado somente na demonstração, autorizado pelo Felipe:** serviço/plano, horas, segmento, endereço/filiais, contato comercial e logo na demonstração. Fonte: cadastro/manutenção da publicação 83, `AdminClientsPageV3.tsx` blob `46265a2723530f10d26f81a4d1d86a5e8004277d`; preparo de imagem em `src/lib/imageUpload.ts` da mesma referência, consultados somente em leitura. Contato comercial não vira usuário/principal; nenhuma alteração de contato concede, revoga ou reativa acesso. Salvar serviço padrão atualiza somente o plano demonstrativo correspondente, sem configurações automáticas de agenda; serviço sem plano mapeado preserva o plano anterior, como a edição observada.

**Jornada:** dados gerais separados de identidade e ficha financeira, revisão/histórico próprios, um rascunho por empresa, salvar/cancelar explícitos, erro/conflito preservando o rascunho e descarte/reconsulta. Segmento livre e filiais por linha preservam texto/ordem, sem consulta externa. Logo é preparada localmente, com prévia/substituição/remoção no rascunho; limites da referência (12 MB de entrada, 1200 px e 700 KB de saída). SVG será rasterizado localmente antes de armazenar na memória; não há upload/storage. Troca de arquivo/empresa e unmount descartam resultado tardio. Não migrar formatos/efeitos remotos implicitamente.

**Cenários cobertos localmente, sem homologar backend:** tabelas coerentes após mudança de plano, Build Essencial/Completo sem perda da identificação, decimal/vazio, endereço/filiais, contato sem efeitos Auth, repetição/revisão concorrente/histórico, falha/pending/cancelar/descartar, logo válida/inválida/remoção/resultado tardio e responsividade/foco. Hospedado permanece sem capacidade; arquivos contratuais, comprovação, financeiro/ciclo reais e bateria suspensa ficam fora deste lote.

## Recorte 2A — arquivos contratuais e comprovação, 03/11

**Implementado na demonstração:** contratos/aditivos com arquivo e data opcional, versões preservadas, download explícito e retirada administrativa com motivo; tudo exclusivamente em memória. Fonte de tipos/data: publicação 83, `AdminClientsPageV3.tsx`, uploadDocument e cadastro documental. Retirada não elimina bytes/histórico; versão nova não sobrescreve anterior. Limite técnico da demonstração: 12 MB por arquivo, PDF/DOC/DOCX e imagens aceitas; metadados e impressão SHA-256 identificam os bytes recebidos. Não interpretar o conteúdo, publicar ou marcar assinatura validada por inferência.

**Comprovação administrativa implementada no segundo lote:** referência de adesão continua independente do arquivo e do aceite individual. Admin demonstrativo registra conferência explícita da referência, observação e, opcionalmente, versão documental exata; sem impor upload obrigatório (DEC-23). Conferência não é assinatura digital/verificação jurídica. Apenas conferência vigente sustenta novas autorizações/reativações no mock; retratação, retirada ou troca da versão vinculada exigem nova conferência, sem revogar automaticamente os acessos existentes. Autoria/instante são sintéticos na fronteira de dados. Nenhum convite/Auth ou baseline/contrato hospedado foi alterado.

**Frontend/aceite:** painel/lista, anexação/versionamento, retirada, download e conferência separados por tarefa/hooks; erros mantêm rascunho, pendente bloqueia duplicação, troca de empresa descarta transitórios/resultados tardios; foco e mobile preservados. Provar repetição, concorrência, vínculo por empresa, arquivos/versões imutáveis, retirada, falha de transporte e gate na fronteira mock. Bateria suspensa permanece intocada; backend/storage/assinatura/retenção reais continuam pendentes.

## Recorte Cliente 2A — consulta da própria empresa, 03/11

**Implementado no código, sem nova prova hospedada:** substituído o aviso único da composição conectada por navegação de Início, Minha empresa e Termos e privacidade. Consulta mínima de identidade (id, nome de apresentação, razão social e situação) na tabela companies existente; vínculo vem exclusivamente do perfil autenticado, nunca de search params. Publicação 83 e contrato de leitura já reconciliado sustentam essa projeção; não transportar notas/comprovações internas, financeiro ou gestão de acessos ao Cliente.

**Tarefa/aceite:** Cliente com sessão ready consulta a própria empresa, inclusive pausada, lê a versão jurídica corrente já usada no acesso e retorna pelo menu/Back/Forward. Sem aceite novo ou data fabricada. Loading, falha com retry, linha ausente, retorno divergente, vínculo/papel alterados e encerramento de sessão não mantêm dados anteriores visíveis. Conta indisponível não exibe identidade retornada e oferece revalidar acesso. Rotas de outros módulos informam indisponibilidade por módulo, sem métricas fictícias.

**Banco e limites:** composição hospedada usa GET autenticado e projeção mínima já existente, sem fallback de erro para fixtures; não exige nova fase ou migration. Demonstração legada é explícita e permanece separada. Escritas de cadastro/arquivos/comprovação/acessos continuam sem contratos/permissões efetivos e com management null. Não remover mocks de testes nem habilitar transporte por flag. QA do navegador com transporte sintético não equivale a nova prova hospedada de RLS; códigos/Edge/laboratório e bateria suspensa permanecem intocados.

## FLOW-02 — Conta, contrato, acessos e ciclo de vida

**Estado V2 em 27/10:** `/admin/clientes` consulta três empresas e acessos sintéticos por módulo/hook, com filtros e seleção na URL. Quatro acessos equivalentes aparecem na fixture inicial, sem conta principal. Isso prepara a interface/contrato local; não implementa cadastro, adesão, convite, revogação, autenticação, persistência ou limites no servidor. Demais transições abaixo descrevem referência/alvo a portar, não comportamento já entregue. Ver [arquitetura](../ARCHITECTURE.md) e [runbook](../RUNBOOK.md).

**Recorte 2A de 02/11:** ficha e código passaram a incluir leitura/edição de nome de apresentação e razão social da empresa existente. Ator Admin; entrada pela seleção da empresa na URL; tarefa termina somente com linha confirmada pelo servidor e atualização dos leitores. PATCH condicionado aos nomes originais evita sobrescrever alteração concorrente nesses campos. Razão social vazia acompanha o nome, como na referência. Cancelar não grava; erro mantém rascunho e oferece descarte/reconsulta explícitos; troca de empresa desmonta o rascunho anterior. Formulário inline usa Button/Field/tokens e uma coluna no mobile. Nenhum convite, plano, contrato ou ciclo é alterado. Testes locais cobrem transporte/UI; persistência/RLS hospedadas dessa escrita não foram homologadas. [Contrato e pendências](../contracts/ACCESS_COMPANIES.md#fase-2a-iniciada--edição-básica-da-empresa-0211).

**Objetivo/atores:** Admin cadastra/manutenção de conta e configura contrato/acessos; Cliente consulta contexto autorizado. Rotas `/admin/clientes` e páginas cliente relacionadas. Fontes: [cadastro UI](SOURCES.md#accounts), [contato principal](SOURCES.md#contact), [limite/status](SOURCES.md#access-limit), [triggers de encerramento](SOURCES.md#access-close), [definição ausente](SOURCES.md#account-missing), [schema/RLS](SOURCES.md#schema), [frentes](SOURCES.md#fronts).

**Entrada/dados/composição:** Admin usa etapas Dados, Decisores/acessos, Contrato, Financeiro e Documentos; manutenção inclui Operação, Frentes, Agenda, Comunicações e Histórico. Campos incluem empresa/contato/e-mail, plano/capacidade, vigência, condições comerciais, documentos, acesso e automações. Valores de fixtures não são contrato. Perfil cliente não recebe escrita genérica em `companies`, `profiles` ou `client_invites` pelas policies iniciais.

| Anterior | Ação Admin | Guarda/evidência | Seguinte/efeitos |
| --- | --- | --- | --- |
| Não cadastrada | Criar | UI valida e chama `create_client_account` | Atualiza empresa como `active`, contato, acessos e arquivos em chamadas posteriores |
| Conta existente | Editar | RLS Admin; contato principal por RPC | Atualiza cadastro/contrato; upload, convites e histórico são operações separadas |
| Acesso adicional | Habilitar/desabilitar | `platform_access`, `active`; limite SQL de quatro convites ativos por empresa | Upsert de convite; revogação tenta desativar perfil correspondente |
| Estado atual | Pausar | Ação UI e motivo | `paused`; app mantém perfis ativos e documenta consulta permitida |
| Estado atual | Bloquear | Ação UI/motivo | `blocked`; trigger desativa perfis cliente |
| Estado atual | Encerrar | Data/motivo e projeção UI | `closed`, `closed_at`, dados de encerramento; trigger desativa perfis; pode enfileirar comunicação |
| Estado atual | Arquivar | Ação UI | `archived`; trigger desativa perfis; não significa eliminação de dados |
| Estado não ativo | Reativar | Ação UI | `active`; app tenta reativar perfis cliente da empresa |

Fonte exibe essas ações, mas não estabelece uma máquina SQL restrita de todos os estados de origem. Não inventar transições proibidas. Status de empresa, vigência contratual, acesso e eliminação são dimensões distintas.

**Ciclo de serviço na V2, recorte A/B:** é separado do status da conta e do encerramento de contrato. Na ficha Admin, cada ciclo exibe mês, horas e situação. A próxima ação disponível exige confirmação: planejado para aberto, aberto para revisão, revisão para encerrado. A referência de dados define os quatro estados; a sequência é contrato novo do piloto, sem reabertura neste recorte. Cancelar não grava; a confirmação usa a situação apresentada. Sem horas positivas ou empresa ativa, planejado não abre. Em erro, a ficha relê o servidor; ao fechar, não recalcula horas, não altera outro ciclo e não gera cobrança ou comunicação.

**Continuidade/falhas:** lista com busca/filtro; ficha por abas e modal de confirmação de ciclo de vida. Cancelar antes do submit não grava. Criação/edição faz múltiplas chamadas; falha intermediária pode deixar gravação parcial. UI reativa perfis em lote: não inferir que preserva revogações individuais. Corpo de `create_client_account` não está versionado, apenas comentário de correção posterior.

**Aceite proposto:** limite de acessos, alteração de contato sem trocar empresa, pausa distinta de bloqueio, sessão existente após encerramento, erro após criar conta antes de anexar contrato, reativação sem conceder acesso indevido. Eliminação/exportação: FLOW-18.

**Dúvidas:** `REF-03`, `REF-04` (corpos ausentes), `REF-05` (atomicidade/reativação), `OPEN-02` (adesão comercial). A migration de quatro acessos contrasta com PRODUCT_RULES antigo de acesso principal único; só `is_primary` recebe certas escritas de Equipe.

## FLOW-03 — Proposta comercial e oportunidade

A V2 homologou a criação com preço sintético, edição, aprovação, envio autenticado no Workspace e aceite pelo destinatário inscrito. A calculadora CALI Build foi homologada no staging. Demais serviços, entrega do PDF por e-mail e prova hospedada do aceite por link externo permanecem pendentes. [Fluxo autenticado](../contracts/PHASE_4_READ.md#criação-envio-no-workspace-e-aceite-no-staging) e [calculadora e e-mail sintético](../contracts/PHASE_4_READ.md#calculadora-cali-build-e-e-mail-sintético).

**Objetivo/atores:** Admin trata oportunidade, calcula/edita proposta, revisa e envia. Destinatário comercial não é automaticamente usuário Cliente. Fontes: [tipos/transporte Portal](SOURCES.md#portal), [editor](SOURCES.md#proposal-ui), [rotas](SOURCES.md#routes).

**Entrada/dados/composição:** `/admin/propostas`, editor por `submissionId` e preview por `proposalId`; dados de briefing, pacote, preço/base, extras, desconto, vigência/validade, escopo, condição e destinatário. Origem `public.cali_submissions/cali_proposals/cali_pricing_rules/cali_activity`, distinta de `cali_workspace`.

| Anterior | Ação | Guarda/camada | Seguinte ou limite de comprovação |
| --- | --- | --- | --- |
| Briefing recebido | Analisar/editar Admin | UI protegida, transporte exige sessão | Oportunidade tem enum `novo/analise/edicao/aprovada/enviada/negociacao/fechada/recusada/expirada` |
| Nova proposta | Salvar Admin | Payload tipado no cliente | `rascunho`, com versão; POST/PATCH no schema `public` |
| Rascunho | Aprovar/revisar Admin | Guarda do editor | Estado de proposta `aprovada`; não confundir com aceite comercial externo |
| Aprovada | Enviar Admin | Chama `portal-send-proposal` com PDF/destinatário | Tipos contemplam `enviada`; implementação da Edge Function não localizada neste repo |
| Enviada | Aceitar/recusar/expirar | Enum contém `aceita/recusada/expirada` | Caminho efetivo, ator e guardas desse aceite não comprovados na fonte coletada |

Enums de status não constituem uma máquina de transição autorizada. Não afirmar que qualquer proposta pode mudar para qualquer estado nem que seu envio cria conta/contrato.

**Continuidade/falhas:** editor/preview e seleção de oportunidade; contratos de retorno e rascunho devem ser preservados no recorte da V2. Erro HTTP aparece no transporte. Atomicidade de PDF, status, atividade e envio não comprovada; idempotência de envio desconhecida.

**Aceite proposto:** manter valor/versão já aceita; separar aprovação interna e aceite do destinatário; validar cálculo e mudança de versão; impedir envio duplicado; testar acesso Cliente negado à gestão Admin. Estes testes não foram executados.

**Dúvidas:** `REF-06` (Portal sem políticas/servidor no repositório). Não reconstruir permissões/calculadora a partir somente dos tipos TypeScript.
