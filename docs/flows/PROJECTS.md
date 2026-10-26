# Projetos, planejamento e entregáveis

Fichas FLOW-05/06. Contexto/estados comuns: [README](README.md). A execução e a aprovação são dimensões diferentes; não reduzir projeto, entrega e subtarefa ao mesmo enum.

## Alvo V2 confirmado em 26/10/2026 para correção de entrega

Admin pode reabrir o mesmo item aprovado, mediante motivo e histórico (**DEC-06**). Durante a correção, item fica indisponível ao Cliente até nova liberação (**DEC-11**). Preservar histórico das aprovações e alterações anteriores; reabrir não apaga o que ocorreu nem concede acesso ao rascunho.

Após liberar correção, o entregável exige **nova aprovação do Cliente (DEC-12)**. Aprovação anterior permanece no histórico, sem aprovar automaticamente o conteúdo corrigido. Não impor novo cadastro como substituto obrigatório da reabertura escolhida. As transições de fontes abaixo são retrato do oficial e não implementação do alvo.

| Etapa alvo | Ator/condição | Resultado exigido |
| --- | --- | --- |
| Aprovado | Admin reabre, informa motivo e preserva histórico | Mesmo item em correção, indisponível ao Cliente |
| Em correção | Admin conclui revisão e libera | Cliente volta a ter acesso ao conteúdo liberado, aguardando nova aprovação |
| Correção liberada | Cliente aprova | Nova aprovação vinculada à revisão corrigida; validações antigas preservadas |

## FLOW-05 — Planejar, compartilhar, ajustar e ativar projeto

