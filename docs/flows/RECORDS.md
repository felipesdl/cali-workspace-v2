# FLOW-10 — Ocorrências e conversa contextual

Estado: observado UI/SQL, sem execução. [Contrato comum](README.md); [permissões](../PERMISSIONS.md). Rotas `/cliente/registros` e `/admin/registros` compartilham consumidor com ações por papel.

## Objetivo, fontes e composição

Cliente abre/acompanha assunto de sua empresa; Admin conduz, registra nota interna, responde, decide encerramento e reabertura. Fontes: [UI](SOURCES.md#records-ui), [abertura](SOURCES.md#records-open), [mensagem/status](SOURCES.md#records-post), [exclusão excepcional](SOURCES.md#records-delete), [controles de mensagem](SOURCES.md#records-message), [feedback/reabertura](SOURCES.md#records-reopen), [anexos](SOURCES.md#chat-storage).

Lista com protocolo, assunto/tipo, filtros, atualização e status; detalhe com contexto, conversa, anexos e ações. Entrada de nova solicitação usa texto/contexto. Fonte principal `account_records`, mensagens, feedback e pedidos de reabertura; nota interna e mensagem pública não são o mesmo campo/efeito.

## Transições e guardas localizadas

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Sem ocorrência | Abrir Cliente | Perfil client ativo com empresa; mensagem >=2 | Cria registro `open`, client visibility/source e primeira conversa |
| `open` criado pelo Cliente | Excluir Cliente | Próprio autor/empresa, ainda open, sem primeira abertura Admin nem mensagem Admin válida | Remove solicitação/notificações pertinentes; não é exclusão geral de qualquer ocorrência |
| Ocorrência aberta | Abrir Admin | Runtime chama marcação de abertura | Registra first_admin_opened_at; elimina possibilidade anterior de exclusão pelo cliente |
| Open/in_progress/waiting_client | Responder Cliente | Perfil ativo, própria empresa e visibility client; texto não vazio | Se waiting_client, passa in_progress; atualiza atividade/ação |
| Ocorrência não completed/cancelled | Responder Admin | Perfil ativo; mensagem pública | Passa waiting_client e atualiza autoria/atribuição/atividade |
| Ocorrência aberta/standby | Nota interna Admin | Role admin para p_internal; não encerrada/cancelada | Mensagem internal, atualiza atividade; sem notificar Cliente por esse caminho |
| Qualquer estado encontrado | Alterar status Admin | `is_admin`, destino no enum | Open/in_progress/waiting_client/standby/completed/cancelled; closed_at conforme destino |
| Completed | Avaliar Cliente | Perfil client ativo, própria empresa, visibility client; 1–5, motivo >=3 em 1–3 | Upsert de feedback por usuário/registro; não reabre |
| Standby/completed/cancelled | Pedir reabertura Cliente | Própria empresa/client visibility; motivo >=3; completed exige avaliação prévia do solicitante | Pedido pending; pedido já pending retorna existente; registro permanece fechado/em espera |
| Pedido pending | Aprovar Admin | `is_admin`, decisão válida e pedido não decidido | Pedido approved; ocorrência in_progress e conversa de decisão |
| Pedido pending | Recusar Admin | Mesma guarda; motivo >=3 | Pedido rejected; mantém status de ocorrência, registra resposta |

Cliente não pode mandar mensagem em standby, completed ou cancelled. Admin também não posta mensagem comum em completed/cancelled no corpo localizado. Admin pode voltar diretamente para in_progress pela RPC de status; ela também aprova pedidos pending associados. Não inventar proibição de reabertura administrativa direta.

## Mensagens, autoria e anexos

RPCs de edição/exclusão exigem Admin e mensagem de author_role admin; mensagens Cliente permanecem originais. Exclusão é lógica por `deleted_at`. Não há guarda localizada exigindo que seja o mesmo usuário Admin autor; não converter “mensagem Admin” em “somente minha mensagem”. Reações têm RPC e acesso próprios.

Anexos usam bucket privado e caminhos do contexto. Policies de upload/leitura devem ser lidas junto do vínculo da mensagem; upload bem-sucedido não equivale a mensagem postada. Notas internas não entram no DTO de conversa cliente.

## Continuidade, falhas e aceite

Selecionar ocorrência mantém lista/filtros; deep link de protocolo/objeto precisa de autorização. Composer tem rascunho local; envio/erro deve preservar texto e não duplicar mensagem. Campos/regras de SLA não foram fechados como contrato universal nesta leitura.

Aceite proposto: leitura A/B, nota interna ausente no Cliente, reply em cada status, exclusão antes/depois da abertura Admin, feedback inválido, reabertura com/sem avaliação, pedido já pending, decisão concorrente, mensagem de outro autor Admin, anexo sem postagem, falha de notificação. Responsividade/teclado seguem contrato comum; não validados.

**Dúvidas:** `REF-16` (notificações/entrega), `REF-18` (amplitude de privilégios/imutabilidade), `REF-24` (SLA e continuidade não comprovados). Não misturar regra de edição de mensagem com regra de exclusão da solicitação.
