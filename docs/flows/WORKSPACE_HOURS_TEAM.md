# Workspace, Horas, Equipe e perfil

Fichas FLOW-04/07/08/14. Herdam [contexto, estados e validação comuns](README.md). As tabelas abaixo registram a referência histórica; a execução da V2 está nos contratos [2B](../contracts/TEAM_2B.md) e [2C](../contracts/TEAM_MONTHLY_2C.md). [Matriz de permissões](../PERMISSIONS.md).

## Alvo V2 confirmado em 26/10/2026 para FLOW-08

[Regras de produto](../PRODUCT_RULES.md) e [Dados pessoais](../DATA_PRIVACY.md): pedido de dados do mês aparece somente ao Cliente; Admin acompanha a operação e faz correções autorizadas. Documentar finalidade/leitores/guarda e informação apresentada no acesso/coleta, sem prazo inventado. Pessoa focal não cria hierarquia de acesso.

- **DEC-05:** todos os até quatro acessos Cliente equivalentes da empresa mantêm pessoas/importação/arquivamento/revisão mensal; não há privilégio de principal.
- **DEC-09:** Cliente informa e consulta remuneração, revisão salarial, gênero e filhos da própria empresa; Admin também. A policy antiga de leitura privada Admin-only é evidência de diferença a reconciliar, não alvo a manter.
- **DEC-10:** lançamento inicial de métricas mensais é do Cliente; após gravado, correção é exclusiva do Admin. Não muda fórmula de indicador. Registrar autoria/estado anterior na futura correção; não confundir rascunho de formulário ainda não enviado com valor já lançado.

O código oficial descrito nas tabelas continua inalterado e diferente desse alvo. Detalhes de guardas, schema e trilha são trabalho de engenharia posterior, não permissão para executar agora.

## FLOW-04 — Prioridades e navegação contextual

**Objetivo/atores/entrada:** Cliente em `/cliente` identifica pendências de sua conta; Admin em `/admin` acompanha carteira e prioridades. Empresa cliente vem do perfil; Admin pode filtrar a carteira.

