# Fase 4 — Consultas de homologação

Primeiro incremento da fase 4. A publicação 83 continua como referência de interface e comportamento; a composição simplificada serve para validar os contratos do piloto. Paridade e aceite final seguem no [roteiro da Patrícia](../HOMOLOGACAO_PATRICIA.md).

Em 05/11/2026, leitura somente do catálogo do CALI MAPA conferiu colunas, políticas, gatilhos e corpos de RPCs. O incremento usa quatro novas RPCs em propostas SQL, sem mudar tabelas, grants legados ou gatilhos. Não houve aplicação hospedada.

| Domínio | Consulta implementada no código | Próxima entrega operacional |
| --- | --- | --- |
| 4A Projetos e entregáveis | Lista e detalhe, última revisão e prazo, frentes do projeto e entregáveis paginados | Rascunho estruturado, compartilhamento, aprovação/ajustes e execução; reabertura do mesmo entregável, histórico, bloqueio e nova aprovação |
| 4B Horas e agenda | Extrato por mês (soma dos lançamentos exibidos, sem saldo contratual), agenda do mês em Brasília | Timer/manual, capacidade e saldo conciliados, solicitação/reunião com estado real da integração |
| 4C Ocorrências, documentos e avisos | Ocorrências por visibilidade, metadados de documentos, avisos publicados para a audiência do Cliente | Conversas sem e-mail, anexos/versões/ciência e notificações, resumo diário Admin |
| 4D Relatórios e satisfação | Lista e resumo executivo dos relatórios disponibilizados | Fontes e curadoria, revisão/PDF, publicação/ciência, reabertura do mesmo relatório e tratamento da avaliação |
| 4E Comercial e administração | Consulta de frentes contratadas | Propostas, Forms, Mapa, ajuda, auditoria, direitos, exportação/encerramento e equipe CALI |

A empresa de Cliente vem da sessão, nunca do filtro da URL. Admin escolhe uma das empresas piloto e exige MFA. A guarda compartilhada exige sessão ativa, aceite vigente e vínculo admitido. As RPCs vinculam explicitamente a empresa a cada consulta, omitem notas internas para Cliente e não retornam URL, caminho do Storage ou conteúdo de arquivos. Cache separado por ator, empresa, filtros e página. A autorização do catálogo de documentos não comprova autorização para baixar.

## O que o catálogo resolveu

- O corpo instalado de abertura e o de resolução de ajuste calculam `now() + 24h × client_response_business_days`, padrão 3: **72 horas corridas** no padrão. O ajuste v39 exige revisão pendente e permite pedidos nas rodadas 1 e 2. O timestamp não funciona como bloqueio de prazo nessa RPC. Reagendamento exige data; troca exige outro entregável do projeto com complexidade equivalente.
- Compartilhar cronograma já insere notificações com `email_required=true`; o gatilho de movimento também pode marcar e-mail no compartilhamento e na aprovação. Exercitar o fluxo exige separar o transporte no ambiente de teste e conferir duplicidade. UPDATE direto não substitui as guardas das operações.
- A RPC legada de mudança de status não reabre entregável aprovado. A de relatório v63 só aceita relatório ainda não visto, arquiva o anterior e cria outro registro. Ambas precisam de caminho V2 conforme DEC-06/11/12, com histórico e visibilidade por revisão.
- Horas para Cliente combinam permissão por mês, publicação do lançamento e projeto operacional. A soma implementada usa exatamente esses lançamentos; preço, saldo e capacidade seguem nos contratos próprios.

## Validação e reversão

A prova com PostgreSQL descartável (`supabase/proposals/phase-4/test.sh`) executa as projeções e a guarda do piloto com sessão, dados e dependências do legado sintéticos. Cobre papéis e permissões, MFA, aceite, revogação, isolamento A/B, filtros, campos privados, mês em Brasília, paginação e rollback. Não certifica Data API hospedada ou navegador autenticado.

O frontend exige modo desenvolvimento, composição do piloto A/B e `VITE_CALI_PHASE4_READ=true`. Manter desativado até instalar as quatro RPCs em ambiente de homologação autorizado. A ausência das RPCs deve resultar em erro de consulta; não há fallback para dados de demonstração. Para reverter, desligar a flag e, caso as propostas tenham sido aplicadas, usar `supabase/proposals/phase-4/rollback-read.sql`: remove somente as quatro RPCs novas. Não é necessário ligar o cron DISC para este incremento.

## Primeiro incremento de operações

