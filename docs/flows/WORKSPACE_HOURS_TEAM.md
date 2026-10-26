# Workspace, Horas, Equipe e perfil

Fichas FLOW-04/07/08/14. Herdam [contexto, estados e validação comuns](README.md). Nenhuma operação executada. [Matriz de permissões](../PERMISSIONS.md).

## Alvo V2 confirmado em 26/10/2026 para FLOW-08

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

## FLOW-14 — Perfil, localizador e notificações

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
