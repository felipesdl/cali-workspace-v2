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

Para o QA, aplicar as propostas de leitura e depois, na ordem, `project-operations.sql`, `operation-receipts.sql`, `hours-operations.sql`, `record-operations.sql` e `report-privacy-operations.sql`. As operações de cronograma, status de ocorrência e privacidade podem alcançar a fila de comunicações legada. Instalar e exercitar somente após isolar o transporte no ambiente de teste. A interface requer também `VITE_CALI_PHASE4_WRITE=true`. Para reverter, desligar a flag e executar `rollback-write.sql`. O rollback retira as RPCs e o gatilho novo, preservando registros, recibos e histórico de correções.

O PostgreSQL descartável prova as guardas, reexecução, transições, isolamento A/B, menções sem e-mail, ciência e privacidade usando dependências legadas simuladas. Aplicação hospedada e validação autenticada das escritas continuam pendentes.

## Segundo incremento de operações

| Recorte | Operação exercitada localmente | Trabalho pendente |
| --- | --- | --- |
| 4A | Pausa e retomada do projeto, encaminhamento e decisão de entregável, avaliação e nova aprovação após correção no mesmo registro | Reabertura de itens com arquivos legados, gestão completa de frentes e subtarefas, ajustes específicos na interface, conversa e dependências |
| 4B | Solicitação ordinária coberta pelo contrato, oferta Admin e confirmação Cliente. Bloqueio por mudança de condição e conflito de horário na empresa. Estado externo lido do evento | Extras, preço aceito, remarcação/cancelamento, participantes, saldo/capacidade na UI e integração Google/Meet |
| 4C | Publicar aviso dirigido, arquivar/restaurar, ciência e desfazer ciência. Mural e agenda leem o mesmo aviso | Documentos e anexos versionados, reabertura/avaliação de ocorrência, comentários/reações do mural e resumo Admin |
| 4D | Rascunho mensal captura o retrato das fontes instaladas. Edição de resumo, revisão e aprovação interna travam a versão esperada | Curadoria completa, PDF e armazenamento privado, publicação, revisão pós-publicação e tratamento da satisfação |
| 4E | Listar formulários existentes da empresa e abrir/encerrar os que atendem às guardas | Editor, formulário público e respostas na V2, Propostas, Mapa, frentes/ajuda, auditoria, ciclo de dados e equipe CALI |

Para reabertura, o item volta a revisão interna e some das consultas Cliente até uma nova liberação. A aprovação anterior fica no histórico. A avaliação da correção fica em uma tabela privada de revisões para preservar a original. O catálogo tem dois índices únicos que permitem uma única avaliação legada por usuário e entregável. As agregações legadas continuam usando a avaliação original. A RPC recusa item documental legado, com registro de arquivo legado ou com link final. O caminho privado V2 está descrito abaixo.

Após a ordem do primeiro incremento, aplicar também `document-operations.sql`, `delivery-operations.sql`, `agenda-operations.sql`, `notice-operations.sql`, `report-draft-operations.sql` e `forms-operations.sql` no ambiente isolado. O catálogo permite um único timer aberto por Admin e empresa, incluindo a pausa. O controle da V2 segue essa regra. A confirmação de agenda cria um evento local que pode ficar pendente de sincronização. Aprovação de relatório altera o estado interno. Formulário aberto passa pelo estado do leitor já existente. As provas locais simulam as dependências desses serviços. `rollback-write.sql` inclui as novas RPCs.

## PDFs privados por revisão

A biblioteca em Documentos permite ao Admin com MFA adicionar um PDF, criar outra revisão, consultar o histórico, publicar a versão mais recente e retirar a publicação. O Cliente da empresa vinculada lista, baixa e registra ciência da revisão publicada. Adicionar um rascunho mantém a publicação anterior até a troca explícita. Substituir ou retirar a revisão bloqueia novos downloads e novas ciências da versão antiga. A confirmação anterior permanece vinculada ao seu identificador. O Admin mantém acesso ao histórico.