| Recorte | Operação pronta para QA local | Fora deste incremento |
| --- | --- | --- |
| 4A | Rascunho Admin com frentes e entregáveis, abertura de revisão, ajuste geral, decisão Admin e aprovação Cliente | Gestão completa de frentes, ajustes por item na interface, execução e reabertura de entregáveis |
| 4B | Lançamento manual com justificativa interna e timer Admin com pausa, retomada e conclusão | Capacidade e saldo na UI, reunião/remarcação, extras e sincronização externa |
| 4C | Abertura de ocorrência, conversa pública, nota interna e transições de atendimento | Avaliação/reabertura, arquivos/versões/ciência, mural e resumo Admin |
| 4D | Prontidão mensal pelo cálculo instalado e ciência da primeira versão do relatório publicado | Curadoria, PDF, aprovação, publicação, revisão e satisfação |
| 4E | Pedido de direito individual e resposta administrativa por empresa, com trilha existente | Propostas, Forms/Mapa, frentes/ajuda, auditoria de gestão, exportação/encerramento e equipe CALI |

A escrita usa MFA para Admin, sessão com aceite vigente, fronteira da empresa e checagem da transição no banco. Aprovação e ajuste de cronograma travam o projeto e verificam o ID da revisão atual. Horas reutilizam ciclo, capacidade e fechamento do timer legados. Recibos privados de reexecução guardam identificadores e a impressão digital da operação. Notas internas ficam restritas ao Admin. Mensagens de ocorrência geram aviso no app. A menção legada marcava e-mail antes do despacho. Um gatilho adicional trata só a menção da ocorrência que a RPC V2 insere na transação correspondente.

Para o QA, aplicar as propostas de leitura e depois, na ordem, `project-operations.sql`, `operation-receipts.sql`, `hours-operations.sql`, `record-operations.sql` e `report-privacy-operations.sql`. As operações de cronograma, status de ocorrência e privacidade podem alcançar a fila de comunicações legada. Instalar e exercitar somente após isolar o transporte no ambiente de teste. A interface requer também `VITE_CALI_PHASE4_WRITE=true`. Para reverter, desligar a flag e executar `rollback-write.sql`. O rollback retira as RPCs e o gatilho novo, preservando registros e recibos.

O PostgreSQL descartável prova as guardas, reexecução, transições, isolamento A/B, menções sem e-mail, ciência e privacidade usando dependências legadas simuladas. Aplicação hospedada e validação autenticada das escritas continuam pendentes.

## Segundo incremento de operações

| Recorte | Operação exercitada localmente | Trabalho pendente |
| --- | --- | --- |
| 4A | Pausa e retomada do projeto, encaminhamento e decisão de entregável, avaliação e nova aprovação após correção no mesmo registro | Reabertura com arquivo, gestão completa de frentes e subtarefas, ajustes específicos na interface, conversa e dependências |
| 4B | Solicitação ordinária coberta pelo contrato, oferta Admin e confirmação Cliente. Bloqueio por mudança de condição e conflito de horário na empresa. Estado externo lido do evento | Extras, preço aceito, remarcação/cancelamento, participantes, saldo/capacidade na UI e integração Google/Meet |
| 4C | Publicar aviso dirigido, arquivar/restaurar, ciência e desfazer ciência. Mural e agenda leem o mesmo aviso | Documentos e anexos versionados, reabertura/avaliação de ocorrência, comentários/reações do mural e resumo Admin |
| 4D | Rascunho mensal captura o retrato das fontes instaladas. Edição de resumo, revisão e aprovação interna travam a versão esperada | Curadoria completa, PDF e armazenamento privado, publicação, revisão pós-publicação e tratamento da satisfação |
| 4E | Listar formulários existentes da empresa e abrir/encerrar os que atendem às guardas | Editor, formulário público e respostas na V2, Propostas, Mapa, frentes/ajuda, auditoria, ciclo de dados e equipe CALI |

Para reabertura, o item volta a revisão interna e some das consultas Cliente até uma nova liberação. A aprovação anterior fica no histórico e a nova avaliação é independente. A RPC recusa item documental, com registro de arquivo ou com link final. Antes de liberar esses casos, é preciso vincular cada revisão à sua cópia privada e comprovar a retirada do acesso aos bytes anteriores em todas as rotas relevantes.

Após a ordem do primeiro incremento, aplicar também `delivery-operations.sql`, `agenda-operations.sql`, `notice-operations.sql`, `report-draft-operations.sql` e `forms-operations.sql` no ambiente isolado. A confirmação de agenda cria um evento local que pode ficar pendente de sincronização. Aprovação de relatório altera o estado interno. Formulário aberto passa pelo estado do leitor já existente. As provas locais simulam as dependências desses serviços. `rollback-write.sql` inclui as novas RPCs.
