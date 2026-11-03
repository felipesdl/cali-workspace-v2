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

[login-admission.sql](../../supabase/proposals/session-cut/login-admission.sql) registra a autorização com instante original do código e liga seu uso único ao `auth.sessions.id`/usuário. Após qualquer marco de corte, `session_is_live` exige admissão com código posterior ao marco, além da sessão e elegibilidade vigentes. Assim, sessão criada depois do corte por um hash antigo não ganha acesso; refresh não altera a prova original. Corte posterior à admissão também a invalida. Sessões sem corte prévio mantêm compatibilidade com os controles anteriores, sem dispensar MFA/termos/permissões de negócio.

[local-code-admission.sql](../../supabase/proposals/session-cut/local-code-admission.sql) contém somente o adapter do schema privado **conhecido do laboratório**, criando a autorização na mesma transação que consome o código. Não é adapter hospedado: seu DDL de códigos não foi obtido. [reconciliation.sql](../../supabase/proposals/session-cut/reconciliation.sql) e [rpc-guard.sql](../../supabase/proposals/session-cut/rpc-guard.sql) preservam os complementos locais de convites/elegibilidade e guardas dos corpos de RPC conhecidos.

O adapter da SPA aceita a nova resposta e usa `auth.setSession`; mantém suporte explícito ao contrato legado hospedado com `token_hash`. Portanto, **o hospedado ainda não recebeu esta correção**. Não iniciar o Edge/laboratório nem executar `local:access:test` com o novo protocolo antes da reconciliação de schema, adapter e drivers. As migrations históricas e seus digests não foram alterados. O runner experimental anterior foi preservado como texto em `output/runtime/session-cut/history`, ignorado pelo Git, sem comando ativo no produto.

Quatro testes unitários da troca cobrem admissão antes da resposta, corte durante autenticação, identidade divergente e falha de admissão/logout; testes do handler continuam verificando a fronteira pública. Não comprovam execução SQL, catálogo ativo, atomicidade entre serviços ou homologação da correção. Revalidação em runtime continua pendente, conforme suspensão solicitada. Não há liberação de fase 1 nem autorização implícita de aplicação/deploy.

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
| Ler adesões | companyId | Histórico da mesma empresa; nenhum registro vigente/expiração foi inventado; existência de registro antecede nova autorização no modelo |
| Autorizar acesso | requestId, companyId, nome/e-mail normalizados | Exige referência da mesma empresa, empresa active/paused e vaga entre quatro ativos; e-mail repetido da mesma empresa é recusado inclusive se revogado; invitedOn fica null |
| Alterar acesso | requestId, companyId, accessId, snapshot anterior e novo nome/status | Confere vínculo e preimagem; e-mail não é reatribuído; revogar preserva demais, registro e histórico; reautorizar é explícito e repete gate/limite |
| Ler histórico | companyId | Eventos de autorização/nome/revogação/reautorização com snapshots e autor/instante sintéticos; retorno de outra empresa é recusado |

As rotas `/companies`, `/companies/:id/adhesions`, `/companies/:id/accesses` e `/companies/:id/access-history` pertencem exclusivamente ao adapter Axios em memória; **não são endpoints ou RPCs oficiais**. Nenhum e-mail é enviado e nenhuma credencial/sessão é criada, trocada ou revogada. O histórico começa com as alterações desta demonstração; não fabrica eventos anteriores das fixtures.

Novos comandos virtuais têm requestId: repetição do mesmo comando retorna o resultado original sem duplicar efeitos; reutilização com payload/rota diferentes é recusada. A execução síncrona do adapter aplica gate/limite/registro de evento antes de responder, incluindo cinco tentativas concorrentes que não excedem quatro autorizações. Isso não comprova transação, corrida ou idempotência no backend real. Estado e ledger ficam por instância e são descartados ao recarregar a página.

**Experiência:** cadastro/adesão/autorizações têm formulários inline com Form/Zod/DS, erros mantendo rascunho, pendência bloqueando novo submit e cancelamento explícito. Após cadastro, abre a ficha e foca o título; resultado tardio depois de sair da página não restaura a rota anterior. Revogar exige confirmação; novas autorizações ficam indisponíveis enquanto adesão/situação não são confirmadas ou as quatro vagas estão ocupadas. Mutations não fazem retry automático ou atualização otimista; invalidam leitores existentes do ator/empresa. Histórico apresenta instantes em Brasília.

**Pendente no hospedado:** corpo/retorno de create_client_account, comprovação documental e integração da adesão, manutenção atômica de quatro vínculos/perfis, revogação efetiva, históricos/triggers/permissões e demais dados de contrato/financeiro/documentos/ciclo. A checagem de referência do mock não homologa formalização CALI. Fase 1 e 2A permanecem abertas.

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

**Lacunas:** logo, serviço/plano/capacidade, endereço/filiais, contato comercial, uploads de contrato/aditivo/data/versão, comprovação da adesão, financeiro operacional, projeção/distrato, ciclo e integração efetiva continuam pendentes. Configurar tipo de contrato não altera o plano da lista nem concede acesso. Não habilitar essa capacidade no hospedado por flag. Testes/QA locais não comprovam permissões ou efeito de servidor; fase 1/2A permanecem abertas.

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