Neste piloto, PDFs de até 2 MiB ficam em tabelas privadas do PostgreSQL. A gravação de bytes e revisão é atômica. Tabelas não expõem acesso direto aos papéis da API. A RPC de download revalida o vínculo, a sessão, o aceite e a publicação e devolve os bytes com digest e `Cache-Control: private, no-store`. Arquivos já salvos pelo destinatário ficam sob seu controle. O formato é verificado por cabeçalho e tamanho. Não há inspeção antimalware. Limite, retenção e eventual transferência para outro armazenamento devem ser revisados antes de coletar arquivos reais.

Aplicar `document-operations.sql` após `project-operations.sql`. A biblioteca usa as flags existentes do piloto de leitura e escrita. `rollback-write.sql` retira as RPCs e conserva PDFs, revisões e ciências. O acervo legado continua consultável pelo catálogo anterior. PDFs oficiais de relatórios, Drive e migração de arquivos legados ficam para seus fluxos próprios.

A prova PostgreSQL descartável cobre guardas, replay de upload e ciência, escopo entre empresas, rejeição de arquivo inválido, versão obsoleta, revogação de sessão e retirada. O teste de interface usa a rota Cliente e simula a API para confirmar o vínculo e a atualização depois da ciência. A pré-verificação do laboratório existente recusou os arquivos `.env`, `.env.cali-ops.local` e `.env.production` como não revisados para execução isolada. Nenhum desses arquivos foi carregado pelo ensaio de banco.

A prova HTTP com `python3 supabase/proposals/phase-4/test-documents-http.py` passou em 13 verificações, incluindo MFA, anonimato, acesso de outra empresa, bytes e cabeçalho de cache, ciência, substituição e retirada. O runner usa PostgreSQL e PostgREST em rede Docker interna, sem portas publicadas, com imagens em cache e JWTs sintéticos. Autenticação, aceite e vigência no CALI MAPA continuam pendentes de homologação.

## PDF privado de entregável

O Admin anexa PDF no entregável em execução ou revisão interna. O arquivo usa o mesmo armazenamento privado da biblioteca, com um documento por entregável e histórico de revisões. A publicação acontece na transação de envio à revisão Cliente. Upload novo invalida a versão da tela usada para enviar. A biblioteca avulsa não lista, edita ou publica o anexo; avaliação continua no fluxo do entregável.

Reabrir uma entrega aprovada ou pedir ajuste retira a revisão publicada. Para reenviar o mesmo item, o Admin precisa anexar outra revisão. O histórico e a aprovação anterior permanecem. Cliente pode baixar apenas a revisão publicada de um entregável visível de sua empresa. A retirada impede novas respostas da API; não apaga cópias já baixadas. Itens com arquivos ou links legados continuam fora da correção com PDF.

Instalar `document-operations.sql` antes de `delivery-operations.sql`. As flags continuam sendo as do piloto. A prova PostgreSQL descartável verificou rascunho oculto, envio com versão obsoleta rejeitado, acesso A/B, retirada, exigência de nova revisão, preservação do histórico e nova aprovação. A prova usa auxiliares legados sintéticos. Aplicação hospedada e navegador autenticado seguem pendentes.

## Revisões de aprovação interna do relatório

A aprovação cria, na mesma transação, um retrato privado da versão, incluindo período, resumo, fontes coletadas, protocolo quando atribuído e referências da assinatura/foto CALI. Sem nome ou foto configurada, a aprovação fica bloqueada. O histórico na tela Admin mostra apenas versão, data e protocolo; os dados de origem ficam no banco para a futura geração do PDF.

O Admin pode reabrir uma aprovação interna da V2 com motivo. O relatório mantém o mesmo identificador e volta a rascunho na versão seguinte. Editar e aprovar de novo não sobrescreve o retrato anterior. As operações usam a versão da tela e recusam relatórios já enviados ou publicados. O Cliente não lê o histórico interno. O rollback remove as operações e conserva as aprovações anteriores.

PostgreSQL descartável verificou bloqueio sem foto, escopo A/B, reabertura, nova aprovação, motivo auditado, recusa de ação obsoleta e preservação do resumo anterior. As referências aos arquivos de identidade não congelam seus bytes. Geração oficial com Inter, protocolo definitivo, armazenamento de PDF, publicação e correção pós-publicação ainda precisam de implementação e homologação próprias.