**Fontes:** [home Cliente](SOURCES.md#home-client), [home Admin](SOURCES.md#home-admin), [agregado](SOURCES.md#home-sql), [contexto SQL](SOURCES.md#schema).

**Dados/anatomia:** contexto contratual, execução, horas quando visíveis, próximo evento, relatórios/documentos e pendências. A RPC `get_client_home_work_metrics` é fonte de agregado; a home também lê fontes específicas. Um card não é autorização para abrir o objeto.

| Anterior | Ação/ator | Condição | Resultado |
| --- | --- | --- | --- |
| Inicial | Carregar Cliente/Admin | Perfil/rota e fontes de dados permitidas | Resumo do recorte; sem transição de negócio |
| Resumo | Abrir objeto/módulo | Link e acesso do destino | Navegação para fluxo correspondente; objeto deve ser autorizado novamente |
| Recorte atual | Mudar filtro Admin/atualizar | Dados do recorte correspondente | Recalcula apresentação; não altera estado de entidade |

**Continuidade/falhas:** filtros e links variam entre consumidores; restauração completa por URL não foi demonstrada. Cada bloco pode falhar independentemente; não preencher número ausente com zero como se fosse medido. Ao clicar, estado do objeto pode ter mudado.

**Aceite proposto:** pendências apontam ao objeto correto; resumo e detalhe mantêm mesma empresa/período; ausência de horas visíveis não vira consumo zero; Cliente não abre detalhe Admin. **Dúvidas:** `REF-24` (continuidade e especificação responsiva ainda propostas).

**Implementação V2 na fase 6.** Na Visão executiva Admin, a carteira mantém os totais da listagem de empresas. Ao selecionar uma empresa do piloto, a seção Prioridades operacionais lista projetos com ajuste solicitado e execução normal e, quando o detalhe de ocorrências está disponível, ocorrências em atendimento. Cada fonte declara que o recorte corresponde à primeira página e tem recuperação independente. Os atalhos abrem o cronograma ou a conversa mantendo a empresa na URL. Os destinos aplicam as próprias guardas. Agregados das demais fontes e homologação do recorte conectado seguem pendentes.

## FLOW-07 — Registro e consulta de Horas

**Objetivo/atores/entrada:** Admin registra atuação e controla capacidade em `/admin/horas`; Cliente consulta `/cliente/horas`, sem lançar/editar horas. Contexto: empresa, mês/ciclo e vínculo opcional a projeto, entregável, subtarefa ou ocorrência.

**Fontes:** [Admin UI](SOURCES.md#hours-ui), [Cliente UI](SOURCES.md#hours-client), [contexto/guarda](SOURCES.md#hour-scope), [timer/manual](SOURCES.md#hour-ops), [fechar sessão](SOURCES.md#hour-close), [inatividade posterior](SOURCES.md#hour-idle), [edição/auditoria](SOURCES.md#hour-audit), [visibilidade](SOURCES.md#hour-visibility), [resumo/breakdown](SOURCES.md#hour-read), [capacidade](SOURCES.md#hour-capacity).

**Dados/formulário/anatomia:** Admin informa empresa, vínculos, data, categoria, descrição, minutos e justificativa interna no manual. Cliente recebe resumo e extrato consultivo; não recebe justificativa interna pelo breakdown. Capacidade usa ciclo do mês se disponível, com fallback para capacidade mensal da empresa.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Sem sessão aberta | Iniciar Admin por `start_work_timer_v2` | `assert_hour_context`: Admin; conta não `closed`; projeto operacional e vínculos válidos | Timer `active`; inicia timestamps/status de trabalho pertinentes |
| Timer ativo | Pausar Admin | Timer do próprio usuário e ativo | RPC `pause_work_timer` chama fechamento de sessão; definição localizada termina em `stopped` ou `discarded`, não em `paused` |
| Timer ativo | Finalizar Admin | Próprio timer e ativo | Fecha lançamento; se subtarefa, marca `done`; se entregável, registra fechamento de trabalho |
| Sessão a fechar | Contabilizar | Menos de 30 segundos: descartar; a partir de 30: arredondar para cima em minutos | `discarded` sem lançamento ou `stopped` com `hour_entries` |
| Contexto operacional | Manual Admin | 1–1440 min, descrição e justificativa; `assert_hour_context` | Cria lançamento/auditoria e timestamps pertinentes |
| Lançamento existente | Editar/excluir Admin | RPC exige Admin, justificativa mínima de três caracteres; edição valida duração/descrição | Atualiza/exclui com evento contendo estado anterior |
| Mês selecionado | Consultar Cliente | Vínculo ativo e visibilidade por período | `visible:false` ou resumo/breakdown autorizados |
| Consumo aumenta | Trigger de capacidade | Capacidade > 0 e marcos ainda não registrados | Eventos 75%, 100%, excedente, 110% e terceira ocorrência; alertas distintos por público |
| Capacidade em análise | Pausar/retomar atividades Admin | UI e tabelas de capacidade; semântica completa do bloqueio não demonstrada | Registra pausa/revisão; não presumir que interrompe todas as RPCs de trabalho |

Índices versionados limitam timer aberto por usuário ([ativo](SOURCES.md#timer-index), [active/paused](SOURCES.md#timer-open-index)), enquanto a mensagem da RPC v2 fala em empresa. Não relaxar unicidade por interpretação do texto. Chamadas UI a `start_work_timer`/`resume_work_timer` não têm corpo versionado localizado; não declarar equivalência com `start_work_timer_v2`.

**Visibilidade importante:** resumo de 16/10 soma todas as horas operacionais do recorte, inclusive `client_visible=false`. Breakdown agrupa essas parcelas como “Outras”, redigindo título/protocolo/frente; não expõe detalhes internos. Policy de SELECT direto de `hour_entries` tem recorte diferente. Não recalcular o total pela lista visível.

**Continuidade/falhas:** mês sem base contratada resulta percentual nulo no resumo, não denominador inventado. Troca de mês precisa renovar resumo e detalhe juntos. Finalização e retry não são presumidos idempotentes; timer pode ter sido fechado por aprovação/inatividade. Inatividade só considera timer com heartbeat e tem definição posterior à migration inicial.

**Aceite proposto:** 29s/30s/61s; dois timers concorrentes; pausa/finalização; manual inválido; edição/exclusão justificada; mês invisível; horas internas agregadas sem dados privados; capacidade sem contratado e cruzamento de vários marcos; Cliente não grava. **Dúvidas:** `REF-08` (timer/retomada), `REF-09` (capacidade x docs antigos), `REF-23` (replay/estado aplicado).

A V2 prepara o painel de franquia, consumo, saldo e excedente com o cálculo do banco. O extrato mantém o recorte de lançamentos visíveis. Veja o [contrato de capacidade](../contracts/PHASE_4_READ.md#capacidade-e-saldo-de-horas-no-piloto). O [lote de lançamento e timer](../contracts/PHASE_4_READ.md#lote-de-lançamento-e-timer-no-cali-mapa) homologou o fechamento do trecho e a retomada com novo timer, preservando duração e privacidade. O [lote de correção](../contracts/PHASE_4_READ.md#correção-auditada-de-horas) validou edição hospedada e exclusão no banco descartável.

A tela também consulta marcos de capacidade e pausa já registrados. No lote local, Admin registra pausa para o mês com consumo acima da franquia e pode retomar antes do fim do mês. A decisão fica registrada no mesmo estado do painel legado e não interrompe timers. O mês fechado oculta os marcos para Cliente. A revisão administrativa e o limite de tolerância ficam no Admin. [Contrato e prova](../contracts/PHASE_4_READ.md#marcos-de-capacidade-em-horas).

Projetos oferece atalhos de Horas por entregável e subtarefa. O lançamento ou timer mantém o vínculo após reenvio e retomada. O CALI MAPA confirmou o lançamento manual por entregável e o ciclo completo do timer por subtarefa. [Contrato e prova](../contracts/PHASE_4_READ.md#horas-vinculadas-a-entregável-e-subtarefa).

Admin também inicia um timer privado no detalhe da ocorrência aberta. Horas mantém os trechos vinculados após pausa e retomada. O fechamento do timer preserva o estado da ocorrência. [Contrato e prova](../contracts/PHASE_4_READ.md#horas-vinculadas-a-ocorrência).

## FLOW-08 — Equipe, movimentos, fechamento e indicadores

**Objetivo/atores/entrada:** Cliente e Admin consultam `/cliente/equipe`/`/admin/equipe`. As RPCs de manutenção autorizam perfil ativo Admin **ou Cliente principal da própria empresa**. Não estender escrita ao cliente adicional por semelhança da tela.

**Fontes:** [UI](SOURCES.md#team-ui), [RLS e privados](SOURCES.md#team-private), [salvar pessoas](SOURCES.md#team-save), [revisão](SOURCES.md#team-review), [arquivar](SOURCES.md#team-archive), [métricas mensais](SOURCES.md#team-metrics), [frentes comerciais](SOURCES.md#fronts).

**Dados/anatomia:** diretório/ficha, estrutura, movimentações e indicadores. Formulário atual em uma tela; identificação profissional, cargo/departamento/gestor, vínculo, datas, situação `active/leave/terminated`, dados de afastamento/desligamento quando pertinentes. Dados opcionais privados exigem declaração de origem autorizada. Importação CSV apresenta novos/alterados/ausentes antes de confirmar.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Pessoa ausente/existente | Cadastrar/atualizar/importar Admin ou principal | Empresa `active`; mês atual ou anterior; até 2000 linhas; código único e campos permitidos/obrigatórios | Upsert por empresa/código, eventos e snapshot; pessoa arquivada pode ser reativada pelo upsert |
| Pessoa ativa/afastada/desligada | Alterar ficha | Mesma guarda; dados coerentes com status | Evento de admissão, desligamento, afastamento/retorno ou mudança conforme comparação |
| Pessoa em quadro atual | Arquivar Admin ou principal | Pessoa da empresa e ainda não arquivada | Define `archived_at/by`; preserva histórico; não é desligamento nem exclusão física |
| Revisão de mês | Confirmar Admin ou principal | RPC chama salvamento, valida vagas/answers e limita 200 vagas por envio | Atualiza mês/snapshots, vagas/eventos e revisão com incremento |
| Mês não confirmado/confirmado | Ler indicadores | Acesso às fontes; lógica de período na UI | Dados dos snapshots/movimentos e métricas; sem mutação de fórmula nesta tarefa |
| Métricas mensais | Lançar/editar Cliente pela UI | UI esconde lançamento de Admin; SQL INSERT/UPDATE usa `can_access_company` | Upsert em `team_month_metrics`; backend também admite Admin pelo predicado, divergindo da apresentação |

**Restrições observadas:** linha ausente do CSV nunca implica desligamento. Manager code precisa existir na empresa. Leitura de `team_member_private` é somente `is_admin`; Cliente principal pode enviar valores privados na RPC com declaração, mas não ler a tabela privada. Isso é escrita restrita sem leitura, não ausência de dados privados.

People Analytics está liberado na UI para Admin, plano Full ou frente ativa; indicadores essenciais permanecem disponíveis. Esse gate visual não equivale a policy impedindo Cliente de consultar fontes funcionais permitidas. Fórmula renderizada de rotatividade usa saídas/quadro ativo em pontos da UI; preservar como observado, sem homologá-la como fórmula de produto.

**Continuidade/falhas:** empresa/mês/aba têm estado e alguns parâmetros (`mes`, `aba`); colunas são preferência local por usuário/empresa. Mudança de empresa fecha detalhes/importação. Formulário/CSV preserva erro; origem privada precisa de consentimento operacional definido, não inferido do label.

**Aceite proposto para o alvo decidido:** até quatro Clientes equivalentes mantendo Equipe; remoção de um sem dependência de principal; Cliente informa/lê privados da própria empresa e não de outra; importação duplicada/gestor inexistente; faltantes preservados; janela de período; reativação de arquivada; 12 meses/retroatividade; lançamento inicial de métricas pelo Cliente e correção posterior somente pelo Admin, com autoria/histórico. Não mudar cálculo de headcount. **Pendências técnicas:** `REF-10/11`; fórmula/qualidade continuam em `OPEN-05`, sem nova regra inventada.

### Execução V2 no piloto — 05/11/2026

A [2B](../contracts/TEAM_2B.md) e a [2C](../contracts/TEAM_MONTHLY_2C.md) foram homologadas funcionalmente com A/B/Admin no CALI MAPA. Clientes equivalentes mantêm cadastro e confirmam o mês; métricas iniciais são do Cliente e correções posteriores do Admin com MFA, motivo e preimagem. Confirmação, vagas e snapshots usam operação própria, sem reenviar cadastro/métricas. Histórico, concorrência e recortes temporais seguem o contrato dono. A pendência em FLOW-04 aparece somente ao Cliente no Início e leva ao mês anterior. E-mails não foram ativados. Paridade visual e coleta real seguem pendentes antes do lançamento.

## FLOW-14 — Perfil, localizador e notificações

Contrato atual: chat não gera e-mail; atrasos e menções avisam o destinatário conforme operação. Resumo diário Admin está definido em RESUMO-01 / DEC-19: todos os dias às 19h de Brasília, ações por empresa nos dois blocos e horas; sem Cliente/staff/chat ou envio sem atividade. Conteúdo Partner fica para sua fase; digest de chat das 08h não retorna. Testar filtro, corte, volume, totais e duplicidade conforme Dados e contratos. Demais notificações têm contrato próprio.

**Objetivo/atores/entrada:** Cliente/Admin navegam pelo shell, abrem sinalização contextual, mantêm o próprio perfil e encerram sessão. Fontes: [chrome](SOURCES.md#chrome), [perfil](SOURCES.md#profile-ui), [perfil/contato SQL](SOURCES.md#contact), [notificações/RLS](SOURCES.md#schema), [privacidade](SOURCES.md#privacy).

**Dados/anatomia:** menu de conta, notificações, localizador de módulos, perfil com nome/cargo/contato/foto e assinatura. `update_my_profile_v56` altera o próprio perfil e pode sincronizar contato principal; não altera livremente papel/empresa. Upload de mídia tem caminho/bucket próprio.

| Anterior | Ação | Guarda/resultado localizado |
| --- | --- | --- |
| Perfil carregado | Salvar Cliente/Admin | RPC de próprio usuário; guarda/normalização de campos; atualiza identidade, não permissões |
| Notificação recebida | Abrir/marcar lida | UI chama funções de leitura e navega por URL de contexto; SELECT inicial permite próprias e Admin |
| Menu fechado | Buscar módulo | Localiza destino de navegação; não é busca de conteúdo da empresa |
| Sessão ativa | Sair | SignOut e redirecionamento conforme consumidor |
| Perfil/privacidade | Exportar próprios dados ou pedir direito | UI chama RPCs documentadas por comentário, mas seus corpos não constam no snapshot; não inferir capacidade de exportar empresa inteira |

**Continuidade/falhas/aceite proposto:** validar assinatura/foto sem conceder papel; URL de notificação cruzada não abre objeto de outra empresa; erro de marcação não simula persistência; logout limpa contexto; mídia falha sem apagar dados não relacionados. Requests de privacidade são FLOW-18. **Dúvidas:** `REF-04` (RPCs sem corpo), `REF-24` (continuidade/UX), `REF-01` (identidade x privilégio real).


### Perfil próprio na V2

Minha conta está disponível no shell conectado de Admin e Cliente. A consulta usa o ID da sessão pronta, com RLS de perfil próprio e política restritiva de sessão no CALI MAPA. Projeta apenas ID, nome, cargo, e-mail, telefone e WhatsApp. O papel exibido vem da sessão. O perfil comportamental continua em rota própria. A RPC legada `update_my_profile_v56` regrava foto, assinatura e demais campos junto dos dados básicos e pode sincronizar o contato principal. A edição da V2 aguarda contrato restrito de atualização para preservar mídia e campos omitidos.

### Permissões de notificações no CALI MAPA

Consulta em leitura aos GRANTs, políticas RLS e definições das funções no catálogo do CALI MAPA em 09/11/2026.

| Ator ou operação | Comportamento definido no banco |
| --- | --- |
| Anônimo | Sem acesso direto à tabela e sem execução das duas funções de marcação. |
| Usuário autenticado | `notifications_self_select` permite consultar as próprias linhas por `user_id = auth.uid()`. As permissões de tabela incluem UPDATE, mas essa política não permite atualização direta. |
| Admin aceito por `is_admin()` | `notifications_admin_all` permite ler e atualizar diretamente as linhas de outros destinatários. O helper avalia a lista de Admins e o requisito de MFA da sessão. |
| `mark_notification_read(uuid)` | Função `SECURITY DEFINER` com execução autenticada. Atualiza apenas a linha do próprio destinatário e mantém a data da primeira leitura. |
| `mark_all_notifications_read()` | Função `SECURITY DEFINER` com execução autenticada. Atualiza apenas as linhas ainda não lidas do próprio destinatário. |
| `service_role` | Permissões de leitura, atualização e execução, com bypass de RLS. Uso de servidor. |

A tabela não possui política restritiva de sessão viva. As funções retornam `void` e seus corpos não verificam sessão viva, admissão ou aceite vigente. Antes de conectar o sino da V2, falta delimitar a leitura e a marcação à sessão habilitada, verificar o resultado da ação e aplicar as guardas do destino. A consulta de catálogo não executou as funções nem alterou registros, permissões ou schema.
