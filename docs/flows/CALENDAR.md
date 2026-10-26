# FLOW-09 — Agenda, solicitações e alterações

Estado: ficha documental preenchida com contratos encontrados e operações cujo corpo não foi localizado. [Contexto comum](README.md); [permissões](../PERMISSIONS.md). Não há sincronização nem chamada real nesta análise.

## Objetivo, atores e entrada

Cliente acompanha agenda em `/cliente/cronograma`, solicita reunião/extra e responde às opções. Admin mantém `/admin/calendario`, analisa pedidos, confirma decisões e registra realização/ata. Google/Meet e destinatários externos são integrações, não papéis de acesso ao workspace.

**Fontes:** [Cliente UI](SOURCES.md#agenda-ui), [runtime de solicitações](SOURCES.md#agenda-runtime), [política v2](SOURCES.md#agenda-policy), [mudança de reunião](SOURCES.md#agenda-change), [visita extra](SOURCES.md#extra-visit), [contraproposta](SOURCES.md#extra-counter), [alterar visita](SOURCES.md#extra-change), [online extra](SOURCES.md#extra-online), [proteção de preço](SOURCES.md#price-lock), [RLS inicial de eventos](SOURCES.md#schema).

## Dados, composição e estados

Contexto de empresa/período, vistas semana/mês/lista pertinentes, reunião/marco, detalhe, participantes, local/modo, situação e solicitação vinculada. Solicitação informa finalidade, título, modo e opções de horário; extra também exige ciência de condições. `events.cancelled_at`, status de `scheduling_requests`, status de mudança e `sync_status` são dimensões diferentes.

Cliente lê eventos da própria empresa com `visibility=client`. Não pode editar arbitrariamente a tabela de eventos pela policy inicial; usa RPCs de solicitação/decisão conforme o fluxo.

| Objeto/anterior | Ação/ator | Guarda observada | Resultado/limite |
| --- | --- | --- | --- |
| Sem pedido | Solicitar reunião normal Cliente | UI chama `create_scheduling_request_v1/v2`, com opções/ciência | Corpo dessas RPCs não versionado; validar regra de elegibilidade antes de portar |
| Pedido `submitted` | Propor horário/recusar Admin | UI chama `admin_respond_scheduling_request_v1` | Resposta/pedido de confirmação na UI; guardas SQL completas não comprovadas |
| Proposta recebida | Aceitar/pedir novas opções Cliente | UI chama `client_accept_scheduling_proposal_v1/v2` ou `client_request_new_scheduling_options_v1` | Corpos não localizados; não inferir confirmação efetiva/integridade |
| Visita extra em análise | Confirmar opção Admin | RPC `admin_confirm_extra_visit_v1` e condições da solicitação | Cria evento confirmado, vincula pedido e solicita sincronização |
| Visita extra `client_review` | Aceitar Cliente | Solicitante ou cliente ativo da empresa, índice de slot, futuro/janela/duração e conflito validados | `confirmed`, evento/participante e ciência/cobrança registradas |
| Visita `client_review` | Contrapropor Cliente | Cliente ativo da empresa; slots validados pelo helper | `submitted`, limpa proposta Admin, incrementa remarcação |
| Visita submitted/client_review/reschedule_review/confirmed | Cancelar/reagendar Cliente | Própria empresa, motivo >=5; reagendamento valida novas opções | `cancelled` ou `reschedule_review`; pode cancelar evento anterior; taxa não inferida automaticamente |
| Online extra novo | Solicitar Cliente | Cliente ativo; duas opções com 60 ou 90 min; ciência e nome conforme função | Valor registrado de 20000/30000 centavos e aceite no pedido, além dos campos herdados |
| Online extra legado pendente | Orçar Admin/aceitar Cliente | Valor/nota; solicitação elegível; quote do solicitante | Grava quote/aceite; Admin não sobrescreve pedido novo com valor fixo já aceito |
| Reunião futura ativa | Pedir mudança Cliente | Própria empresa, visibility client, meeting não cancelada; sem pending anterior; motivo >=5 | `agenda_change_requests.pending`; evento não é alterado nesse pedido |
| Mudança pending | Aprovar/recusar Admin | Admin, nota >=5, evento ainda ativo; slot escolhido para remarcar | `approved/declined`; aprovação altera horário/sync_pending ou marca cancelled_at |
| Evento | Registrar resultado/ata Admin | UI/RPC de outcome e attachment | Resultado/arquivo próprio; não confundir com evento apenas agendado |

Na remarcação ordinária localizada, Cliente oferece duas opções distintas, em dias/horários úteis, com 48 horas calculadas pelo helper de dias de semana e mesma duração. Não tratar “48 horas” como 48 horas corridas sem conferir a função. Extras têm validação própria.

## Continuidade, falhas e efeitos

- Deep links levam ao pedido/evento correto; filtros de calendário não concedem acesso. Pedido de remarcação não deve aparecer como nova reunião confirmada.
- E-mail, convite Google, criação de Meet e sincronização são etapas separadas. `pending`, registro local e toast não comprovam evento externo ou entrega ao participante.
- Repetição/concorrência: trigger impede pedidos pendentes duplicados por slots em determinadas condições; não é garantia universal de idempotência entre v1/v2/extra.
- Cancelar/reagendar pode mexer em evento e solicitação; preço aceito permanece histórico. Não calcular nova cobrança/fine apenas pelo texto da UI.
- Em falha, preservar opções e indicar qual etapa falhou; essa política é aceite proposto para a V2, sem certificar sua uniformidade atual.

## Aceite proposto e dúvidas

Testar empresa diferente, evento passado/cancelado, opção duplicada, conflito de agenda, pedido pending concorrente, duração/janela, prazo útil, extra aceito, preço já salvo, sync com erro, múltiplos participantes e anexos privados. Verificar calendário após reload/Back/mobile.

`REF-12`: corpos ausentes de scheduling v1/v2/política/outcome e diferenças entre caminhos; `REF-16`: efeitos externos/idempotência; `REF-05`: operações compostas; `REF-24`: continuidade UX. Valores acima são regra encontrada no código da revisão, não aprovação de tabela comercial para futuras contratações.
