# Documentos e relatórios

Fichas FLOW-11/12. Observação estática, sem upload, gravação, envio ou leitura autenticada. [Contrato comum](README.md); [matriz](../PERMISSIONS.md).

## Alvo V2 confirmado em 26/10/2026 para correção de relatório

Admin pode reabrir o mesmo relatório disponibilizado, com motivo e histórico (**DEC-06**). Item fica indisponível ao Cliente durante a correção até nova liberação (**DEC-11**). Preservar registros anteriores de versão, conteúdo, ciência e autoria como histórico; indisponibilidade não é exclusão nem perda de trilha.

Após nova liberação, ciência do relatório corrigido só é exigida **se Admin solicitar (DEC-12)**. Sem solicitação, não registrar ciência fictícia do conteúdo corrigido; a ciência anterior permanece ligada ao conteúdo histórico. A regra antiga de retirada somente antes de leitura e o caminho v63 sem corpo permanecem evidência do oficial; não substituem a decisão de permitir reabertura pelo Admin.

| Etapa alvo | Ator/condição | Resultado exigido |
| --- | --- | --- |
| Relatório disponibilizado | Admin reabre com motivo e histórico | Mesmo relatório em correção, indisponível ao Cliente |
| Em correção | Admin conclui revisão e libera, sem solicitar ciência | Cliente pode consultar; não há exigência nem registro automático de nova ciência |
| Em correção | Admin conclui revisão, libera e solicita ciência | Cliente pode consultar com nova ciência pendente da revisão liberada |
| Nova ciência solicitada | Cliente confirma | Registra ciência da revisão corrigida; preserva a anterior no histórico |

## FLOW-11 — Arquivo, versão, publicação, ciência e Drive

**Objetivo/atores/entrada:** Admin prepara/versiona/publica/arquiva em `/admin/documentos`; Cliente consulta conteúdo compartilhado em `/cliente/documentos`, registra ciência e solicita cópia ao Drive. Arquivo final de uma entrega não fica disponível por ter sido apenas anexado à conversa.

