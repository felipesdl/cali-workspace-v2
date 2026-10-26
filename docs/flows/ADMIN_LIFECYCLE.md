# Avisos, administração e ciclo de dados

Fichas FLOW-13/15/16/18. Estado: observado em fontes, não validado no ambiente. [Contrato comum](README.md); [matriz](../PERMISSIONS.md). Operações descritas, inclusive destrutivas, não foram executadas nem autorizadas por esta documentação.

## FLOW-13 — Publicar aviso, comentar, reagir e registrar ciência

**Objetivo/atores/entrada:** Admin comunica a todas ou a empresas selecionadas; Cliente lê seu público, comenta, reage e confirma ciência. Rotas `/admin/avisos` e `/cliente/avisos`; deep link usa `aviso` no search param.

**Fontes:** [UI](SOURCES.md#notice-ui), [RLS/estado](SOURCES.md#notice), [reações](SOURCES.md#notice-reaction), [notificação](SOURCES.md#notice-mail).

**Dados/anatomia:** categoria feriado/atendimento/comunicado, título, corpo, data/horário/abrangência, capa, público e targets. Lista/mural, detalhe e editor Admin. Comentários têm empresa de destino; não são uma conversa global entre clientes.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Novo/existente | Salvar/publicar Admin | UI exige título/corpo e empresas se selected; policy Admin escreve notices/targets | Published; grava metadados/capa/targets em etapas, chama notify_notice |
| Published | Arquivar Admin | UPDATE de status | Archived; sai da leitura Cliente pela função de visibilidade |
| Archived | Restaurar Admin | UPDATE de status | Published; política permite leitura ao público novamente |
| Published autorizado | Ler Cliente | can_read_notice: empresa vinculada e audience all ou target da empresa | Conteúdo; ciência ainda não presumida |
| Sem ciência | Confirmar Cliente | Insert exige próprio user, company do contexto e aviso legível | Cria acknowledgement |
| Com ciência | Desfazer Cliente | Delete de próprio user | Remove acknowledgement; não é registro irreversível nesta implementação |
| Aviso autorizado | Comentar Cliente | Próprio autor/company; role client; aviso legível | Comentário na empresa; Admin pode responder escolhendo empresa |
| Mensagem de aviso | Excluir Admin | Policy Admin DELETE de notice_comments | Remove comentário; Cliente não tem DELETE equivalente localizado |
| Reação própria | Reagir/trocar/remover Cliente/Admin | Insert próprio/aviso legível; update/delete próprios têm condições distintas | Like/love/clap, uma reação por usuário/aviso |

**Continuidade/falhas:** fechar detalhe remove parâmetro aviso; reactions usam atualização otimista com rollback em erro. Salvar aviso faz várias chamadas e o retorno de notify_notice não é tratado como garantia de envio externo. Calendar lê notices como fonte, mas regra de inclusão temporal tem dono próprio. Não copiar listas locais divergentes da V2.

**Diferença de camadas:** UI impede Admin de confirmar ciência; SQL de acknowledgement não proíbe explicitamente Admin que satisfaz as condições. Capa de aviso possui policy de leitura por prefixo `notices` para authenticated, sem consultar target; visibilidade do conteúdo e acesso à imagem não são a mesma garantia.

**Aceite proposto:** audience all/selected/A/B; arquivar/restaurar; comentário da empresa correta; ciência/desfazer; reação concorrente/retry; falha ao atualizar targets e capa; notify que falha; capa fora do público. **Dúvidas:** `REF-17` (policies/ciência/capa), `REF-05` (multi-write), `REF-16` (entrega).

## FLOW-15 — Administrar equipe CALI e decidir submissões

**Objetivo/atores/entrada:** Admin em `/admin/equipe-cali` cadastra Partner, atribui empresas/módulos, convida e decide itens enviados. Operação detalhada do papel Partner não integra a matriz Cliente/Admin solicitada; sua administração e efeitos em Cliente integram esta ficha.

**Fontes:** [staff/RLS](SOURCES.md#staff), [Admin UI](SOURCES.md#staff-ui), [convite EDGE](SOURCES.md#staff-invite), [decisão de horas](SOURCES.md#staff-review), [timer Partner posterior](SOURCES.md#hour-idle).

**Dados/anatomia:** nome, e-mail, módulos, empresas, ativo, convite/aceite e fila de submissões; detalhe com justificativa de aprovar/devolver/recusar. Cliente não possui rota nem policy de gestão staff no recorte localizado.

| Anterior | Ação Admin | Guarda/efeito localizado |
| --- | --- | --- |
| Sem membro | Salvar | INSERT staff_members; atribuições em chamadas separadas; não cria colaborador cliente |
| Membro ativo/inativo | Alterar módulos/empresas/ativação | Policy Admin em membro/assignments; efeito exato na sessão/perfil requer reconciliação |
| Membro ativo | Enviar convite | EDGE verifica `is_admin`, membro existente/ativo; envia e-mail |
| Hora submetida pending | Aprovar | RPC exige Admin, lock e pending; cria lançamento via manual com justificativa e client_visible=false; marca approved |
| Hora submetida pending | Recusar | Admin, motivo obrigatório; rejected e evento de decisão; não cria lançamento |
| Revisão de material pending | Aprovar/devolver | UI aplica operação e depois atualiza staff_review_requests; approved/returned conforme item; pode enviar entrega para client_review ou concluir ocorrência |

Não afirmar que **todas** as horas Partner passam pela fila: migration posterior introduz timer/lançamento direto; a fila manual e o caminho de timer coexistem. Aprovação de revisão pode realizar várias escritas, com risco de estado intermediário. Não confundir “revisado pelo Admin” com publicação/envio de cada tipo de material.

**Continuidade/falhas/aceite proposto:** erro de convite não marca aceito; membro desativado perde operação esperada; retirada de atribuição deve impedir acesso e limpar contexto; decisão pending repetida/concorrente não duplica horas; falha ao aplicar material antes de registrar decisão precisa ser reconciliada. **Dúvidas:** `REF-01`, `REF-05`, `REF-04` (paridade/definições externas aplicáveis).

## FLOW-16 — Auditoria e tratamento de satisfação

Alvo confirmado: geração, aprovação, liberação e envio de relatórios são eventos distintos de auditoria, vinculados ao objeto/revisão e ator. [Regras de produto](../PRODUCT_RULES.md) não permitem usar um toast ou fila como comprovação de entrega externa. Administração de equipe CALI continua no recorte Admin; área Partner completa permanece posterior no roadmap.

**Objetivo/atores/entrada:** Admin consulta `/admin/auditoria` e `/admin/satisfacao`. Cliente fornece avaliações pelos fluxos de entrega/ocorrência, não pelo painel Admin.

**Fontes:** [auditoria UI](SOURCES.md#audit), [policy inicial activity_log](SOURCES.md#schema), [follow-up de satisfação](SOURCES.md#satisfaction), [feedback de ocorrência](SOURCES.md#records-reopen), [avaliação de entrega](SOURCES.md#approval), [resposta de privacidade](SOURCES.md#privacy-ui).

**Dados/anatomia:** timeline de eventos/protocolo/ator/empresa/período; agrupamento e detalhe de trilha. Satisfação agrega respostas existentes; tratamento registra origem/id, tema, nota interna e handled_at/by, sem mudar nota do Cliente.

| Anterior | Ação Admin | Guarda/resultado |
| --- | --- | --- |
| Eventos existentes | Filtrar/abrir trilha | Leituras das fontes e filtros locais; sem transição de negócio |
| Avaliação sem tratamento | Marcar tratada | Policy Admin; uma linha por source_type/response_id |
| Tratamento existente | Ajustar acompanhamento | Policy Admin permite operação; não altera feedback original por esse registro |
| Pedido de privacidade open | Responder | UI valida texto e chama `admin_answer_data_subject_request`; corpo não versionado, sem comprovar estado final só por toast |

**Divergência:** UI diz que histórico não pode ser editado/apagado, mas policy inicial `activity_admin_all FOR ALL` não demonstra imutabilidade de banco. São garantias diferentes; não certificar append-only nem oferecer edição como requisito da V2.

**Continuidade/falhas/aceite proposto:** filtro por empresa/ator/protocolo correto; vazios distintos de erro; consulta privada restrita; tratamento não altera avaliação; feedback Cliente original preservado; resposta de privacidade rastreável. **Dúvidas:** `REF-18` (imutabilidade e acesso amplo), `REF-04` (RPCs de satisfação/privacidade sem corpo completo quando aplicável), `REF-24` (filtros/UX).

## FLOW-18 — Frentes, ajuda, direitos e fim de contrato

**Objetivo/atores/entrada:** Cliente entende escopo/frentes e solicita apoio/direitos; Admin configura frentes, responde pedidos, exporta e conduz encerramento/eliminação autorizados. Contexto: `/cliente/frentes`, ajuda/perfil, `/admin/clientes` e auditoria; páginas legais públicas não concedem acesso ao workspace.

**Fontes:** [frentes](SOURCES.md#fronts), [perfil/direitos](SOURCES.md#profile-ui), [privacidade SQL](SOURCES.md#privacy), [exportação](SOURCES.md#export), [encerramento](SOURCES.md#access-close), [eliminação](SOURCES.md#elimination), [sequência UI](SOURCES.md#elimination-ui), [versão legal](SOURCES.md#legal).

**Dados/anatomia:** leitura do escopo atual, catálogo/frentes e ação de solicitar conversa; direitos no próprio perfil; Admin vê identificação da conta, destino da exportação, estado de encerramento e confirmação nominal de eliminação. Textos legais são fonte do produto, não parecer jurídico desta análise.

| Anterior | Ação/ator | Guarda localizada | Seguinte/efeito |
| --- | --- | --- | --- |
| Escopo atual | Consultar Cliente | Catálogo para authenticated; company_fronts da própria empresa | Leitura; não contrata automaticamente frente |
| Frente configurada | Ativar/encerrar Admin | Policy/trigger Admin, regras de plano/modo/slots | Company_fronts active/ended; não altera workstream de projeto como sinônimo |
| Usuário autenticado | Pedir acesso/correção/exclusão/outro | UI valida e chama RPC de direitos | Registro open/answered/closed previsto na tabela; corpo não localizado |
| Conta acessível | Encerrar/bloquear/arquivar Admin | FLOW-02 e trigger | Perfis Cliente inativos; isso não elimina dados |
| Conta existente | Exportar Admin | `is_admin`, destinatário >=3 caracteres, empresa existe | JSON com dados restritos separados; registra destinatário/auditoria; UI pode montar pacote de arquivos |
| Closed há pelo menos 45 dias | Listar/eliminar Admin | RPC exige Admin, closed_at válido, prazo e ainda não eliminada; confirmação do nome | UI remove storage primeiro; RPC remove dados operacionais, anonimiza perfis e mantém exceções/auditoria |
| Conta eliminada | Repetir | Guarda de data_eliminated_at | Não elegível; não assumir que reativar recupera informação removida |

**Limites de comprovação:** 45 dias é regra de código consultada, não confirmação de conformidade legal. Rotina gera alerta; botão executa ação, não exclusão automática geral. Exportação não exige o mesmo prazo de eliminação. Definições de exportar meus dados/pedir/responder direitos são mencionadas, sem corpo versionado.

Storage e banco não têm atomicidade conjunta; se banco falha após remover arquivos, não se pode dizer que “nada foi eliminado”. Listas de tabelas/paths são explícitas e precisam ser reconciliadas com novos módulos `public`, forms/profile e integrações externas; não garantir cobertura total de portabilidade/eliminação.

**Aceite proposto:** Cliente só própria empresa; solicitar frente sem alterar contrato; Admin registra destinatário; pacote separa dados privados; 44/45 dias e conta paused/blocked x closed; confirmação nominal; falha após storage; dados preservados conforme lista; ausência de cópia externa tratada explicitamente. **Dúvidas:** `REF-22` (cobertura/atomicidade), `REF-02` (uso x adesão), `REF-04` (RPCs ausentes), `REF-16` (integrações). Nenhum desses cenários foi executado.
