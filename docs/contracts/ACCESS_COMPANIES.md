# Contratos mínimos de acesso e empresas

Atualização: 03/11/2026. Recorte da fase 1, FLOW-01/02. **Baseline local testada em 29/10; adapter/telas da V2 conectados ao hospedado em 01/11, com jornada autenticada ainda em validação.** Transições e experiência continuam na [ficha](../flows/ACCESS_ACCOUNTS.md); matriz em [Permissões](../PERMISSIONS.md).

## Integração hospedada vigente — 01/11

DEC-27 autoriza dados/atores sintéticos no backend hospedado existente, sem publicação da V2 ou aplicação da baseline local. `access/api.ts` adapta Edge, Auth/MFA, perfil, empresa e aceite legados; `access/service.ts` agrega o estado com validação de identidade/vínculo e falha bloqueante. A agregação é guarda frontend, não nova RPC nem comprovação de uniformidade das policies hospedadas.

- Sessão é persistida/renovada pelo SDK em namespace próprio da V2. Logout/troca de identidade invalidam acesso e cache; eventos do mesmo ator revalidam sem desmontar a etapa; refresh de token, foco/visibilidade e intervalo de 60 segundos revalidam o servidor. Mesmo ator/contexto válido mantém cache e formulário; troca, bloqueio ou erro de verificação limpam o cache. Chamadas atrasadas não restauram estado anterior.
- Admin exige nível AAL2 e fator TOTP verificado na UI, inclusive primeiro uso; erro bloqueia. Enrollment depende de ação explícita; recuperação/remoção de fator não foram acrescentadas como bypass. Cliente exige próprio perfil ativo e empresa `active/paused`; Partner continua fora do recorte.
- `workspace-access` mantém request/verify por POST, com schemas existentes e sem retry automático de consumo. Token hash é trocado pelo Auth, sem ser persistido/logado pela feature. Callback PKCE é consumidor separado; callback válido ainda precisa de prova no navegador e configuração do destino.
- Termos reproduzem literalmente a versão oficial `2026-10-15` de `src/legal/legalTexts.ts`, blob `490782fb0918846201c443b6e8d08c1914527261`, sem publicar texto sintético. A revisão de 15/10 é declarada na fonte, não auditoria jurídica da V2. Há linguagem de cliente principal/restrição de privados que precisa ser reconciliada com DEC-05/09 antes da entrega desses campos; não editar mantendo a mesma versão.
- No hospedado, `terms_acceptances` registra usuário/versão/instante do servidor; o digest calculado pela V2 identifica o texto apresentado, **não é persistido por esse contrato**. A ausência/erro do aceite bloqueia a V2; não alegar que isso já bloqueia todas as APIs do hospedado. Nova versão e texto dependem de validação CALI.
- Empresas usam projeções reais, paginação de leitura, filtros e detalhe/acessos por vínculo. Plano desconhecido permanece não informado; convite sem `invited_at` não ganha data fabricada. As keys usam ator/vínculo reais, sem `mock-admin` na composição conectada. Cadastro/convite de produto, comprovação/gate de adesão e limite/revogação completos continuam 2A.