**Fontes:** [Admin UI](SOURCES.md#documents-admin), [Cliente UI](SOURCES.md#documents-client), [policy files/comments](SOURCES.md#files-policy), [INSERT comentários](SOURCES.md#file-comments), [storage](SOURCES.md#file-storage), [Drive EDGE](SOURCES.md#drive).

**Dados/formulário/anatomia:** empresa/projeto/entrega, título, categoria, versão, arquivo ou link, descrição, capa, validade e requisito de ciência. Catálogo/lista por contexto e situação; detalhe com versão, ação abrir, comentários, ciência e sincronização. `workflow_stage`, status de publicação, client_visible e status de ciência/sync são campos distintos.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Novo/documento incompleto | Salvar/completar Admin | UI valida campos/arquivo; RLS Admin em files | Upload/link e metadados; draft ou published conforme intenção explícita |
| Versão existente | Criar nova versão Admin | Ação de UI cria referência `revision_of_id` | Novo registro/version label; não assumir incremento/imutabilidade garantidos pelo banco |
| Draft | Publicar Admin | UPDATE em files | `published`, client_visible/is_final true e published_at |
| Published | Retirar publicação Admin | UPDATE em files | `draft`, client_visible false, published_at null; não é exclusão |
| Em uso | Arquivar Admin | UPDATE em files | `archived`, client_visible false; preserva registro |
| Compartilhado | Abrir Cliente | UI filtra published+client_visible; RLS verifica empresa/visibilidade e entrega quando vinculada | Signed URL temporária ou link; tenta marcar viewed |
| Ainda não ciente | Registrar ciência Cliente | UI insere/atualiza próprio `document_acknowledgements` | `acknowledged` com datas; corpo/policies completos dessa tabela não encontrados nas migrations |
| Documento | Comentar Cliente | UI insere `comments.target_type='file'` | Divergência: policy de INSERT localizada aceita deliverable/task/project, não file; operação não comprovada por SQL versionado |
| Documento | Comentar Admin | Policy Admin; marca client_visible ou interno | Comentário visível ao público correspondente |
| Arquivo disponível | Conectar/copiar Drive Cliente/Admin conforme ação | EDGE de OAuth/sync e sessão/contexto | Estados pending/processing/synced/error; só synced fornece confirmação da cópia |

**Permissão em duas superfícies:** policy de metadata `files_client_select` não exige literalmente status published; exige client_visible/empresa e predicado de entrega quando houver. Já a UI filtra published. Storage usa regras por caminho; a policy `documents/{company}/...` ou `{company}/deliverables/...` não consulta status de publicação desse arquivo. Portanto ocultar metadata não comprova revogação de URL/caminho conhecido.

**Continuidade/falhas:** detalhe mantém catálogo; erro preserva formulário. Upload, capa, metadata, auditoria e envio/sync não são uma transação única. Signed URL criada não comprova visualização. Ciência não é aprovação da entrega nem assinatura contratual. Drive/arquivos de conta não devem ser confundidos com catálogo `files`.

**Aceite proposto:** Cliente A/B; draft com flag inconsistente; entrega invisível/cancelada; path de arquivo oculto; URL expirada; ciência repetida e versão nova; falha entre upload/metadata; comentário file; cópia Drive pendente/erro/duplicada. **Dúvidas:** `REF-13` (ciência/comentário), `REF-14` (storage x publicação), `REF-05` (atomicidade), `REF-16` (efeitos externos).

## FLOW-12 — Fechamento executivo, versão e ciência

**Objetivo/atores/entrada:** Admin compõe/revisa/aprova/envia fechamento em `/admin/relatorios`; Cliente lê versões enviadas/publicadas e registra ciência em `/cliente/relatorios`. Rotas de impressão conservam o papel e o reportId.

**Fontes:** [Admin UI](SOURCES.md#reports-admin), [Cliente UI](SOURCES.md#reports-client), [readiness SQL](SOURCES.md#report-readiness), [ciência](SOURCES.md#report-ack), [eventos](SOURCES.md#report-events), [dúvida](SOURCES.md#report-question), [retirada](SOURCES.md#report-withdraw), [envio EDGE](SOURCES.md#report-send), [policy de leitura posterior](SOURCES.md#report-policy).

**Dados/anatomia/formulários:** empresa, tipo e período, snapshot de contrato/fatos/entregas/horas, leitura executiva, movimentos, decisões, riscos, próximos passos, notas internas, versão, assinatura e protocolo. Editor/detalhe, prévia, histórico e modal de destinatários. Não atribuir ao cliente edição do relatório ou aprovação interna.

| Anterior | Ação/ator | Guarda observada | Seguinte/efeito |
| --- | --- | --- | --- |
| Prévia sem registro | Gerar Admin | Readiness valida contexto e base; mensal normalmente exige 20 dias; exceção por nome de empresa de teste | Novo draft/versão; simulação é marcada no snapshot |
| Draft/review | Editar/recarregar Admin | UI `canEdit`; autosave e atualização de snapshot | Salva texto/dados; não publica |
| Draft | Iniciar revisão Admin | Guarda de UI/readiness | `review` e review_started_at |
| Review | Aprovar Admin | UI exige resumo, sem bloqueios pendentes, não simulation | `approved`; snapshot/identidade congelados pela composição/triggers aplicáveis |
| Approved | Enviar Admin | EDGE valida sessão/perfil Admin ativo, status approved, sem oficial concorrente e coleta mensal | E-mail via provedor; depois UPDATE `sent` e notificações |
| Approved/sent/published | Criar versão Admin | UI cria novo draft com parent/version | Se já enviada, nova versão é simulation; não substitui oficial automaticamente |
| Draft/review | Excluir Admin | UI restringe origem e confirma | DELETE do rascunho; policy Admin é mais ampla que essa guarda |
| Sent/published sem leitura | Retirar Admin | RPC exige Admin ativo, sem abertura/PDF/ciência/drive_saved, sem contadores | `archived`; registra retirada; não apagar edição já vista |
| Sent/published | Abrir/PDF Cliente | Própria empresa e perfil cliente ativo na RPC de evento | Eventos/counters; dedup de mesmo tipo/usuário em dez segundos |
| Sent/published | Ciência Cliente | Perfil client ativo, própria empresa, lock de linha | Protocolo e snapshot de identidade; se já ciente retorna existente |
| Sent/published aberto | Enviar dúvida Cliente | Própria empresa, 4–4000 caracteres, até três dias úteis da primeira abertura | Abre ocorrência contextual; não altera relatório aprovado |

Ciência pertence ao relatório: primeira confirmação fica registrada no objeto; não é uma assinatura comercial nem aprovação de cada ator que o lê. Após abertura, correção de oficial possui governança própria; não inventar reemissão que substitui histórico.

**Divergências:** UI impede editar versão approved/sent e simulação; policy `reports_admin_all` por si não impõe essas travas. EDGE usa perfil Admin ativo, enquanto outras operações usam `is_admin`/MFA. Envio seta sent/published_at, mas trigger antigo normaliza published_at apenas para published; sem replay não afirmar qual timestamp final prevalece. “Enviado” no banco não comprova entrega externa.

Após retirada, runtime pode chamar `reopen_unopened_report_v63` para voltar à edição; [consumidor localizado](SOURCES.md#report-reopen), corpo não versionado. Não substituir por UPDATE livre ou inferir guardas a partir da RPC de retirada.

**Continuidade/falhas:** autosave existe aqui; não aplicar essa regra a todos os formulários. Trocar empresa/período deve carregar versão correspondente. Falha após provedor aceitar e antes de gravar sent pode causar resultado parcial; idempotência/retry de envio não demonstrados. Arquivo PDF, tela e ciência precisam da mesma versão.

**Aceite proposto:** elegibilidade/base de coleta e teste; revisão com bloqueios; simulação não enviada; status/nota interna não vazam Cliente; reabertura do mesmo item com motivo/histórico; indisponível até nova liberação; ciência exigida somente quando solicitada, sem transportar ciência antiga para conteúdo novo; concorrência, envio parcial/retry e impressão do contexto correto. **Pendências técnicas:** `REF-15/16/01/23`; regra funcional de reabertura/ciência resolvida. Não confundir prazo da dúvida com prazo de cronograma.
