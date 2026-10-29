# Contratos mínimos de acesso e empresas

Atualização: 29/10/2026. Recorte da fase 1, FLOW-01/02. **Adesão, códigos/termos e estado/revogação de sessão implementados/testados no laboratório local; frontend sem serviço de autenticação, SDK ou sessão real. As provas não abrangem todo o fluxo de acesso.** Transições e experiência continuam na [ficha](../flows/ACCESS_ACCOUNTS.md); matriz em [Permissões](../PERMISSIONS.md).

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
7. **Continuidade:** logout/expiração/revogação/troca de identidade cancelam operações, limpam cache/contexto e não mantêm resposta de outra empresa como atual. Isso segue pendente de implementação; namespace de key mock não comprova isolamento no servidor.

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

A adesão é da empresa e antecede convite (DEC-08). O aceite de termos continua individual/versionado no primeiro acesso. Não criar adesão automaticamente ao entrar, marcar convite como adesão ou atribuir ao Cliente poder de confirmar essa condição administrativa. O contrato existe e é testado; gravação e guardas do recorte foram implementadas/testadas no laboratório em 29/10; UI, comprovação documental e gate de convite continuam pendentes.

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

- [access/schemas.ts](../../src/api/modules/access/schemas.ts): requests explícitas, respostas verificadas e projeções mínimas de perfil/aceite. Tipos inferidos; nenhum service, token, hook ou provider foi conectado ao runtime.
- [companies/records.ts](../../src/api/modules/companies/records.ts): projeções mínimas planejadas para leitura de empresa/convite. Não são um Database manual nem prova de que o banco aplicado retorna esses campos.
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
| MFA/termos | MFA, termos e negações testados no servidor; UI/adapter/eventos de sessão, conteúdo jurídico aprovado, recuperação segura e demais superfícies ainda pendentes. A versão legal da referência não autoriza novos textos/prazos de guarda |
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