Evidência de preparação GET/POST/PATCH e comparação online/local em [ambiente](../LOCAL_ENVIRONMENT.md#backend-hospedado--dec-27). Nenhum contrato local novo foi declarado presente no hospedado sem prova.

### Prova hospedada A/B — 01/11

Login/aceite foram concluídos pelo usuário. A/B consultaram somente a própria empresa/perfil; consultas à empresa/perfil/convites alheios retornaram zero linhas; rota Admin redirecionou ambos para Cliente. Essa prova é restrita às três tabelas consultadas, não à matriz inteira.

**Corte de sessão ainda não atende ao alvo:** após Sair, Auth recusou JWT antigo (403) e refresh antigo (400) de ambos, mas PostgREST continuou retornando o próprio perfil/empresa (200/uma linha) com JWT ainda não vencido. Outra empresa continuou negada. Inativação de A bloqueou SPA/empresa, sem revogar Auth; ao restaurar o perfil, o mesmo JWT recuperou o acesso. Perfis foram preservados/restaurados e ambas as sessões encerradas na UI. Expiração natural foi observada para ambos: JWTs originais com 62 segundos além do prazo receberam Auth 403 e banco 401/PGRST303 em todas as seis projeções. Sem alteração de TTL/relógio; prova de replay já deslogado, não de refresh/expiração da SPA ativa.

Reconciliar autorização por sessão vigente no servidor e revogação que não ressuscite credenciais ao reativar. É bloqueio técnico de aceite da fase 1; nenhuma policy/schema foi alterada nesta rodada. Detalhes, limites e horários no [ambiente](../LOCAL_ENVIRONMENT.md#rodada-cliente-ab--0111).

## Correção do corte no servidor — candidata, não aplicada

Preparada em 01/11 e exercitada na cópia isolada entre 01 e 02/11. O relatório anterior registrou 40 verificações e execução de `acceptance.sql`, com Auth/PostgREST reais sobre **projeção da referência versionada**, não sobre dump do catálogo ativo. Essa execução reproduziu uma janela adicional de hash Auth pendente; portanto, não homologou a correção completa. Nenhum SQL foi aplicado no hospedado.

Em 02/11, Felipe autorizou corrigir o código sem retomar a bateria do laboratório e avançar na 2A. Os arquivos continuam fora de migrations/runners; `verify` não executa SQL, Docker, Auth nem comunicações. O catálogo hospedado continua pendente de acesso.

### Correção local da troca e admissão — 02/11

A Edge V2 deixa de devolver `token_hash`: consome o código, troca o hash internamente no Auth e só devolve `session.access_token/refresh_token` depois de confirmar a admissão daquela sessão. O subject de consumo contém `userId/authorizationId` vindos do servidor; nenhum desses campos é aceito na solicitação pública. Identidade divergente, admissão negada ou resposta incerta impedem a entrega da sessão e solicitam logout local. Falha no logout não abre a resposta.

[login-admission.sql](../../supabase/proposals/session-cut/login-admission.sql) registra a autorização com instante original do código e liga seu uso único ao `auth.sessions.id`/usuário. Após qualquer marco de corte, `session_is_live` exige admissão com código posterior ao marco, além da sessão e elegibilidade vigentes. Assim, sessão criada depois do corte por um hash antigo não ganha acesso. Refresh preserva a prova original. Corte posterior à admissão também a invalida. A candidata de gestão exige admissão desde a primeira sessão de Clientes de empresa opt-in. Fora da gestão, sessões sem corte prévio mantêm compatibilidade com MFA, termos e permissões de negócio vigentes.

[local-code-admission.sql](../../supabase/proposals/session-cut/local-code-admission.sql) contém somente o adapter do schema privado **conhecido do laboratório**, criando a autorização na mesma transação que consome o código. Não é adapter hospedado: seu DDL de códigos não foi obtido. [reconciliation.sql](../../supabase/proposals/session-cut/reconciliation.sql) e [rpc-guard.sql](../../supabase/proposals/session-cut/rpc-guard.sql) preservam os complementos locais de convites/elegibilidade e guardas dos corpos de RPC conhecidos.

O adapter da SPA aceita a nova resposta e usa `auth.setSession`; mantém suporte explícito ao contrato legado hospedado com `token_hash`. Portanto, **o hospedado ainda não recebeu esta correção**. Não iniciar o Edge/laboratório nem executar `local:access:test` com o novo protocolo antes da reconciliação de schema, adapter e drivers. As migrations históricas e seus digests não foram alterados. O runner experimental anterior foi preservado como texto em `output/runtime/session-cut/history`, ignorado pelo Git, sem comando ativo no produto.

Quatro testes unitários da troca cobrem admissão antes da resposta, corte durante autenticação, identidade divergente e falha de admissão/logout. A validação posterior de 04/11 tem [recorte próprio](../LOCAL_ENVIRONMENT.md#homologação-isolada-de-convites-e-sessão--0411). A fase 1 segue em andamento, com validação do catálogo ativo e integração hospedada pendentes.

### Recorte técnico proposto

1. `session_is_live`, no namespace privado novo `cali_session_guard`, exige `session_id` pertencente ao `auth.uid()` e ainda existente em `auth.sessions`, `not_after` elegível, perfil ativo e empresa Cliente active/paused. Proprietário confiável com bypass RLS e `search_path` vazio evita recursão ao consultar profiles/companies; navegador recebe somente EXECUTE do predicado, sem acesso à tabela Auth ou ao controle privado.
2. Policies **restritivas** para profiles, companies, client_invites e terms_acceptances, em todas as operações do papel authenticated, acrescentam `USING`/`WITH CHECK`. São um AND das permissões existentes, sem conceder ações, substituir isolamento de empresa ou resolver MFA/termos por consequência. Subselect estável evita avaliação por linha quando o plano permite; medir EXPLAIN no destino de teste. Namespace deve permanecer fora dos schemas expostos.
3. Um marco técnico `revoked_before` por usuário é comparado com `auth.sessions.created_at`, não com `iat` do JWT. Refresh da mesma sessão não muda sua data de criação e não pode contornar o corte. Triggers avançam o marco em inativação/reativação e troca de vínculo/papel; corte/retomada de empresa também alcança seus Clientes. active/paused não provoca corte por si só. O valor é monotônico; nova sessão posterior ao marco pode entrar conforme as demais regras. Histórico de negócio e quatro acessos equivalentes continuam independentes.
4. A candidata **não escreve no schema Auth**, não apaga sessões/refresh tokens e não pressupõe o DDL desconhecido dos códigos hospedados. Isso difere do trigger local que apaga auth.sessions: aqui a revogação de acesso ao banco é própria, compatível com refresh da mesma sessão continuar negado. Invalidar credenciais no Auth e códigos pendentes é etapa adicional a reconciliar, não entregue por esse SQL.

Logout: a ausência da sessão no Auth deve negar o JWT ainda não vencido. Inativação/restauração: o marco preservado deve negar as sessões anteriores mesmo se a linha Auth continuar existindo. A negativa vale para novas instruções/transações com estado atualizado; não promete cancelar uma consulta que já estava em execução antes do corte.

Base técnica consultada via Context7: [sessões e logout Supabase](https://supabase.com/docs/guides/auth/sessions), [policies restritivas PostgreSQL](https://www.postgresql.org/docs/current/sql-createpolicy.html). Guardas da SPA continuam úteis para UX; não substituem esses controles.

### Dependências antes de promover/aplicar

- **Catálogo ativo ainda não obtido:** conferir owners/bypass, tipos, RLS/grants, policies acumuladas, triggers e funções/dependências, usando o arquivo de leitura como inventário. API GET das fixtures não fornece esse catálogo. A candidata aborta sem opt-in de revisão, owner esperado e quatro tabelas comuns com RLS; aborta se o namespace já existir. Esses checks não substituem revisão do catálogo nem autorização de aplicação.
- **Bypass de RLS:** RPC `SECURITY DEFINER`, views com proprietário privilegiado, Edge/service_role, Storage e Realtime precisam de verificação própria. Inventário estático contém `update_my_profile_v56`, `update_primary_client_contact_v65` e helpers como `current_company_id`/`is_admin`; não sobrescrever seus corpos por regex nem assumir que a restritiva alcança um DEFINER. Nenhuma liberação global enquanto esses caminhos do recorte puderem contornar o predicado.
- **Convite/perfil/códigos:** em [workspace-access da referência](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/functions/workspace-access/index.ts#L110), resolveOrCreateProfile consulta convite ativo e faz upsert active=true se perfil estiver inativo; verify chama esse caminho antes de gerar magiclink. Observado no código, não exercitado novamente no hospedado, para não disparar e-mail. Reconciliar emissão/consumo e revogação individual em operação autorizada/atômica, preservando os demais acessos e impedindo que convite/código antigos reativem acesso revogado. Corpo/schema efetivos e operação Auth administrativa ainda precisam de revisão; nenhum patch adivinhado foi preparado para o oficial.
- **Concorrência e vínculo:** testar corte com login/refresh concorrentes, reativação e alterações de vínculo, incluindo emissão de sessão durante o bloqueio. Preservar referência de revogação após recriação de perfil do mesmo usuário; a tabela técnica referencia auth.users, sem apagar um marco existente só porque um perfil foi removido. Exclusão/recriação sem corte anterior e alteração de profiles.id não são cobertas pelos triggers candidatos: inventariar esses caminhos no catálogo e impor corte pela operação dona antes de habilitá-los. Identidade Auth removida encerra seu vínculo técnico; política de guarda não foi inventada.

### Validação futura e rollback

`acceptance.sql` foi executado na projeção local anterior à admissão, com rollback. A revisão atual de admissão **não foi executada em PostgreSQL**. Exige cópia isolada autorizada, candidata já aplicada e UUIDs de duas fixtures/sessões Auth elegíveis; verifica marcadores antes de alterar fixtures dentro de transação com rollback. Claims configuradas pelo SQL testam o banco, não autenticação real. Cobre A/B, sessão ausente/alheia/removida, corte/restauração, pausa/bloqueio/retomada, B preservado e tentativa negada de INSERT de aceite. Deve ser executado com interrupção no primeiro erro; rollback não desfaz comunicação externa disparada por triggers, portanto outbound precisa estar bloqueado antes.

Após o teste SQL, repetir com Auth/JWT reais: login novo posterior ao marco permitido; JWT e refresh da sessão anterior incapazes de recuperar dados; logout recusa imediatamente as seis projeções; Admin AAL2/termos mantém operações permitidas e AAL1/erro falha; quatro acessos/revogação individual e caminhos RPC/Edge sem bypass. Validar planos/performance e efeitos dos triggers reais. A execução anterior provou cenários locais de Auth/refresh, sem equivalência com o catálogo hospedado; concorrência da revisão atual continua pendente; `verify` não executa esses testes.

Antes de aplicar, registrar preimagem dos objetos existentes, revisão/digests, destino e escopo autorizado. Antes do commit de DDL, falha reverte toda a transação. Depois de aplicada, **não remover policies ou apagar marcos para fazer rollback**, pois isso reabre o acesso das sessões antigas: bloquear superfícies afetadas e corrigir para frente, ou encerrar sessões afetadas pelo mecanismo Auth autorizado antes de uma reversão revisada. Nesta entrega, rollback é apenas reverter arquivos/documentação, sem dados a desfazer.

## Fase 2A iniciada — edição básica da empresa, 02/11

**Implementado no código:** Admin abre a empresa já existente pela seleção na URL, consulta nome de apresentação/razão social e edita esses dois campos. Formulário preserva rascunho em erro, permite cancelar sem gravar e bloqueia novo submit enquanto aguarda. Razão social vazia usa o nome de apresentação, preservando o comportamento da [referência, saveClient linha 418](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/admin/AdminClientsPageV3.tsx#L418). Não transporta a gravação composta de contato, contrato e acessos daquele formulário.

`companyDetailsSchema` acrescenta `legalName` somente ao detalhe; lista mantém a projeção anterior. `updateCompanyBasicsSchema` aceita somente companyId, snapshot original dos dois nomes e novos valores. Adapter hospedado envia PATCH `companies` com `display_name/legal_name`, condicionado por id e pelos dois valores originais na mesma operação; exige retorno por SELECT e valida identidade/valores. Zero linhas, erro ou confirmação incompatível não produzem sucesso. É comparação de preimagem desses dois campos, sem prometer controle de versão global ou histórico novo.

`useUpdateCompanyBasics` exige estado Admin pronto na composição conectada, sem retry de escrita ou atualização otimista. Confirmação invalida queries existentes do ator, sem inserir payload tardio no cache após logout/troca. Queries de empresas também exigem Admin pronto. O servidor continua responsável pela permissão; guardas frontend não homologam RLS. O adapter demonstrativo mantém alterações somente em memória por instância, sem modificar fixtures globais ou convites.

**Verificação:** regressões de transporte conferem PATCH mínimo, condições, retorno alheio/divergente/vazio, normalização e entrada inválida; testes de UI cobrem salvar/reconsultar, cancelar e erro preservando rascunho sem retry. QA visual usa somente demo. Nenhum PATCH hospedado foi executado para homologar essa nova operação nesta rodada; contrato/policies/triggers/auditoria efetivos continuam sem prova nova.

**Pendente na 2A:** cadastro completo (`create_client_account` sem corpo reconciliado), comprovação/registro de adesão e gate de convite, quatro acessos equivalentes com manutenção/revogação efetivas, demais dados contratuais/financeiros/documentais, histórico e ciclo da empresa. Não criar convite, reativar perfil, alterar plano/automações ou improvisar cadastro com várias chamadas como efeito dessa edição. Reverter este recorte remove o formulário/operação; não desfaz nomes já gravados em eventual uso autorizado.

## Fase 2A — cadastro, adesão e quatro acessos demonstrativos

Continuidade autorizada por Felipe em 02/11: avançar o que independe do catálogo, sem retomar a bateria suspensa. **Código implementado na composição demonstrativa; sem novas operações hospedadas.** Cadastro é de identidade mínima (nome/razão social), não cadastro comercial/contratual completo. Empresa criada recebe identificador da fronteira mock, sem acessos, adesão, contato ou perfil Auth automáticos; plano permanece não informado. Razão social vazia acompanha o nome, conforme a referência já reconciliada.

`CompaniesService.management` declara uma capacidade opcional. A composição demonstrativa fornece `createCompanyManagement`; `createHostedCompaniesService` retorna `management: null`. Formulários novos e comandos não aparecem no hospedado; nenhuma falha de servidor seleciona mocks. Leitura e edição básica existentes continuam independentes. A futura implementação hospedada precisa do contrato de cada operação, incluindo gate de adesão, limite, idempotência, autoria/histórico e consistência de convite/perfil/sessão; não basta trocar essa capacidade por um valor verdadeiro.

| Comando/consulta virtual | Entrada mínima | Resultado e condição do modelo demonstrativo |
| --- | --- | --- |
| Criar identidade | requestId e valores de nome/razão social | Identificador/linha confirmados; abre ficha pela URL; nenhum convite ou perfil é criado |
| Registrar adesão | Contrato DEC-23 (companyId/evidenceReference) com requestId do transporte virtual | Registro append-only; autor/instante sintéticos na fronteira mock; UI não fornece autoria/data; referência não verifica documento nem gera aceite individual |
| Ler adesões | companyId | Histórico da mesma empresa; nenhum registro vigente/expiração foi inventado; referência antecede conferência administrativa; referência isolada não libera autorização |
| Autorizar acesso | requestId, companyId, nome/e-mail normalizados | Exige comprovação administrativa vigente da mesma empresa, empresa active/paused e vaga entre quatro ativos; e-mail repetido da mesma empresa é recusado inclusive se revogado; invitedOn fica null |
| Alterar acesso | requestId, companyId, accessId, snapshot anterior e novo nome/status | Confere vínculo e preimagem; e-mail não é reatribuído; revogar preserva demais, registro e histórico; reautorizar é explícito e repete gate/limite |
| Ler histórico | companyId | Eventos de autorização/nome/revogação/reautorização com snapshots e autor/instante sintéticos; retorno de outra empresa é recusado |

As rotas `/companies`, `/companies/:id/adhesions`, `/companies/:id/accesses` e `/companies/:id/access-history` pertencem exclusivamente ao adapter Axios em memória; **não são endpoints ou RPCs oficiais**. Nenhum e-mail é enviado e nenhuma credencial/sessão é criada, trocada ou revogada. O histórico começa com as alterações desta demonstração; não fabrica eventos anteriores das fixtures.

Novos comandos virtuais têm requestId: repetição do mesmo comando retorna o resultado original sem duplicar efeitos; reutilização com payload/rota diferentes é recusada. A execução síncrona do adapter aplica gate/limite/registro de evento antes de responder, incluindo cinco tentativas concorrentes que não excedem quatro autorizações. Isso não comprova transação, corrida ou idempotência no backend real. Estado e ledger ficam por instância e são descartados ao recarregar a página.

**Experiência:** cadastro/adesão/autorizações têm formulários inline com Form/Zod/DS, erros mantendo rascunho, pendência bloqueando novo submit e cancelamento explícito. Após cadastro, abre a ficha e foca o título; resultado tardio depois de sair da página não restaura a rota anterior. Revogar exige confirmação; novas autorizações ficam indisponíveis enquanto adesão/situação não são confirmadas ou as quatro vagas estão ocupadas. Mutations não fazem retry automático ou atualização otimista; invalidam leitores existentes do ator/empresa. Histórico apresenta instantes em Brasília.

**Pendente no hospedado:** corpo/retorno de create_client_account, comprovação documental e integração da adesão, manutenção atômica de quatro vínculos/perfis, revogação efetiva, históricos/triggers/permissões e demais dados de contrato/financeiro/documentos/ciclo. A checagem de referência do mock não homologa formalização CALI. Fase 1 e 2A permanecem abertas.

## Fase 2A — dados cadastrais complementares demonstrativos

**Implementado em 03/11:** `CompaniesService.management.registration` consulta/atualiza serviço, segmento, horas, endereço/filiais, contato comercial e logo somente na composição demonstrativa. Identidade mínima e ficha administrativa mantêm suas operações/snapshots separados. Hospedado continua com `management: null`; nenhum contrato remoto ou migration foi introduzido.

**Fontes observadas:** publicação 83, [cadastro de empresas](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/admin/AdminClientsPageV3.tsx#L489) (blob `46265a2723530f10d26f81a4d1d86a5e8004277d`) e [preparo de imagem](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/lib/imageUpload.ts). Service type/plan, monthly_hours_contracted, segment, address_*, has_branches/branches e campos comerciais vêm dessa leitura. O contato antes acoplado a perfil/convite principal é separado como registro comercial, preservando DEC-05/08: nenhum login, envio, autorização ou reativação decorre desses campos.

Vocabulário de serviço e mapeamento de plano ficam em `registration-schemas.ts`; `companyPlan` em schemas.ts preserva o Build legado e acrescenta Build Essencial/Completo para não perder identificação no mock. Adapter hospedado mantém sua projeção anterior. No mock, serviço padrão confirma plano correspondente junto da revisão; serviços sem mapeamento mantêm plano anterior, como a edição observada. Não transportar configurações automáticas de agenda/reunião/visita/cobrança. Valores iniciais refletem somente plano conhecido, sem inventar contato, horas, endereço ou logo.

Horas aceitam decimal finito não negativo; zero vira não informado, conforme a criação observada. Segmento usa sugestões e texto livre; UF é normalizada para duas letras; contatos preservam telefone/WhatsApp/texto, e-mail é validado/normalizado e aniversário usa data civil opcional. Filiais são localidades por linha, preservando ordem e duplicatas, removendo linhas vazias; salvar sem filiais limpa as localidades, com informação explícita no formulário e histórico preservado. Não há geocodificação, calendário de aniversários ou lookup externo.

**Logo local:** JPG/PNG/WEBP/AVIF/SVG, entrada até 12 MB, dimensão máxima preparada 1200 px e saída até 700 KB; qualidades 0,88/0,76 seguem referência. SVG é sempre rasterizado localmente antes de integrar o registro; raster/AVIF pequenos preservam arquivo. Prévia/substituição/remoção pertencem ao rascunho, com preparo assíncrono e cancelamento/geração; salvar aguarda preparo, cancelar/trocar empresa descarta resultado tardio. Data URL raster, dimensões, tipo e tamanho preparados são validados na fronteira virtual. Blob URLs transitórios são revogados; imagens não usam endereços remotos. Nenhum upload/storage ocorreu. Recarregar descarta registros e imagens em memória; não é política de retenção real.

**Protocolo virtual:** GET/PATCH `/companies/:id/registration`, GET `/companies/:id/registration-history`. Mesmo envelope de revisão/requestId já adotado na ficha administrativa, usando o ledger do adapter e estado cadastral por instância; sem duplicar ledger ou criar backend. Conflito não sobrescreve rascunho; repetição reproduz resultado sem novo efeito, no-op não cria evento, histórico mantém preimagem/pós-imagem/autoria/instante sintéticos. Plano é atualizado somente na execução vencedora do comando, não no replay antigo. Service valida identidade/revisão/valores e eventos. UI Admin é demonstração, não prova de autorização real.

**Frontend:** painel, editor/hook, grupos/campos, resumo, histórico e seleção/prévia de logo separados. `CompanyField` compartilha controle/label/erro/descrição com a ficha administrativa sem depender de um formulário específico. Estado de consulta permanece Query; revisão/rascunho/preparo são locais; URL continua dona da seleção. Nenhum context ou dependência nova. Dados fiscais não encontrados, arquivos contratuais, comprovação, financeiro operacional, ciclo e integração hospedada continuam fora deste lote; fase 2A não está encerrada.

## Fase 2A — ficha administrativa demonstrativa

**Implementação de frontend/modelo, 02/11:** `CompaniesService.management.administration` acrescenta leitura, atualização e histórico de contrato/financeiro/referências documentais somente no transporte em memória. Hospedado continua com `management: null`. Não amplia leitura/PATCH hospedados nem executa catálogo, SQL, Auth, cobrança ou upload.

**Origem:** [cadastro/manutenção da referência](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/admin/AdminClientsPageV3.tsx#L525), blob `46265a2723530f10d26f81a4d1d86a5e8004277d` conferido por leitura independente. Campos/opções são da referência; nomes camelCase abaixo são projeção virtual, não tipos gerados do banco.

| Grupo | Projeção demonstrativa e correspondência observada |
| --- | --- |
| Contrato | startDate/endDate → start_date/end_date; contractType/contractModel → contract_type/contract_model; autoRenew → auto_renew; penaltyEnabled/penaltyText → contract_penalty_enabled/contract_penalty_text; penaltyBase/penaltyValue → termination_penalty_type/termination_penalty_value; terminationPaymentDays/Rule → termination_payment_days/rule |
| Financeiro | contractValue → contract_value; billingFrequency/paymentMethod/billingDueRule/billingDay/billingLeadDays → billing_frequency/payment_method/billing_due_rule/billing_day/billing_lead_days; paymentTermDays → payment_term_days; lateFeePercent/dailyInterestPercent/financialNote → late_fee_percent/daily_interest_percent/payment_notes |
| Referências documentais | driveUrl/documentOwner/documentNotes → drive_folder_url/document_owner/document_notes; são textos/metadados, sem leitura do destino, vínculo de storage ou prova de assinatura |

`administration-schemas.ts` é o dono dos vocabulários e contratos; formulário deriva entrada/saída de `administration-draft.ts`, com transformação explícita antes da mutation. Números decimais usam vírgula ou ponto, sem agrupamento; valor monetário aceita até duas casas. Valor contratual zero normaliza para null, como o cadastro/manutenção observados. Demais números precisam ser finitos/não negativos; prazos são inteiros e dia fixo vai de 1 a 31. Datas são civis válidas, com término não anterior ao início quando ambos existem. Não é uma calculadora de multa/vencimento. Opções personalizadas mantêm texto nas observações; não se inventa calendário financeiro. URL aceita somente http(s) sem usuário/senha, permanece texto e não abre/sincroniza automaticamente.

Registro inicial tem revisão 0 e configuração não informada, sem inventar valor/recorrência/forma de pagamento/antecedência conhecidos; flags/opções técnicas iniciais só são apresentadas no rascunho, não como configuração confirmada. Parâmetros preenchidos permanecem registrados mesmo com multa não prevista ou vencimento não fixo; não têm efeito operacional. Histórico novo não fabrica passado das fixtures.

**Protocolo virtual:** GET/PATCH `/companies/:companyId/administration` e GET `/companies/:companyId/administration-history`. Atualização contém somente requestId, companyId, expectedRevision e values. Comparação da revisão e gravação/histórico acontecem sincronamente na fronteira mock. Edição desatualizada é negada; formulário preserva snapshot/rascunho até descarte explícito. Repetição do mesmo comando reproduz resultado sem novo evento; requestId reutilizado com outro conteúdo/rota é negado pelo ledger existente. Sem alteração de valores não incrementa revisão nem cria evento. Histórico guarda preimagem/pós-imagem, autoria e instante sintéticos, sem aceitar autoria da UI. Service valida identidade/valores/revisão na confirmação e vínculo dos eventos; Query invalida os leitores do ator depois de sucesso, sem retry/otimismo.

**Interface:** ficha em componentes próprios de leitura, edição, grupos/campos e histórico; hook de edição possui formulário/snapshot/requestId. Field/FeedbackState/Button existentes e controles nativos preservam semântica, labels/erros, pendente, foco, cancelamento e rascunho. Troca de empresa desmonta estado transitório; refetch não substitui edição ativa. Dados permanecem em memória por instância e recarregar descarta alterações.

**Continuidade/lacunas:** logo, serviço/plano/horas, endereço/filiais e contato comercial passaram a ter o recorte demonstrativo descrito acima em 03/11. Arquivos de contrato/aditivo e comprovação da adesão têm implementação demonstrativa descrita neste documento; financeiro operacional, projeção/distrato, ciclo e integração efetiva continuam pendentes. Configurar tipo de contrato não altera o plano da lista nem concede acesso. Não habilitar essa capacidade no hospedado por flag. Testes/QA locais não comprovam permissões ou efeito de servidor; fase 1/2A permanecem abertas.

## Proveniência e limites

- Referência funcional: publicação 83, `app.cali@f3d3f14043a6abc38636f0340fe831e621d8b357`, conforme DEC-14. Fontes baixadas somente para leitura; 586 arquivos de src/supabase/docs conferidos contra os blobs da árvore desse SHA. Nenhum código/SQL importado foi executado.
- A main oficial consultada está em `ce48879ef7058f28c8a35e185c20f87f8119d0b4`, publicação 84. O [comparativo](https://github.com/patricia258/app.cali/compare/f3d3f14043a6abc38636f0340fe831e621d8b357...ce48879ef7058f28c8a35e185c20f87f8119d0b4) contém somente handoff do Cliente e CSS de formulário público; a referência de contratos permanece publicação 83.
- Observar no código não comprova schema efetivo, deploy, políticas acumuladas, entrega de e-mail ou transação. Os 29 corpos ausentes do levantamento geral não foram declarados recuperados.

## Superfícies reconciliadas

| Operação | Entrada e saída observadas | Autoridade/efeitos e fronteira V2 |
| --- | --- | --- |
| Solicitar código | `POST /functions/v1/workspace-access`, JSON `action: request`, `email`, `website` opcional. Sucesso `{ok:true}` ou `{ok:true,challenge:code}`; erro `{error:string}` | Origem validada; procura/provisiona perfil por convite/staff; salva hash e chama Resend. Resposta genérica não comprova elegibilidade nem entrega. Schema V2 não aceita `role`, `company_id` ou `active` fornecidos pelo solicitante |
| Verificar código | Mesmo endpoint, `action: verify`, `email`, `code`; sucesso com `ok:true`, `token_hash` não vazio e role `admin/client/partner`; erro `{error:string}` | Backend consulta código, tentativas e perfil; gera token hash. O navegador chama `auth.verifyOtp` com `type: email`. `role` na resposta não é prova de sessão, MFA ou autorização |
| Ler identidade | `auth.getSession` e evento de sessão; provider oficial lê `profiles.role,active` para `user.id` | V2 precisa também do vínculo de empresa. Projeção mínima planejada: `id,company_id,role,active`; campos existem na fonte SQL. Nenhum ID de empresa escolhido na tela pode substituir vínculo autorizado |
| Ler identidade de empresa | Tabela `cali_workspace.companies`; projeção mínima V2 `id,display_name,legal_name,status` | Admin/Cliente conforme servidor, contexto e RLS. Status observado: `active/paused/blocked/closed/archived`; parse não concede acesso |
| Ler convites/vínculos de acesso | `client_invites`; projeção mínima V2 `id,company_id,email,full_name,active,platform_access,is_primary` | `is_primary` é metadado legado de contato, nunca privilégio V2. Convite é distinto de usuário Auth/perfil. Até quatro acessos equivalentes por empresa permanece DEC-05 |
| Consultar aceite | `terms_acceptances`, filtro `user_id` e versão legal corrente | Registro tem `user_id,version,accepted_at,user_agent`; chave composta usuário/versão, versão de 1–40 caracteres. Projeção mínima V2 omite user_agent. Falha de consulta não libera acesso (DEC-08) |
| Registrar aceite | INSERT `user_id,version,user_agent` na UI oficial; `accepted_at` tem default de servidor | Policy encontrada permite inserir somente para `auth.uid()`. V2 só considera registrado após confirmação; não cria aceite a partir de checkbox/toast nem usa versão antiga para liberar a atual |
| Criar conta | Caller de `create_client_account`: `p_company,p_contact,p_email,p_hours,p_service_type`; UI usa retorno como identificador | **Corpo ausente.** Não há prova de autorização, tipo SQL exato do retorno, transação ou histórico. Nenhum service/RPC novo foi fabricado; cadastro completo pertence à 2A |
| Atualizar contato legado | `update_primary_client_contact_v65(uuid,text,text,text,text,text,date)`, retorno void | Corpo localizado: exige `is_admin`, usa locks de convite/perfil principal e nega troca de e-mail já vinculado. Não reutilizar isso como hierarquia de autorização entre os quatro Clientes |
| Alterar acessos/ciclo | UI atualiza companies, convites e perfis em múltiplas chamadas | Limite de quatro convites ativos aparece em trigger; encerrar/bloquear/arquivar desativa perfis por trigger. Reativação em lote e revogação individual precisam de contrato consistente antes da escrita real |

Fontes dos protocolos: [workspace-access](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/functions/workspace-access/index.ts#L83), [wrapper/token](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/lib/supabase.ts#L138), [provider](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/auth/WorkspaceAuthProvider.tsx#L20), [cadastro/contato](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/admin/AdminClientsPageV3.tsx#L385) e [RPC contato](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261001110000_primary_contact_profile_link.sql#L42).

## Código, falhas e consistência

Na fonte de workspace-access: código de seis dígitos, validade de dez minutos, uma solicitação a cada dois minutos por e-mail e limite de cinco tentativas. Verificação normaliza/trunca o valor recebido; schema de entrada V2 exige seis dígitos completos sem coerção numérica, preservando zeros. Essa é validação de transporte, não um novo prazo/regra de autenticação.

| HTTP observado | Significado do endpoint |
| --- | --- |
| 200 | Resposta genérica ou sucesso de uma etapa; não significa sessão autorizada nem entrega externa |
| 400 | Código inválido/expirado ou ação inválida |
| 403 | Origem não permitida ou acesso indisponível |
| 405 | Método diferente de POST/OPTIONS |
| 429 | Limite de solicitação de código |
| 500 | Falha interna; resposta genérica, sem expor detalhe ao solicitante |

Não repetir automaticamente a verificação de um código consumido. A fonte marca uso antes de concluir todo o provisionamento/token e não demonstra serialização completa de duas verificações simultâneas; reservar cenários de falha/race para implementação, sem declarar atomicidade. O envio via Resend também não pode ser portado para o ambiente isolado: SMTP/captura local e sem segredos reais serão necessários.

## Alvo vigente de autorização

1. **Identidade:** sessão válida e perfil ativo; Cliente vinculado à própria empresa. Perfil/convite ausente ou consulta inválida não autoriza. O schema de record aceita representar perfil inativo/sem vínculo para tratamento explícito; isso não o torna elegível.
2. **Admin e MFA — DEC-21:** cadastro e confirmação do segundo fator antes de liberar a área/poderes Admin, inclusive primeiro uso. Sem fator, permanece no cadastro; erro permanece bloqueado com retry. Não transportar a exceção SQL de ausência de fator, o desvio por nome de ambiente QA ou os caminhos de erro que liberam a UI. Recuperação de fator exige operação própria autorizada, não fallback que concede acesso.
3. **Autoridade Admin:** na referência há divergência entre perfil e allowlist de e-mails do JWT. A baseline local V2 adota um predicado único de perfil persistido ativo/Admin, AAL2 e fator TOTP verificado existente; não confia em papel/e-mail fornecido por metadata, nem copia identidades da allowlist. DEC-25 registra a implementação/prova do recorte de adesão; isso não certifica guardas dos demais domínios.
4. **Adesão e termos — DEC-08:** adesão registrada antes do convite; aceite corrente obrigatório no primeiro acesso e a cada nova versão; informação de privacidade consultável; falha de comprovação bloqueia. Aceite jurídico e `client_invites.accepted_at` são eventos diferentes.
5. **Empresa:** `paused` mantém consulta na referência; `blocked/closed/archived` cortam acesso Cliente. Cadastro, vigência, estado de conta e eliminação são dimensões distintas. Nenhuma matriz nova de transições de escrita foi inventada.
6. **Quatro acessos — DEC-05:** equivalência e revogação individual preservadas, inclusive ao reativar empresa. Um contato denominado principal não ganha manutenção exclusiva. A fonte representa um `company_id` por perfil; não foi aprovada navegação multivínculo de um mesmo usuário.
7. **Continuidade:** logout/expiração/revogação/troca de identidade cancelam operações, limpam cache/contexto e não mantêm resposta de outra empresa como atual. Controller/guardas já implementam esse ciclo; prova hospedada A/B acima registra a lacuna do servidor. Namespace de key não substitui autorização no servidor.

Fontes: [schema/records/RLS inicial](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/003_isolated_workspace.sql), [limite/status](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261010230000_account_blocked_status_access_roles_contract_fields.sql), [corte de acesso](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261021150000_block_client_access_on_contract_end.sql), [MFA SQL](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261020093000_security_mfa_required_for_admin_and_partner.sql), [predicado posterior](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261020180000_developer_admin_and_partner_access.sql), [TermsGate](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/auth/TermsGate.tsx) e [aceite SQL](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261021120000_terms_acceptances.sql).

## Registro próprio de adesão — DEC-23

Felipe autorizou investigar cadastro/primeiro acesso e criar um registro se não existir. A investigação percorreu os 166 SQLs versionados e os caminhos do cadastro, uploads de conta, login e TermsGate. Resultado:

- Cadastro usa companies, convites, perfis e documentos de tipo contract/addendum; não registra evento específico de adesão ao Workspace.
- Primeiro acesso marca accepted_at do convite e registra aceite individual em terms_acceptances, com significados diferentes.
- Os textos legais mencionam adesão formalizada; não foi localizada uma operação/tabela correspondente. A ausência na fonte não comprova ausência no banco ativo, que não foi consultado.

Criado [contrato mínimo V2](../../src/api/modules/access/adhesion.ts), explicitamente novo:

| Parte | Campos e autoridade |
| --- | --- |
| Solicitação de registro | companyId e evidenceReference não vazia, uma referência à formalização; sem autoria/data/papel fornecidos pelo cliente |
| Registro retornado | id, companyId, evidenceReference, recordedBy e recordedAt; autoria e instante determinados no servidor |
| Operador | Admin autenticado/autorizado e com MFA concluído |
| Consumo | Emissão de convite deve comprovar registro anterior e vinculado à mesma empresa; falha/ausência bloqueia |
| Histórico | Preservar registro e sua referência; correções precisam de trilha, não de apagar evidência |

É um contrato de operação administrativa, não assinatura eletrônica nem certificação jurídica. Não se exigiu um novo PDF, formato de anexo, prazo ou aceite comercial por suposição; a referência poderá apontar para a evidência formalizada pela CALI conforme o fluxo a implementar. Validar a existência/formato dessa referência e armazenar o registro com proteção no servidor permanecem trabalho da baseline/2A. Parse de texto não verifica um documento.

A adesão é da empresa e antecede convite (DEC-08). O aceite de termos continua individual/versionado no primeiro acesso. Não criar adesão automaticamente ao entrar, marcar convite como adesão ou atribuir ao Cliente poder de confirmar essa condição administrativa. O contrato existe e é testado; gravação e guardas do recorte foram implementadas/testadas no laboratório em 29/10; UI e gate de referência demonstrativos foram implementados em 02/11; comprovação documental e integração efetiva no servidor/convite continuam pendentes.

## Persistência local de adesão — 29/10

Baseline nova em `supabase/migrations/20261029090000_access_adhesion_baseline.sql`, sem executar migrations/dados do oficial. Aplicada somente pelo [runner local](../../scripts/local-database.ts), com target/topologia verificados, transação e journal/digest. O laboratório e seus comandos ficam em [Ambiente isolado](../LOCAL_ENVIRONMENT.md).

- `companies` contém a identidade mínima e os cinco status observados; `profiles` contém vínculo/papel/ativo e FK para Auth. São a fundação deste teste, não cadastro completo de conta/convites ou cópia integral das tabelas oficiais.
- `workspace_adhesions` contém id, empresa, referência, autor e instante; FK impede autoria/empresa inexistentes. Escrita é somente pela RPC `register_workspace_adhesion`, com `companyId/evidenceReference`; resposta camelCase coincide com o schema Zod. Autoria vem de `auth.uid()`, instante de `clock_timestamp()`, referência é aparada/rejeitada se vazia.
- Wrapper exposto é invoker; operação definer e predicado ficam em `cali_private`, fora dos schemas expostos, com search_path vazio e grants explícitos. Admin exige perfil persistido ativo/Admin, JWT AAL2 e fator TOTP verificado ainda existente. JWT/metadata/e-mail não criam papel. Sem exceção QA ou ausência de fator.
- RLS permite leitura da evidência somente a Admin autorizado. Cliente não recebeu nova projeção de referência/documento. A leitura do próprio perfil serve ao tratamento do acesso; consulta Cliente de empresas/negócio aguarda termos/sessão/guards correspondentes.
- INSERT direto, UPDATE e DELETE não são concedidos aos papéis da API. Trigger impede reescrever/apagar adesões; novos registros não apagam anteriores. Não há endpoint de correção nem regra inventada para escolher uma evidência vigente. Autoria/histórico têm FK restritiva; revisão de retenção/eliminação exige recorte próprio.
- A referência é declarada pelo Admin; persistência não verifica existência, assinatura ou validade jurídica de documento externo, nem faz fetch de URL. Comprovação/formato no fluxo CALI e pré-condição na emissão de convite pertencem à 2A. Não interpretar sucesso da RPC como convite emitido ou aceite individual registrado.

SQL real testa claims sintéticos com rollback; API testa JWT emitido pelo Auth local, TOTP incorreto/confirmado, autoria, negações e remoção de fator. Senha usada pelo driver sintético não muda o contrato de workspace-access por código. Evidências/limites estão no [changelog](../CHANGELOG.md); sessão no frontend, termos e acesso aos demais domínios continuam pendentes.

## Tipos implementados e fronteira com os mocks

- [access/schemas.ts](../../src/api/modules/access/schemas.ts): requests explícitas, respostas verificadas e projeções mínimas de perfil/aceite. Tipos inferidos; adapter/eventos/telas hospedados estão registrados no recorte de 01/11, e protocolo local de sessão admitida em 02/11, sem equivalência entre os servidores.
- [companies/records.ts](../../src/api/modules/companies/records.ts): projeções mínimas usadas pelo adapter hospedado na leitura de empresa/convite. Não são um Database manual nem prova de que o banco aplicado retorna esses campos.
- [companies/schemas.ts](../../src/api/modules/companies/schemas.ts) continua a projeção demonstrativa usada pela tela. `plan`, `createdOn`, `invitedOn` e status simplificado de acesso não equivalem automaticamente a `service_plan/service_type`, timestamps ou flags reais. Campos financeiros/contratuais ficam na 2A. O catálogo de status agora inclui archived; não há ação nova de arquivamento.
- Respostas de sucesso incompletas, papel desconhecido, campos de autorização forjados na request e aceite sem instante/versão são rejeitados nos testes de contrato. Parse válido não constitui autenticação, MFA ou RLS.

## Lacunas por operação e critério de desbloqueio

| Lacuna | Evidência e ação antes de integrar |
| --- | --- |
| Criação de conta | Obter definição versionada de `create_client_account` por arquivo/exportação sanitizada fornecida pelo responsável. Há somente comentário de correção no [registro SQL](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/supabase/migrations/20261020150000_fix_client_hours_policy_and_create_client.sql). Não conectar ao oficial para obtê-la. Não bloqueia ler perfis/empresa preparados para teste |
| Tabela de códigos | `workspace_access_codes` aparece na Edge Function, mas seu DDL não foi localizado no conjunto SQL versionado inspecionado. Nova implementação V2 foi criada/testada no laboratório, com locks/grants/consumo; não é reprodução do banco ativo. Expurgo/retenção ainda dependem de política validada |
| Registro da adesão | Investigado/autorizado em DEC-23; persistência/servidor do recorte de adesão implementados/testados localmente em 29/10. O [texto legal](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/legal/legalTexts.ts#L1) distingue material interno dos termos apresentados. Preservar a persistência/auditoria local e completar comprovação da referência no fluxo 2A; não confundir anexo, accepted_at de convite ou aceite individual com esse registro |
| Predicados e RLS acumulados | Comparar baseline de teste com os helpers/grants/policies necessários, incluindo profile.active, vínculo e MFA obrigatório. Fonte estática não demonstra estado aplicado; não exportar dados/clientes ou identidades reais |
| Revogar/reativar acesso | Reconciliar convite/perfil e preservar revogação individual; a atualização em lote da UI não prova esse requisito |
| MFA/termos | Baseline local testada; adapter/eventos/telas hospedados e jornada Admin/aceite observados em DEC-27. Ainda faltam primeiro enrollment UI, recuperação segura, callback e demais cenários/permissões. Texto vigente foi reproduzido; revisão de compatibilidade V2 e novo versionamento precisam de validação, sem inventar prazos |
| E-mail e concorrência do código | Captura local e workspace-access testados com concorrência/uso único; Resend e canais externos não foram portados. TTL do código não define prazo de guarda dos registros/logs |

Testar no ambiente isolado: código incorreto/expirado/repetido, perfil inativo, A/B/Admin, cliente sem vínculo, conta pausada versus bloqueada/encerrada/arquivada, Admin sem MFA/AAL1/AAL2/erro, aceite ausente/antigo/erro, requisição direta ao backend e logout sem dados remanescentes. Publicar somente a evidência realmente executada.

## Códigos, termos e guarda de sessão — 29/10

Implementação nova local nas migrations `20261029120000_codes_terms.sql` e `20261029123000_access_revocation.sql`. O DDL de códigos não foi recuperado do oficial; não é reprodução do banco ativo. [Procedimento e limites do laboratório](../LOCAL_ENVIRONMENT.md).

### Código e primeiro fator

`supabase/functions/workspace-access` contém handler e adapter Edge locais. Request/verify reutilizam os schemas Zod da V2; origem aceita é somente `http://127.0.0.1:5173`. Runtime rejeita URL de backend fora dos dois nomes internos conhecidos. Vite empacota Zod/contratos em arquivo ignorado antes de iniciar o Edge; não há download de imports dentro da rede internal. Nenhum SDK ou segredo foi adicionado à SPA.

- Código aleatório de seis dígitos, preservando zeros, com validade de dez minutos. Banco recebe HMAC-SHA256 com contexto próprio, calculado no runtime com chave local de serviço; não armazena código aberto. Código aparece somente na mensagem sintética do Mailpit, nunca no JSON de sucesso ou logs do handler.
- Request serializa por e-mail normalizado com advisory lock; intervalo de 120 segundos entre solicitações elegíveis, inclusive falha de entrega. Novo pedido invalida os códigos anteriores. Limite de cinco tentativas; quinta falha impede acerto posterior. Expirado, pendente de entrega, falha de entrega, usado ou revogado não autentica.
- Usuários precisam estar previamente preparados no Auth/perfil ativo. Cliente exige empresa active/paused e adesão; Partner, perfil ausente/inativo e empresa blocked/closed/archived não são provisionados por este endpoint. Não há leitura de convites ou criação automática de perfil: cadastro/convite completo permanece 2A.
- Captura é exclusivamente a API interna do Mailpit. Entrega é confirmada no banco antes do retorno de desafio. Falha marca o código indisponível; resultado incerto permanece bloqueado. Não foi portado Resend nem criado transporte externo.
- Verificação concorrente é serializada no banco: um único consumidor vence. O código é consumido **antes** de pedir `hashed_token` ao Auth; erro/timeout posterior não reabre o código. Isso é fail-closed, não atomicidade distribuída entre banco, Auth e entrega. Usuário solicita outro código respeitando o intervalo; não repetir automaticamente verify.
- Hash de token é trocado por sessão no Auth com `type: email`, também de uso único. Role do JSON não libera acesso; sessão vigente, perfil, empresa, MFA e termos são conferidos novamente no servidor.
- Grants de issue/delivery/consume são exclusivos do adapter de serviço. Anônimo/Cliente/Admin autenticados não acessam tabela privada de hashes nem chamam essas RPCs diretamente. Chave de serviço não concede autoria Admin na RPC de adesão.

### Termos versionados

`legal_versions` guarda título, texto, SHA-256 calculado no servidor e instante. Conteúdo/versão são imutáveis; publicação seleciona a versão corrente por registro privado. Não existe versão aprovada/publicada de produção nesta implementação. Drivers locais preparam textos explicitamente sintéticos; publicação e conteúdo CALI exigem recorte próprio.

`get_current_terms` disponibiliza somente conteúdo corrente, inclusive antes do login. `accept_current_terms` recebe **version/contentHash**, sem user_id/instante fornecidos pelo navegador. Exige sessão vigente e perfil elegível; Admin conclui MFA antes do aceite. Versão/hash apresentados precisam coincidir com o conteúdo corrente. O aceite é usuário/versão, imutável e idempotente; repetição preserva o instante original. Publicação de versão nova e aceite são serializados, sem atribuir o aceite anterior ao novo conteúdo.

Sem publicação, estado é terms_unavailable; aceite ausente/antigo é terms_required; falha de leitura/validação bloqueia. O predicado Admin de negócio passou a exigir aceite corrente além de MFA/sessão. Consulta Cliente de empresa só permite a própria empresa elegível e com aceite corrente. Não abre acesso aos demais domínios.

### Estado de sessão e revogação

`workspace_access_state` retorna status signed_out/blocked/mfa_required/terms_unavailable/terms_required/ready, perfil mínimo, situação de empresa e conteúdo/aceite corrente. JWT precisa corresponder a sessão ainda existente e não expirada em Auth; role/empresa da tela ou metadata não substituem perfil persistido. Logout, inativação do perfil e bloqueio/encerramento/arquivamento da empresa retiram liberação. Corte por perfil/empresa revoga sessões e códigos pendentes; reativar não recupera essas credenciais nem muda a revogação individual. Pausa mantém consulta.

No frontend, `src/api/modules/access/session.ts` valida o contrato; `src/app/session` controla carregamento/erro/logout, cancelamento, cache e respostas atrasadas por geração. Router recebe controller por contexto e faz beforeLoad em Cliente/Admin; App invalida as rotas quando o estado muda. Retorno aceita somente caminhos internos Cliente/Admin. Página de bloqueio mostra mensagem por motivo e não simula login ou aceite.

**Limite:** a fonte real do controller, telas de código/MFA/termos, persistência/refresh de token e eventos Auth ainda não estão conectados à SPA. Bootstrap continua demo e rejeita URL real. Injeção de sessão é usada nos testes das guardas; não há alternador de demonstração que conceda autorização real. Keys/adapters de empresas ainda são demonstrativos; não tratá-los como consultas autenticadas.

### Evidência e pendências

Driver API local passou em 76 verificações de código/concorrência, Auth real, duas versões/aceites, empresa/isolamento, logout e revogação. Regressão de adesão passou em 31 verificações com MFA e aceite. SQL cobre grants, entrega pendente/falha e imutabilidade com rollback; unitários cobrem falha de adapter/Auth e guardas/continuidade. Não extrapolar para entrega externa, concorrência entre todos os serviços, conteúdo jurídico aprovado ou sessão completa no navegador. Registro final e limitações no [changelog](../CHANGELOG.md).

Permanecem: adapter/eventos e UI do frontend, comprovação da referência/gate de convite, cadastro completo/quatro acessos, recuperação de fator e ampliação de RLS por domínio. TTL do código não define retenção; expurgo de registros de código/aceites e textos de finalidade/guarda precisam de política validada, sem prazo inventado.

## Fase 2A — contratos e aditivos demonstrativos

Implementado em 03/11 em `management.documents`: anexo multipart virtual, listagem, download de versão, nova versão e retirada administrativa com motivo. Somente adapter em memória; hospedado continua `management: null`. Referência estática: [uploadDocument da publicação 83](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/admin/AdminClientsPageV3.tsx). O oficial vincula arquivo e metadados à empresa e diferencia contrato/aditivo; esta entrega não copia storage, visibilidade Cliente ou certeza de assinatura.

Schemas inferem comandos/metadados: empresa, tipo, data opcional, nome/MIME/tamanho/SHA-256, documento/versão anterior, autor/instante sintéticos. PDF/DOC/DOCX e PNG/JPEG/WebP/AVIF/SVG até 12 MB (limite técnico demonstrativo). Sem parser ou prévia do conteúdo. SHA-256 identifica bytes, não comprova autenticidade, assinatura ou validade jurídica.

POST virtual `/companies/:id/documents` recebe FormData nativo (`metadata` e `file`); Axios escolhe o boundary. GET da coleção e `/document-history` retorna somente metadados; GET `/documents/:versionId/content` fornece Blob sob demanda, conferido por tamanho/digest antes do download. POST `/documents/:documentId/withdraw` registra motivo com versão esperada. Nenhuma dessas rotas existe no backend hospedado por consequência deste código.

Versões são imutáveis; nova versão exige documento/tipo/empresa e versão corrente esperados, verificados após leitura assíncrona dos bytes. Mesmo requestId/payload retorna resultado original; conteúdo diferente, inclusive com mesmo nome/tamanho, é recusado. Retirada preserva versões, bytes e eventos, impedindo novas versões naquele documento. Um novo documento pode ser anexado separadamente. Conteúdo de outra empresa é recusado na fronteira mock. Download usa nome sanitizado e Blob URL temporária, com limpeza no término/desmontagem; sem abertura automática.

Interface separa painel/lista, anexo/hook, retirada, histórico e download/hook. Formulário mantém arquivo/data na falha, bloqueia ações concorrentes e cancelamento pendente; sucesso/cancelamento devolvem foco ao título. Key por empresa descarta rascunho ao trocar ficha. Anexo não libera adesão por si só. Comprovação administrativa foi acrescentada no lote seguinte; persistência/storage/permissões, verificação de conteúdo, projeção Cliente e ciclo real permanecem pendentes.

## Fase 2A — comprovação administrativa da adesão

Implementada em 03/11 somente na demonstração: referência, anexo e conferência são registros distintos. `management.evidence` confirma a conferência explícita de referência da mesma empresa, com observação obrigatória e versão documental opcional. Sem upload obrigatório (DEC-23), validade temporal inventada, assinatura validada ou aceite individual de termos. Operador/instante são sintéticos na fronteira mock. O formulário informa finalidade/limites e exige checkbox novamente quando referência, versão ou observação mudam.

Comandos virtuais em `/companies/:id/adhesion-evidence`: GET lista comprovações/estado derivado; POST confirma; POST `/:evidenceId` retira com motivo. Schemas em `evidence-schemas.ts`, transporte em `evidence.ts`, estado em `adhesion-evidence.ts`; nenhum endpoint, contrato DEC-23 ou baseline local/hospedada é alterado. Snapshot imutável preserva referência e, se anexada, a versão exata com nome/tipo/tamanho/digest/autor/instante. Retirada acrescenta motivo/autor/instante sem editar o registro original; nova conferência gera outro registro.

Estados tipados: vigente, retirada, documento com nova versão e documento retirado. Versão vinculada deve ser corrente/não retirada e pertencer à mesma empresa na confirmação. Nova versão ou retirada do documento invalida conferências vinculadas; conferência externa sem anexo não é afetada por documentos independentes. Gate de **nova autorização e reautorização no mock** exige ao menos uma conferência vigente, situação active/paused e vaga entre quatro; não basta referência existente. Acessos anteriores, renomeação e revogação explícita permanecem disponíveis/preservados; nenhuma sessão real é cortada por esta demonstração.

Ledger compartilhado confere requestId/rota/payload; repetição não duplica, reuso com conteúdo alterado falha. Duas confirmações concorrentes da mesma referência/versão não geram comprovações vigentes duplicadas. Retirada repetida com outro requestId exige recarregar. Serviço valida vínculo/projeção/resposta antes de invalidar leitores por ator; sem retry automático ou atualização otimista.

Frontend separa referência, painel, formulário/hook, lista/histórico e retirada. Estados de carregamento/erro/retry, rascunho preservado, pendência, seleção stale recusada e foco no título após salvar/cancelar são cobertos. Trocar empresa desmonta transitórios; falha de listagem não libera autorização. Não há novo consumidor Cliente. Este modelo prepara a jornada administrativa; critérios de comprovação reais, permissões/storage/consistência/visibilidade e aceite pela CALI continuam pendentes antes da integração efetiva. Fases 1/2A abertas.

## Cliente 2A — consulta conectada da própria empresa

Implementado em 03/11: `/cliente/empresa` consulta `CompaniesService.account` no modo hospedado. Projeção exata GET `id,display_name,legal_name,status` de companies, filtrada pelo company_id do perfil ready/Cliente ativo. Sem busca de carteira, convites, perfis alheios, notas internas, financeiro, arquivos ou comprovação administrativa. Nenhum campo/endpoint/policy/migration novo. `readHostedCompanyIdentity` é compartilhado pela composição de sessão e serviço de empresas; valida schema e identificador retornado. A autorização efetiva continua responsabilidade do backend.

Hook sem entrada de empresa por props/URL; query key separa ator/vínculo e projeção Cliente. Usa AbortSignal e nenhum placeholder de empresa anterior. Conta active/paused permite consulta; demais situações ocultam identidade e oferecem revalidar acesso. Erro não cai em fixture nem aparece como lista vazia. Linha ausente tem mensagem própria; revalidação confirma sessão e invalida somente o leitor ainda pertencente ao mesmo ator/vínculo. Troca de identidade/vínculo, falha de sessão e logout cancelam/limpam cache pelo controller existente.

Composição conectada usa navegação Início/Minha empresa/Termos e privacidade, com página e título próprios e Back/Forward. URLs antigas de módulos mantêm destino/título e aviso específico de preparação; não mostram métricas demonstrativas. Novas rotas de conta/termos exigem composição autenticada; no modo de demonstração retornam ao início legado, sem inventar vínculo. O menu Cliente não tem alternador para Admin ou seleção de outra empresa.

`/cliente/termos` consulta somente a versão/conteúdo e confirmação de aceite já presentes no estado de acesso. Reutiliza TermsContent do fluxo de aceite, sem INSERT novo, data presumida ou alteração do documento jurídico. Conteúdo oficial vigente ainda diverge de DEC-05/09 no vocabulário principal/privados; revisão CALI e nova versão permanecem pendentes. Exibir conteúdo não sana a divergência nem homologa o texto.

### Uso do banco e retirada gradual dos mocks

Não há uma fase obrigatória separada para trocar mock por banco. A integração ocorre por operação com contrato, projeção e permissão reconciliados:

| Operação | Composição hospedada | Estado da prova |
| --- | --- | --- |
| Acesso/sessão/MFA/termos e leituras básicas de empresas | Adapter hospedado existente, sem fallback de erro | Evidências anteriores e limites em LOCAL_ENVIRONMENT; bateria suspensa continua intocada |
| Minha empresa do Cliente | GET mínimo autenticado sobre contrato existente | Transporte, guarda e UI testados sinteticamente; nova validação autenticada da tela ainda pendente |
| Edição Admin dos dois nomes | PATCH com preimagem já implementado | Nenhum PATCH hospedado foi executado nesta continuidade |
| Cadastro em rascunho e comprovação administrativa | RPCs V2 na tela Admin, com listagem, conferência, retirada e histórico | Jornada autenticada pelo CALI MAPA com registro sintético |
| Empresa definitiva a partir do rascunho | RPC V2 na tela Admin e vínculo persistente com a carteira | Jornada autenticada com uma empresa sintética e replay concorrente em PostgreSQL descartável |
| Dados complementares, contrato/arquivos e quatro acessos | `management` permanece null no hospedado | Contratos e efeitos de servidor ainda precisam ser reconciliados por operação |

Manter mocks de testes e a demonstração explícita não significa usá-los no caminho conectado. Remover fixtures globalmente ou habilitar management por flag não substitui contrato de banco. Nenhuma nova leitura de dados reais, autenticação/código, SQL, Edge/laboratório ou comunicação foi executada para este lote. Testes de SDK e navegador usam respostas sintéticas; não comprovam RLS hospedada. Fases 1/2A abertas.

## Fase 2A — candidata de cadastro e comprovação

O catálogo ativo do CALI MAPA confirmou que a RPC legada cria empresa e convite principal ativo, com `platform_access=true` por default, e abre ciclo quando recebe horas positivas. `authenticated` tem escrita direta sob RLS em empresas, convites e perfis e `EXECUTE` na RPC. A Edge Function implantada reutiliza perfil ativo ou procura convite por e-mail e `active`. A alteração de convite e a desativação de perfil são chamadas separadas no Admin oficial. Esses caminhos precisam permanecer compatíveis durante a transição.

A [candidata SQL](../../supabase/proposals/company-onboarding/candidate.sql) implementa três RPCs novas. Ela fica fora dos runners. Os dados vivem no schema privado `cali_v2_onboarding`. As RPCs expostas usam wrappers invoker e exigem perfil Admin ativo, AAL2 e TOTP verificado. Papéis da aplicação não têm acesso direto às tabelas novas. Grants, RPCs e tabelas do oficial não são reconfigurados.

| Operação | Contrato candidato |
| --- | --- |
| `v2_create_company_draft` | Cria rascunho com nome e razão social. Chave de operação por ator confirma o mesmo resultado quando o payload se repete. |
| `v2_review_company_adhesion` | Confirma ou retira comprovação por rascunho. A confirmação recebe referência, revisão documental opcional informada pelo Admin e observação. A retirada recebe motivo. A preimagem é o último evento conhecido. A ordem é serializada por rascunho. O servidor registra autor, instante e histórico imutável para os papéis da aplicação. |
| `v2_read_company_draft` | Lê identidade e histórico pelo UUID. O evento mais recente determina se há comprovação confirmada ou retirada. |

A revisão informada manualmente nos rascunhos permanece no histórico como metadado da conferência administrativa. Um vínculo verificado usa o registro documental, a identidade do objeto e a versão retornada pelo Storage.

### Aplicação no CALI MAPA

Em 04/11/2026, Felipe confirmou que os dados do projeto são de teste e autorizou a migration. O arquivo da revisão `8688c85` foi aplicado uma vez, em transação pelo SQL Editor do projeto `kqtbfeeqbcllwvlkbrkq`. A execução direta não registra a versão no histórico da CLI. O arquivo permanece fora dos runners para evitar reaplicação.

Após o commit, o catálogo confirmou três wrappers invoker executáveis por `authenticated` e sem EXECUTE para `anon` e `service_role`. As duas tabelas novas estavam vazias, com RLS ativa e sem privilégios diretos de leitura/escrita para esses papéis. A sequência não concede acesso a `authenticated`. A assinatura das definições e ACLs de `create_client_account`, `is_admin`, `enforce_client_invite_limit` e `companies_cut_client_access` permaneceu idêntica à do preflight. Duas chamadas SQL com claims sintéticas confirmaram recusa para AAL1 e para identidade sem perfil. A validação não exercitou sessão real, Admin via Data API ou frontend.

### Integração do Admin com a Data API

A área **Rascunhos de empresas** em **Empresas e acessos** usa a sessão do Admin para chamar as RPCs pelo schema `cali_workspace`. O [complemento de listagem](../../supabase/proposals/company-onboarding/list-drafts.sql) foi aplicado em 04/11 no mesmo destino autorizado. `v2_list_company_drafts` exige o guard existente e ordena por data e UUID. A tela carrega até 25 rascunhos por página e usa o último UUID como cursor. A listagem fica separada da carteira de empresas, com cache por ator e leitura por rascunho.

Cadastro e comprovação geram uma chave por formulário e conservam essa chave ao tentar novamente. A comprovação fixa a preimagem do último evento ao abrir o formulário. Confirmação exige conferência explícita e referência, com versão documental opcional informada pelo Admin. Retirada exige motivo e registra novo evento. A resposta precisa corresponder ao rascunho e à operação antes de atualizar o histórico.

No navegador, uma sessão Admin autenticada abriu a listagem, criou o rascunho sintético **QA V2 2A — empresa sintética 04-11**, confirmou a adesão e reencontrou o rascunho após recarregar a página. A retirada ficou registrada junto da confirmação. O catálogo confirmou o grant esperado, um rascunho sintético, duas entradas de histórico e a mesma autoria. A fixture permanece identificada com a comprovação retirada. O nome da fixture não apareceu na lista de empresas.

### Criação definitiva na carteira

O Admin seleciona **Criar empresa na carteira** no detalhe do rascunho e confirma a ação. A [migration](../../supabase/proposals/company-onboarding/materialize-company.sql) instala `v2_materialize_company`, que exige o guard Admin AAL2 com TOTP verificado. A operação trava a linha do rascunho, grava nome de apresentação e razão social em `companies` e vincula o UUID, autor e instante ao rascunho na mesma transação. Repetir o comando retorna a empresa vinculada. Se ela já tiver sido removida por outro fluxo, o vínculo histórico impede criar outra por repetição.

A empresa usa o estado inicial padrão `active`, com automação e notificações desabilitadas. O gatilho ativo de inserção só normaliza o plano de serviço. O cadastro fica visível na carteira e a adesão continua em sua própria etapa. O botão **Abrir na carteira** reabre o vínculo também depois de recarregar a página.

Em 04/11/2026, a migration foi aplicada em transação no SQL Editor do CALI MAPA. O Admin autenticado criou a fixture **QA V2 2A — materialização sintética 04-11** pela Data API e reabriu a mesma ficha após recarregar. O catálogo confirmou um vínculo, uma empresa, zero convites e zero ciclos de serviço para a fixture. Os grants da RPC foram verificados. A execução direta fica fora do histórico da CLI. A fixture identificada permanece no ambiente de teste.

### Vínculo à versão do documento no Storage

Depois de criar a empresa na carteira, o Admin pode selecionar um contrato ou aditivo em **Registrar comprovação**. A [migration de vínculo documental](../../supabase/proposals/company-onboarding/link-adhesion-document.sql) disponibiliza a listagem e a confirmação via Data API. As duas RPCs exigem o guard Admin AAL2 com TOTP. A seleção cruza `account_documents` com o objeto atual no bucket privado, no caminho `<empresa>/account/` usado pelo oficial. O formulário exige conferência explícita e o servidor valida a empresa, o documento, o objeto e a versão antes de gravar o evento.

O histórico preserva um snapshot com título, tipo, ID documental, ID do objeto e versão do Storage. Se o objeto mudar entre seleção e confirmação, a operação pede atualização da lista. Uma repetição com a mesma chave e os mesmos dados devolve a comprovação já registrada. O bucket tem versionamento desativado. O snapshot identifica a versão conferida, mas a disponibilidade do arquivo antigo depende de ele continuar armazenado. Rascunhos sem empresa e registros antigos com versão informada seguem disponíveis com identificação distinta.

Em 04/11/2026, a migration foi aplicada no CALI MAPA. Um PDF sintético foi cadastrado como contrato privado da empresa de QA. A sessão Admin selecionou a versão pela tela, confirmou e recuperou o mesmo histórico após recarregar. O catálogo confirmou correspondência dos três identificadores e grants da listagem. O teste isolado recusou versão incorreta e verificou que atualizar o objeto preserva histórico e replay. O PDF e o evento sintéticos permanecem identificados.

### Pré-condição de adesão para novos acessos

A [candidata privada de elegibilidade](../../supabase/proposals/company-onboarding/access-eligibility.sql) será chamada dentro da transação de convite ou reautorização. Ela exige empresa vinculada a rascunho V2, estado `active` ou `paused` e último evento de adesão confirmado com snapshot documental. Compara empresa, documento, objeto e versão com o registro corrente no Storage. Uma versão substituída ou uma comprovação retirada exige nova conferência. A função retorna o ID da comprovação que sustentou a autorização.

A ordem de bloqueios é rascunho, empresa e versão do documento. O comando candidato mantém os bloqueios até gravar a vaga. A validação ocorreu em PostgreSQL descartável. A candidata permanece fora do CALI MAPA.

### Convite, limite de vagas e revogação em ambiente isolado

A [candidata de gestão de acesso](../../supabase/proposals/company-onboarding/manage-access.sql) integra os comandos Admin ao registro `client_invites`. O comando requer Admin com AAL2, TOTP e sessão vigente. Para convidar ou reativar, ele serializa os comandos pelo rascunho, confere a adesão vigente, verifica o e-mail e ocupa uma das quatro vagas na mesma transação. Uma restrição de unicidade impede repetir a vaga. O histórico privado guarda a chave do comando, o ator, o convite e a comprovação usada. Repetir o comando retorna o mesmo ID sem reexecutar a alteração.

Revogar libera a vaga, desativa o convite e aciona o corte do perfil e da sessão. Reativar exige vaga e adesão vigentes. Para empresas marcadas para gestão, a admissão exige convite com vaga e o gatilho barra alterações diretas de acesso pelos papéis da aplicação. O papel de serviço pode registrar o aceite sem mudar a vaga. O predicado anterior de elegibilidade continua para empresas fora da gestão.

O [teste isolado](../../supabase/proposals/company-onboarding/test-access.sh) sobe PostgreSQL descartável em socket Unix. Ele usa os SQLs candidatos de corte, reconciliação e admissão sobre tabelas e claims sintéticas. Em cinco solicitações simultâneas, quatro ocuparam vaga e a quinta foi recusada. A revogação liberou a vaga, bloqueou a leitura pela sessão antiga e preservou o outro Cliente. Após reativação, a prova e o código antigos continuaram recusados e uma sessão admitida com código posterior ao corte conseguiu ler. Um convite legado sem vaga perdeu elegibilidade ao marcar a empresa para gestão no teste.

O [cenário com Auth local](../LOCAL_ENVIRONMENT.md#homologação-isolada-de-convites-e-sessão--0411) acrescentou Admin AAL2, entrega no Mailpit e JWT/refresh reais. Após a revogação e reativação, a RLS continuou negando a leitura de A com o JWT renovado e com uma sessão emitida a partir de hash anterior ao corte. B manteve acesso.

A candidata permanece fora do CALI MAPA. Antes do opt-in hospedado, comparar catálogo, RLS, escritores legados com privilégios elevados, consumidores da Edge e adapter de códigos. Verificar convites preexistentes e colisões de identidade antes de trocar a fonte de elegibilidade.

### Reconciliação com o catálogo ativo — 04/11

Leitura de metadados no SQL Editor do CALI MAPA (`main`) e da fonte da Edge `workspace-access`, revisão 11. A verificação consultou estrutura, políticas, grants e código implantado.

| Superfície | Observado no CALI MAPA | Implicação para a V2 |
| --- | --- | --- |
| Códigos e sessão | `cali_workspace.workspace_access_codes` vincula por e-mail. Tem `code_hash`, `attempts`, `used_at`, `expires_at`, `created_at` e `requested_ip`. RLS ativa sem policies para a tabela. A Edge usa papel de serviço, lê o código e registra tentativas e consumo em chamadas distintas. Após gerar link no Auth, devolve `token_hash`. | O adapter local usa tabela privada e consome o código junto da autorização de sessão. Reusar o registro hospedado exigiria uma transição que também excluísse a possibilidade de o escritor legado consumir o mesmo código. |
| Provisionamento e comunicação | A Edge reutiliza perfil, procura convite ativo por e-mail, pode criar usuário e gravar perfil na solicitação de código. Também mantém fluxo de staff/Partner e envia por Resend. | Provisionamento, admissão e comunicação precisam de prova de idempotência e falha parcial em fluxo próprio. O ensaio local semeia perfis sintéticos. |
| Escritores e convites | `authenticated` tem DML em `client_invites` e `profiles`, limitado por RLS. `create_client_account` escreve convites. `profile_send_invites` chama a rotina de envio. Essas RPCs e `profile_renew_invite` são `SECURITY DEFINER` executáveis por `authenticated`. O trigger legado conta pelo campo `active`, sem `platform_access`. | O guard de escrita da candidata distingue papéis SQL. Um escritor `SECURITY DEFINER` com owner `postgres` precisa de tratamento explícito para garantir a fronteira do opt-in. |
| Corte e alcance | `auth.sessions` tem as quatro colunas exigidas pela candidata. `cali_session_guard`, `cali_private`, `v2_access_slot` e a RPC de gestão estão ausentes. As oito policies das quatro tabelas da prova são permissivas. O schema tem 213 policies em 88 tabelas. A consulta encontrou 25 policies do Storage com referência textual a `cali-workspace`, incluindo superfícies Cliente e Partner. | A prova nas quatro tabelas cobre somente esse recorte. Inventariar RPCs e Storage que permitem ler ou escrever para a empresa opt-in com uma sessão antiga. |

Sequência proposta para a integração:

O adapter de cadastro e adesão da SPA usa sete RPCs, incluindo a listagem e a confirmação de documentos de adesão. Essa listagem retorna metadados. A SPA ainda precisa de integração para abrir arquivos hospedados. Na revisão de permissões, conferir também o que um Cliente consegue chamar diretamente pela API, inclusive funções privilegiadas, políticas do Storage e links assinados. O [inventário de catálogo](../../supabase/proposals/session-cut/catalog.sql) lista políticas de objetos e permissões efetivas de execução por papel.

O inventário hospedado de 04/11 confirmou `transaction_read_only=on`. No recorte de `cali_workspace` e rotinas privilegiadas de `public`, a consulta encontrou 306 rotinas. Entre elas, `authenticated` tem acesso efetivo a 273, das quais 249 usam `SECURITY DEFINER`. As 14 rotinas privilegiadas acessíveis por `anon` estão em `public`, com nomes associados a formulários e perfis públicos. Os grants indicam que a rotina pode ser chamada, e a autorização efetiva depende também das verificações do seu corpo.

O bucket `cali-workspace-private` está privado. Das 39 políticas de `storage.objects`, 25 fazem referência textual ao Workspace e são permissivas. A leitura de documentos e entregáveis do Cliente depende de `current_company_id()`. A função hospedada usa `auth.uid()` e perfil ativo, sem consultar a admissão da sessão. As seis rotinas legadas examinadas, incluindo `update_my_profile_v56` e as RPCs de convite, também carecem da guarda V2. As quatro tabelas da candidata têm RLS e zero políticas restritivas no catálogo consultado. Os schemas `cali_session_guard` e `cali_private` e as RPCs V2 de gestão, preparação e admissão ainda estão ausentes.

A consulta direcionada, também com `transaction_read_only=on`, encontrou os helpers `storage.allow_only_operation(text)` e `storage.allow_any_operation(text[])`. As 13 policies de leitura que nomeiam esse bucket e alcançam `authenticated` são permissivas. A política Cliente de documentos cobre os caminhos `documents/<empresa>/` e `<empresa>/deliverables/`. A política Admin cobre o bucket, e a política Partner de documentos exige permissão própria. O catálogo também confirmou que `create_client_account`, `profile_send_invites`, `profile_renew_invite`, `update_my_profile_v56` e `update_primary_client_contact_v65` executam como `postgres` e são chamáveis por `authenticated`. No recorte gerenciado, o papel efetivo `postgres` por si só não identifica o escritor V2. A gestão ainda precisa de fronteira explícita para os escritores legados antes de qualquer opt-in.

O catálogo confirmou três escritores diretos de `client_invites` com dono `postgres` e execução por `authenticated`: cadastro, edição de perfil v56 e edição do contato principal v65. O cadastro cria uma nova empresa e seu convite. Envio e renovação operam em `profile_invites`, um fluxo separado das quatro vagas. O transporte delegado de perfil não é executável por `authenticated`.

Na cópia, as [guardas legadas](../../supabase/proposals/session-cut/legacy-admin-rpcs.sql) exigem Admin ativo, AAL2, TOTP verificado, sessão vigente e o predicado Admin original para cadastro, renovação e envio. O [contato principal legado](../../supabase/proposals/session-cut/rpc-guard.sql) também exige essas condições e recusa empresas gerenciadas. A edição de perfil v56 valida a sessão e deixa de espelhar alterações para o convite de empresa gerenciada. Os pontos públicos preservam nomes, argumentos e retornos. `authenticated` mantém execução sob as guardas e os grants explícitos aos demais papéis foram retirados na candidata. O teste usa captura SQL local em vez do transporte externo. Antes de promover, revisar os consumidores de serviço e preparar rollback das definições e ACLs originais.

O inventário de escritas em `profiles` encontrou duas sobrecargas de `update_my_profile` e a versão v55, com dono `postgres` e acesso por `authenticated`. A [guarda no UPDATE de perfil](../../supabase/proposals/session-cut/legacy-profile-writes.sql) usa a sessão do JWT para cobrir esses caminhos sem alterar parâmetros ou campos gravados por cada versão. Na [prova PostgreSQL](../../supabase/proposals/company-onboarding/test-access.sh), um escritor sintético com `SECURITY DEFINER` recusou a sessão cortada e permitiu a edição pela sessão nova. Revogação, reativação e leitura do outro Cliente também passaram com a guarda instalada. A função administrativa de eliminação de dados encontrada no mesmo inventário pertence a outro fluxo e requer revisão própria.

No PostgreSQL descartável, a suíte reproduziu a política Cliente de leitura de documentos e entregáveis e aplicou o helper candidato de [guarda de RPC](../../supabase/proposals/session-cut/rpc-guard.sql). A sessão admitida leu apenas objetos da própria empresa. A sessão sem admissão ou revogada recebeu zero objetos. Reativar preservou o bloqueio da sessão antiga e a sessão nova recuperou a leitura própria. O outro Cliente manteve acesso.

Para documentos com corte imediato, o desenho precisa impedir que o Cliente emita links reutilizáveis pela API direta. A mesma permissão de leitura pode autorizar a assinatura. O filtro de operação do Storage é uma opção se estiver disponível no destino e a policy cobrir todas as permissões sobrepostas. O download autenticado também precisa de validação de cache no hospedado, porque navegador e CDN podem responder sem reavaliar a sessão. Se o cache não puder respeitar o corte, servir por uma rota que revalide a sessão a cada leitura e responda com `Cache-Control: no-store`. [Operações do Storage](https://supabase.com/docs/guides/storage/schema/helper-functions), [cache de arquivos privados](https://supabase.com/kb/troubleshooting/storage-private-bucket-files-still-accessible-after-remove-access-or-logout).

A [variante com Storage real na cópia](../LOCAL_ENVIRONMENT.md#variante-com-storage) confirmou a diferença. Após revogar A, a API recusou download autenticado e nova assinatura. O link emitido antes do corte continuou a entregar os bytes sem JWT. B continuou a baixar o arquivo. A RPC `update_my_profile_v56` também recusou a sessão sem admissão e o JWT revogado. A prova cobre o serviço local sem CDN e uma RPC de perfil. Os grants e policies do CALI MAPA precisam de revisão antes de ativar a gestão V2.

A [candidata de filtro](../../supabase/proposals/session-cut/storage-download.sql) altera apenas a política Cliente de documentos e entregáveis na cópia descartável. Para empresa gerenciada, a política permite download autenticado e consulta autenticada de metadados. Para empresa fora da gestão, preserva as operações da política anterior. A prova HTTP confirmou os dois downloads, recusou a assinatura individual e em lote e preservou a emissão fora da gestão. A candidata não invalida links já emitidos. Antes de promover, verificar todas as políticas sobrepostas do destino, em especial as de Admin e Partner, e validar download e cache no ambiente que vai atender o Cliente. Na cópia, descartar o banco desfaz a alteração. Um rollback futuro no destino teria de repor a definição anterior da política.

No cenário de bytes, a sessão admitida baixou o arquivo sem aceite, porque a política reproduzida usa a empresa e o estado da sessão. O aceite sintético foi exercitado na rodada separada do Chrome. No CALI MAPA, a consulta somente leitura encontrou `terms_acceptances(user_id, version, accepted_at, user_agent)` e não encontrou `legal_versions` nem `current_legal_version`. Para liberar arquivos Cliente na V2, reconciliar uma fonte de versão vigente no servidor, reaproveitando o modelo de publicação da baseline local. Validar negação antes do aceite, após troca de versão e após revogação. O próprio fluxo de aceite deve continuar acessível antes da liberação dos arquivos.

1. Reservar um endpoint e um registro privado de códigos para a V2. Conferir quais consumidores do CALI MAPA dependem da Edge da V1 antes de decidir a transição. Vincular provisionamento idempotente e admissão ao convite gerenciado e à identidade Auth estável. Testar colisão de identidade e falha entre criação da conta, vinculação e envio.
2. Portar a exigência de admissão desde o primeiro acesso para as superfícies da empresa opt-in. Cobrir API, RPCs privilegiadas e Storage conforme os consumidores desse recorte. Testar se uma sessão emitida pelo caminho legado consegue contornar a admissão da V2. Conferir como revogação afeta URLs assinadas já emitidas.
3. Homologar a jornada no navegador com Admin e dois Clientes sintéticos. Exercitar convite, primeiro acesso, refresh, revogação, reativação e leitura de arquivos. Validar as dependências do CALI MAPA que a V2 vai usar no primeiro lançamento. Registrar rollback da Edge V2 e do opt-in antes de abrir convites no hospedado.

### Provisionamento no primeiro acesso V2 — 04/11

A [candidata isolada de provisionamento](../../supabase/proposals/company-onboarding/provision-access.sql) permite que o primeiro pedido de código vincule o Cliente de um convite gerenciado à sua identidade Auth. O Admin reserva a vaga. A Edge confirma a empresa e o convite vigentes antes de criar a conta, marca a criação no Auth com o ID do convite e reconsulta o banco para concluir o vínculo sob o mesmo lock da gestão de vagas.

A criação Auth e o vínculo no banco têm transações distintas. Se a criação persistir e a resposta ou o vínculo falhar, a nova tentativa recupera a conta com o marcador do mesmo convite. Uma conta preexistente sem vínculo compatível e sem esse marcador é recusada. Um perfil existente deve corresponder à identidade Auth, à empresa, ao e-mail e ao papel de Cliente ativo. A função não reativa perfil e não desloca vínculo. Se o convite mudar durante a criação, o vínculo depende da nova conferência. Uma conta pendente de um convite antigo requer reconciliação antes de aproveitar outra autorização.

O código continua no registro privado V2. Somente a sessão admitida após a confirmação do código chega à SPA. Para habilitar o recorte no CALI MAPA, ainda é necessário revisar as superfícies de RPC e Storage, escolher o endpoint e transporte de e-mail hospedados e validar o fluxo com o catálogo efetivo.

A Edge V2 envia ao Mailpit no laboratório. O registro começa pendente, e o consumo exige confirmação. A suíte do handler verificou falha no transporte, falha ao confirmar um envio e limite de emissão. Uma falha de confirmação retorna erro e tenta invalidar o registro pendente, sem repetir o envio. O intervalo de dois minutos também alcança pedidos que falharam, pois considera a data de emissão. A homologação hospedada precisa confirmar o transporte e o remetente da V2, o recebimento do código nos destinatários de teste e o comportamento quando o provedor aceita a mensagem e o registro falha.

O pedido público da Edge V2 usa HTTP 200 e `{ok:true}` para envio confirmado, e-mail indisponível ou emissão limitada. O formulário já trata a resposta como solicitação e mantém a mensagem condicional. O limite segue aplicado no banco. O contrato hospedado legado continua aceito pelo adapter. Erros operacionais ainda retornam falha genérica. Esta mudança uniformiza as respostas normais. Tempos de resposta e falhas do provedor continuam fora dessa garantia.

### Transição e retirada do legado

1. Manter a capacidade de rascunhos e comprovação separada da gestão de acessos. A jornada autenticada já foi exercitada com Admin e uma fixture no CALI MAPA.
2. Usar o snapshot de documento verificado na futura validação de acesso. A criação em `companies` e a seleção da versão no Storage já foram exercitadas no CALI MAPA.
3. Implantar gestão de quatro vagas em recorte isolado ou com fronteira de servidor por empresa. Admissão e todos os escritores desse recorte precisam respeitar adesão, vagas e revogação. Vincular por identidade estável e impedir e-mails ambíguos. Revogação bloqueia códigos e sessões antigos e preserva os demais vínculos. Reativação exige autenticação nova. Integrar convite e entrega só depois dessa prova.
4. Remover a demonstração como opção da V2 após a entrada em operação, se ela deixar de ser necessária. Preservar fixtures de teste. A falta de Clientes na V2 permite descartar dados sintéticos identificados em destino isolado. Antes de aposentar RPCs, grants ou Edge do oficial no banco compartilhado, inventariar consumidores, migrá-los e verificar ausência de uso. Aprovar limpeza em lote separado.

Rollback inicial desabilita as RPCs V2 no transporte e retira o acesso aos wrappers, preservando rascunhos e evidência para revisão. Exclusão física exige confirmar que só existem dados descartáveis. A migration e o complemento de listagem estão aplicados no CALI MAPA. A gestão de acesso aguarda a reconciliação do corte no servidor.
