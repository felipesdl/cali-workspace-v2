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

O [piloto V2 de alteração ordinária](../contracts/PHASE_4_READ.md#remarcação-e-cancelamento-de-reunião-ordinária) reaproveita as RPCs de mudança, exige decisão com motivo e revalida conflito na confirmação. O cancelamento apresentado é local ao Workspace. Transporte e sincronização externos ainda precisam de homologação.

- Deep links levam ao pedido/evento correto; filtros de calendário não concedem acesso. Pedido de remarcação não deve aparecer como nova reunião confirmada.
- E-mail, convite Google, criação de Meet e sincronização são etapas separadas. `pending`, registro local e toast não comprovam evento externo ou entrega ao participante.
- Repetição/concorrência: trigger impede pedidos pendentes duplicados por slots em determinadas condições; não é garantia universal de idempotência entre v1/v2/extra.
- Cancelar/reagendar pode mexer em evento e solicitação; preço aceito permanece histórico. Não calcular nova cobrança/fine apenas pelo texto da UI.
- Em falha, preservar opções e indicar qual etapa falhou; essa política é aceite proposto para a V2, sem certificar sua uniformidade atual.

## Aceite proposto e dúvidas

Testar empresa diferente, evento passado/cancelado, opção duplicada, conflito de agenda, pedido pending concorrente, duração/janela, prazo útil, extra aceito, preço já salvo, sync com erro, múltiplos participantes e anexos privados. Verificar calendário após reload/Back/mobile.

`REF-12`: corpos ausentes de scheduling v1/v2/política/outcome e diferenças entre caminhos; `REF-16`: efeitos externos/idempotência; `REF-05`: operações compostas; `REF-24`: continuidade UX. Valores acima são regra encontrada no código da revisão, não aprovação de tabela comercial para futuras contratações.

A agenda ordinária V2 foi homologada no CALI MAPA: solicitação, oferta, confirmação, remarcação no mesmo evento e cancelamento. O teste preservou a condição sem cobrança e não chamou Google/Meet. [Contrato e evidência](../contracts/PHASE_4_READ.md#lote-de-agenda-ordinária-no-cali-mapa).

A V2 inclui o registro de realização de reunião ordinária após o fim do compromisso, validado no PostgreSQL descartável. Admin registra, Cliente consulta a situação. [Contrato e limites](../contracts/PHASE_4_READ.md#registro-de-realização-de-reunião-ordinária).

Quando o resultado admite reposição, Admin oferece horário e Cliente confirma. O horário mantém a duração e precisa ter sessão contratual disponível no mês de destino. A reunião anterior fica no histórico. [Contrato e prova local](../contracts/PHASE_4_READ.md#reposição-de-reunião-ordinária).

O piloto consulta os participantes da reunião ordinária com a visibilidade do evento e mostra os pedidos extras em uma lista separada. Admin gerencia convidados externos em reunião local e publica link e PDF na ata da reunião realizada. O solicitante aceita o orçamento online com o valor e as condições exibidas. Os pedidos adicionais inscritos têm ações por papel e estado. [Homologação e limites](../contracts/PHASE_4_READ.md#materiais-da-ata-convidados-locais-e-encontros-adicionais).

O [lote de abertura de extras e despesas](../contracts/PHASE_4_READ.md#abertura-de-extras-revisão-de-orçamento-e-despesas) validou pedidos novos, orçamento pendente, recusa, taxa de cancelamento e registro de despesa. A [conclusão da visita e comprovantes](../contracts/PHASE_4_READ.md#conclusão-da-visita-extra-e-comprovantes-no-cali-mapa) validou realização, despesa com PDF privado e confirmação em horário de evento cancelado pelos dois perfis. Evento ativo continua ocupando o horário.

## Revisão pré-rollout

A candidata do PR #3 sincroniza reuniões ordinárias já confirmadas e mudanças aprovadas com o calendário Google configurado no servidor. Também sincroniza visita extra confirmada vinculada ao pedido e reunião online extra após aceite do orçamento; visita presencial não pede Meet, reunião remota pede Meet se ainda não tiver link. Cancelamento/remarcação de visita extra remove o evento anterior somente quando o pedido confirmado registra a mudança e o evento cancelado tem o mesmo `source_entity_id` e timestamp da mudança, conforme contrato V1. Evento sem vínculo externo recebe ID determinístico; se evento já tiver `google_event_id` e `google_calendar_id` igual ao destino explícito, atualização/remarcação preserva o ID existente. ID legado sem calendário comprovável ou destino diferente bloqueia escrita e exige reconciliação. O caminho do preview suprime convites externos e não envia `event_attendees` ao Google; estado local de convidados permanece preservado. A conexão, conta, destino e escopos do preview ainda precisam de conferência no ambiente.

No preview separado, definir `CALI_AGENDA_CALENDAR_CONNECTION_ID` e `CALI_AGENDA_TEST_CALENDAR_ID` na Edge `workspace-agenda-calendar`, com o ID exato de um calendário de teste e conexão ativa de Admin. Conferir a origem em `CALI_ALLOWED_ORIGINS`, as credenciais Google no servidor e o JWT do gateway. Só então ligar `VITE_CALI_GOOGLE_CALENDAR_SYNC=true` no frontend. Validar criação do link Meet, remarcação, cancelamento, falha e retentativa. [Roteiro de preview](../RUNBOOK.md#preview-protegido-para-homologação)

Implementação local também exige aceite corrente de termos; Admin precisa AAL2. Conexão é selecionada pelo ID configurado, sem escolher o Admin/calendário mais recente; `primary` não é permitido. Operações usam attendee ausente, `sendUpdates=none`, timeout de 25 s e CAS do recibo por empresa/horário/estado. Cancelamento aprovado remove ID salvo ou ID determinístico; se Google concluir e gravação local do recibo falhar, retentativa repete delete idempotente. ID legado só pode ser atualizado/removido quando evento também prova o calendário configurado; caso contrário bloqueia escrita. Simulador cobre reunião ordinária, visita extra sem Meet, reunião online extra com Meet, retry concorrente no mesmo ID, vínculo externo explícito, payload sem convidados e delete idempotente.

A Edge agora exige lease persistente por evento: RPC candidata `cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)` é service-role-only, aquisição atômica, TTL de 10 minutos e release condicionado ao token de fencing. Depois de adquirir, a Edge relê o estado de origem; operação ocupada retorna `status=busy` com intervalo de retry. Se o recibo da criação perde CAS para um cancelamento local, a Edge remove o evento Google criado sob o mesmo lease e tenta registrar `cancelled_google`. Provas locais do handler cobrem busy/retry, vínculo de cancelamento extra e delete; o PostgreSQL descartável confirmou concorrência, expiração/crash, retry, fencing, release e grants. A candidata SQL não foi aplicada. Remarcação ordinária segue em `sync_change`; remarcação extra remove apenas o evento anterior validado pelo contrato e o novo horário só é sincronizado depois da confirmação CALI existente. Ainda não houve deploy, chamada Google, conferência do schema/conexão efetivos ou prova de Meet gerado. Link é apresentado apenas após URL do Google validada.