**Objetivo/atores/entrada:** Admin estrutura projeto/frentes/entregáveis em `/admin/projetos`; Cliente valida cronograma em `/cliente/entregaveis`. Fontes: [Admin UI](SOURCES.md#projects-ui), [revisão/visibilidade SQL](SOURCES.md#schedule), [runtime de operação](SOURCES.md#schedule-runtime), [predicado posterior](SOURCES.md#lifecycle-view), [ciclo de vida](SOURCES.md#lifecycle), [patch de horas corridas](SOURCES.md#response-hours).

**Dados/formulário/anatomia:** empresa, nome/objetivo, frentes, responsáveis, datas, complexidade, dependências e janela de cronograma. Client view apresenta contexto, cronograma, entregáveis e histórico; seleções por projeto/objeto são estado de contexto, não autorização.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Sem projeto | Criar Admin | UI/INSERT Admin | `planning_status=draft`; composição inicial de frentes/entregas |
| `draft` | Alterar/remover frente Admin | RPC exige Admin e projeto ainda draft; remoção trata destino dos entregáveis | Mantém rascunho, atualiza composição |
| `draft` | Compartilhar Admin | Trigger valida agenda/estrutura antes do share | `client_review`; abre `project_review_requests.pending`, número 1 e vencimento |
| `client_review` | Pedir ajuste Cliente | Própria empresa, revisão pending, motivo >=3, alvo project/workstream/deliverable válido; número da revisão <=2 | Revisão/projeto `adjustment_requested`, registra alvo/prioridade e notifica Admin |
| Pedido de ajuste | Resolver Admin | Admin, justificativa >=3, pedido ainda não resolvido | Revisão `accepted` ou `rejected`; abre próxima pending; projeto volta a `client_review` |
| `client_review` | Aprovar Cliente | Própria empresa e revisão pending | Revisão approved; projeto `active`, timestamps, frentes planned passam active; desloca datas e recalcula forecast |
| Execução | Pausar/suspender/cancelar/retomar Admin | RPC lifecycle exige Admin, alvo/justificativa e guardas específicas | `execution_status=paused/suspended/cancelled/normal`; eventos e eventual recálculo de datas; cancelar projeto também fecha planejamento |

Prazo da revisão é alterado por migration posterior usando `pg_get_functiondef/replace`: `now()+24*client_response_business_days` horas, padrão 3. É evidência de intenção de 72 horas corridas no código, não prova do patch aplicado. Esse prazo não substitui o prazo de dúvida de relatório, que continua outro contrato.

O runtime posterior [de regras v39](SOURCES.md#schedule-v39) também chama `client_request_project_schedule_adjustment_v39`, com ações de reagendar/trocar ordem e checagem visual de complexidade equivalente. Seu corpo SQL não foi localizado. As guardas da RPC v38 da tabela acima não certificam esse caminho v39.

**Visibilidade:** Cliente só acessa projeto da própria empresa nos planning statuses enumerados no predicado (`client_review`, `adjustment_requested`, `approved`, `active`, `rebriefing`, `closed`). Entrega também requer visibilidade, vínculo a projeto e não cancelada. Rascunho não é conteúdo cliente. Admin tem políticas amplas além das RPCs específicas.

**Continuidade/falhas:** preserve projeto selecionado e objeto no retorno; deep links não podem depender de texto do DOM. Runtime atual deriva contexto de seletores e injeta dialogs; V2 precisa registrar ação explicitamente. Conflito de revisão já respondida deve atualizar estado, não repetir mutação. Criação de projeto/frentes e uploads não foram demonstrados como uma transação única.

**Aceite proposto:** ocultar draft de Cliente; primeira/segunda/terceira revisão; rejeição com justificativa; concorrência de aprovação/ajuste; deslocamento de datas com timezone; pausa e retomada com dependências; empresa diferente negada. **Dúvidas:** `REF-07` (guardas diferentes e caminhos diretos), `REF-23` (patch/ordem aplicada), `REF-24` (continuidade); `OPEN-03` ganha evidência estática, mas contrato ativo permanece não verificado.

## FLOW-06 — Executar, revisar, aprovar entrega e subtarefa

**Objetivo/atores/entrada:** Admin conduz entrega/revisão; Cliente responde sobre objeto compartilhado; subtarefas podem ser aprovadas por partes. Mesmas rotas de projeto, com detalhe contextual, conversas, arquivos e histórico.

**Fontes:** [status Admin](SOURCES.md#deliverable), [ajustes](SOURCES.md#adjust), [aprovação/avaliação](SOURCES.md#approval), [Cliente UI](SOURCES.md#deliverable-ui), [subtarefa](SOURCES.md#tasks), [limite de ajuste](SOURCES.md#task-adjust), [dependências](SOURCES.md#dependencies), [comentários](SOURCES.md#file-comments).

**Dados/anatomia/formulários:** identidade/protocolo da entrega, versão de arquivo compartilhável, situação, responsável/datas, subtarefas visíveis, dependências, conversa e histórico. Solicitar ajuste pede motivo; aprovação abre avaliação 1–5 e comentário obrigatório para 1–3. Não usar essa escala como NPS universal fora do contrato localizado.

| Objeto/anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Entrega em trabalho | Mudar status Admin | RPC permite destino `not_started/in_progress/standby/internal_review/client_review/rebriefing/approved/cancelled`; motivo >=3 em standby/rebriefing/cancelled | Atualiza status/timestamps; aprovado bloqueia saída por essa RPC |
| Entrega `client_review` | Aprovar Cliente | Autenticado, própria empresa, client_visible, status exato; nota 1–5, motivo >=3 em 1–3 | `approved`, locked/closed; NPS response; fecha timers; subtarefas não canceladas viram `done` |
| Entrega | Pedir ajuste Cliente ou Admin pela RPC | `can_access_company`, motivo >=3; não há guarda de status de origem equivalente à UI no corpo localizado | `adjustment_requested`, contador e evento; se excede limite do projeto (fallback 3), rebriefing_required e projeto rebriefing |
| Subtarefa `client_review` | Aprovar Cliente | `client_visible_task`: própria empresa, task visível e entregável visível | Subtarefa `approved`, evento; não aprova a entrega inteira |
| Subtarefa `client_review` | Pedir ajuste Cliente | Mesma visibilidade; menos de dois ajustes; texto >=10 | `doing`, incrementa adjustment_count, insere mensagem e notificação |
| Subtarefa aberta | Conversar Cliente | Mesma visibilidade; texto não vazio; estado não approved/done/cancelled | Mensagem client_visible; não cria nota interna |
| Entrega compartilhada | Conversar Cliente | RPC/contexto de comentário e vínculo de empresa | Mensagem na fonte contextual; notificações seguem regras posteriores de comunicação |
| Dependência de cliente | Solicitar/receber Admin | Contrato de dependência e revisões de prazo | Registro próprio; não equivale à aprovação da entrega |

**Divergências importantes:** UI de ajuste só aparece em `client_review`, mas RPC `request_deliverable_adjustment` localizada não verifica esse estado, visibilidade do entregável ou bloqueio de aprovado. Admin também tem UPDATE direto por policy. Logo “aprovado é imutável” não está comprovado para todos os caminhos; descrever trava por operação, não garantia global. Ajuste de cronograma, ajuste de entregável e ajuste de subtarefa têm contadores/guardas diferentes.

**Continuidade/falhas:** erro de ajuste/nota mantém formulário; fechar overlay antes de confirmar não deve aprovar. Timer pode ser fechado por aprovação concorrente. Arquivo final proposto não é automaticamente publicado; publicação é FLOW-11. Notificações/e-mail não são confirmados apenas pela resposta da RPC.

**Aceite proposto:** aprovar somente conteúdo liberado da própria empresa; nota/comentário; reabrir mesmo item apenas por Admin com motivo; acesso negado durante correção; nova aprovação após liberação sem reutilizar a antiga; conversa fechada; terceiro ajuste da subtarefa negado; limite de entrega distinto; pai x filho; acesso direto à RPC com estado indevido. **Pendências técnicas:** `REF-07`, `REF-16`; decisões de reabertura/validação resolvidas. Não implementar nesta etapa.
