# Fase 4 — Consultas de homologação

Primeiro incremento da fase 4. A publicação 83 continua como referência de interface e comportamento; a composição simplificada serve para validar os contratos do piloto. Paridade e aceite final seguem no [roteiro da Patrícia](../HOMOLOGACAO_PATRICIA.md).

Em 05/11/2026, leitura somente do catálogo do CALI MAPA conferiu colunas, políticas, gatilhos e corpos de RPCs. O incremento usa quatro novas RPCs em propostas SQL, sem mudar tabelas, grants legados ou gatilhos. Não houve aplicação hospedada.

| Domínio | Consulta implementada no código | Próxima entrega operacional |
| --- | --- | --- |
| 4A Projetos e entregáveis | Lista e detalhe, última revisão e prazo, frentes do projeto e entregáveis paginados | Rascunho estruturado, compartilhamento, aprovação/ajustes e execução; reabertura do mesmo entregável, histórico, bloqueio e nova aprovação |
| 4B Horas e agenda | Extrato, capacidade e saldo por mês, agenda do mês em Brasília | Homologar horas e conciliar integrações externas |
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

Para o QA, aplicar as propostas de leitura e depois, na ordem, `pilot-role.sql`, `project-operations.sql`, `operation-receipts.sql`, `hours-operations.sql`, `record-operations.sql` e `report-privacy-operations.sql`. As operações de cronograma, status de ocorrência e privacidade podem alcançar a fila de comunicações legada. Instalar e exercitar somente após isolar o transporte no ambiente de teste. A interface requer também `VITE_CALI_PHASE4_WRITE=true`. Para reverter, desligar a flag e executar `rollback-write.sql`. O rollback retira as RPCs e o gatilho novo, preservando registros, recibos e histórico de correções.

O PostgreSQL descartável prova as guardas, reexecução, transições, isolamento A/B, menções sem e-mail, ciência e privacidade usando dependências legadas simuladas. Aplicação hospedada e validação autenticada das escritas continuam pendentes.

## Segundo incremento de operações

| Recorte | Operação exercitada localmente | Trabalho pendente |
| --- | --- | --- |
| 4A | Pausa e retomada do projeto, encaminhamento e decisão de entregável, avaliação e nova aprovação após correção no mesmo registro | Reabertura de itens com arquivos legados, gestão completa de frentes e subtarefas, ajustes específicos na interface, conversa e dependências |
| 4B | Solicitação ordinária coberta pelo contrato, oferta Admin e confirmação Cliente. Bloqueio por mudança de condição e conflito de horário na empresa. Estado externo lido do evento | Extras, preço aceito, participantes, homologação de saldo/capacidade e integração Google/Meet |
| 4C | Publicar aviso dirigido, arquivar/restaurar, ciência e desfazer ciência. Mural e agenda leem o mesmo aviso | Anexos de conversa, comentários/reações do mural e resumo Admin |
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

PostgreSQL descartável verificou bloqueio sem foto, escopo A/B, reabertura, nova aprovação, motivo auditado, recusa de ação obsoleta e preservação do resumo anterior. As referências aos arquivos de identidade não congelam seus bytes. O próximo incremento descreve geração, armazenamento e publicação para as revisões novas da V2.

## PDF executivo, publicação e ciência por revisão

A Edge `workspace-executive-pdf` recebe empresa, relatório e versão. A Data API valida Admin com MFA, aceite e revisão aprovada e devolve um ticket de dois minutos mais o retrato necessário para renderizar. O servidor gera PDF A4 com Inter incorporada, período, resumo, horas, entregáveis, avaliação agregada quando há pelo menos duas respostas, foto e assinatura virtual. Valores ausentes ou incompatíveis nos indicadores obrigatórios bloqueiam a geração, sem substituição por zero. A arte contém somente os campos selecionados; notas, registros e comentários brutos não são copiados para o PDF. Foto e imagem de assinatura vêm das referências aprovadas, sem redirects, com origem e tamanho restritos. Os bytes ficam congelados na primeira geração bem-sucedida.

O protocolo V2 `CALI-EXEC-AAAA-NNNNNN` é reservado na primeira tentativa e mantido por revisão. Só a Edge usando o papel servidor pode gravar o PDF privado e seu digest. Admin consulta a cópia antes de publicar. A publicação no Workspace exige o PDF da versão atual, registra autoria e hora e não chama o envio legado. Cliente baixa só a revisão liberada da própria empresa, sem cache ou link público. A primeira publicação pede uma ciência por empresa. Ao reabrir com motivo, o mesmo relatório volta a rascunho, a publicação anterior sai do catálogo Cliente e o histórico fica disponível ao Admin. Ao publicar correção, ciência nova é opcional e nunca é copiada da anterior.

Instalar `report-draft-operations.sql` antes de `report-release-operations.sql`. Gerar o bundle com `npm run executive:functions:build`. A Edge do piloto deve manter JWT obrigatório no gateway e usa apenas as credenciais do ambiente servidor. O bundle e as propostas não ativam runtime. Depois de instalar em homologação autorizada, usar as flags de leitura/escrita e `VITE_CALI_PHASE4_REPORT_RELEASE=true`. Para reverter, desligar a flag e usar `rollback-write.sql` para retirar as RPCs, preservando PDFs, publicações e ciências.

Validação local cobre PDF paginado, Inter incorporada, protocolo e assinatura, rejeição de entrada incompleta, três revisões, isolamento A/B, MFA, corte da versão retirada e ciência idempotente. Pendente: comparar a projeção de horas/entregáveis com a forma efetiva das fontes no CALI MAPA, conferir a identidade real configurada e homologar Admin/Cliente no navegador. Curadoria completa, paridade visual com a publicação 83, comunicação externa, dúvidas e tratamento de satisfação seguem em aberto. Nenhuma alteração hospedada nesta entrega.

## Remarcação e cancelamento de reunião ordinária

Cliente pede mudança de reunião futura, confirmada e visível de sua empresa. Um pedido pendente por evento. Repetir a mesma solicitação preserva o identificador e não duplica a decisão ou seus efeitos. Remarcação exige duas opções sem sobreposição, dias de semana, 9h–16h de Brasília, duração original e antecedência de 48 horas pelo helper legado de dias de semana. A reunião fica como está enquanto o pedido aguarda análise.

Admin com MFA explica a decisão e, para remarcar, escolhe uma das opções. A confirmação confere se a reunião mudou, se o horário ainda está no futuro e se entrou um conflito na agenda da empresa. A remarcação atualiza o mesmo evento e mantém sincronização pendente; cancelamento indica apenas a retirada no Workspace. A aplicação não chama Google/Meet neste fluxo. Extras, cobrança, preço aceito e participantes não são alterados por estas operações.

Instalar `agenda-change-operations.sql` depois de `operation-receipts.sql` e `agenda-operations.sql`. O ambiente precisa das RPCs e tabela de mudanças legadas. As RPCs legadas podem enfileirar notificações com e-mail; isolar o transporte antes do QA hospedado. A prova descartável usa dependências sintéticas e valida isolamento, MFA, pendência sem mudança, recusa de duplicidade, conflito, reexecução, atualização do evento e cancelamento. `rollback-write.sql` retira as novas RPCs, preservando pedidos e decisões.

## Avaliação e reabertura de ocorrências

Cliente avalia ocorrência finalizada de sua empresa, com nota de 1 a 5 e comentário obrigatório nas notas 1 a 3. A leitura devolve apenas sua avaliação. Repetir a mesma resposta não duplica o aviso. Alteração da própria avaliação segue o contrato existente de uma resposta por usuário e ocorrência.

Cliente pode pedir reabertura em espera, finalizada ou cancelada. Para ocorrência finalizada, a avaliação precisa ser do solicitante. Novo pedido exige motivo; se já houver um pendente, a operação devolve o mesmo identificador. O pedido preserva a situação até a decisão. Admin com MFA aprova ou recusa; a recusa exige motivo e mantém a situação. A aprovação volta a ocorrência para atendimento, sem desfazer horas ou apagar a avaliação. A CALI também pode reabrir diretamente pela mudança de situação prevista no legado.

Instalar `record-operations.sql` e `record-review-operations.sql` depois de `operation-receipts.sql`. A leitura e as transições dependem das tabelas e RPCs de avaliação e reabertura instaladas. As notificações legadas da avaliação/pedido/decisão podem enfileirar e-mail; isolar transporte antes de homologar. Mensagens e menções gravadas neste fluxo não habilitam e-mail de chat. O rollback retira RPCs da V2 e preserva registros.

PostgreSQL descartável verificou nota inválida, avaliação de outro acesso, isolamento A/B, MFA, pedido único, recusa, aprovação, reexecução e menção sem e-mail de chat. A prova usa dependências legadas sintéticas. Homologação no CALI MAPA e paridade visual permanecem pendentes.

## Propostas e auditoria no piloto Admin

Propostas consulta `public.cali_submissions` e `public.cali_proposals` apenas para oportunidades de teste inscritas explicitamente em `cali_session_guard.phase4_commercial_scope` para a empresa selecionada. A inscrição usa identificador, nunca nome, domínio ou e-mail. Cada versão exibe o valor registrado e seu estado; aprovação interna não vira aceite, e o estado do Portal não comprova o ator ou a entrega de e-mail. Briefing, contatos, notas, cálculos, arquivo e chaves de transporte não entram na projeção. Sem escrita no Portal.

Auditoria consulta os eventos selecionados de `activity_log` da empresa, paginados e filtráveis por mês de Brasília. A projeção inclui evento, instante, autor e, quando disponíveis, protocolo e revisão. Metadados livres, notas e hashes ficam fora. Geração e publicação de relatório aparecem como eventos separados. Esta é uma projeção de leitura de uma fonte; não certifica imutabilidade nem substitui todas as trilhas da publicação 83.

Instalar `admin-audit-read.sql` depois das propostas de relatórios. Instalar `commercial-read.sql` somente após conferir as tabelas e tipos efetivos do Portal, e cadastrar apenas as oportunidades sintéticas revisadas. As duas telas exigem Admin com MFA, empresa piloto e `VITE_CALI_PHASE4_ADMIN_READ=true` além da flag de leitura. Sem fallback a fixtures na composição hospedada. O rollback retira RPCs da V2, mantendo os dados e as inscrições.

PostgreSQL descartável confirmou negação a Cliente e Admin sem MFA, escopo por empresa e inscrição, versões e valor preservados, fronteira do mês em Brasília e ausência de campos privados. A validação deste leitor usou fixtures. O lote abaixo registra a inspeção do catálogo hospedado e as operações de rascunho.

## Acompanhamento Admin de satisfação

Admin com MFA vê as avaliações de 1 a 3 da empresa piloto: ocorrência, entrega original e correção de entregável. A revisão corrigida tem identificador próprio, sem reutilizar a avaliação ou o acompanhamento anterior. As notas 4 e 5 ficam fora deste recorte de acompanhamento de notas baixas.

Tema e anotação ficam em `satisfaction_followups`, separados da avaliação. Salvar ou atualizar não muda nota, comentário nem autoria do Cliente e não gera comunicação. O banco confere empresa, origem, data da avaliação e a versão do acompanhamento; uma alteração obsoleta não sobrescreve a mais recente. Repetir o mesmo conteúdo não duplica evento. Auditoria registra o acompanhamento sem projetar sua anotação interna.

Instalar `satisfaction-operations.sql` depois das operações de entregáveis e ocorrências, com as tabelas legadas `nps_responses` e `satisfaction_followups` conferidas. A consulta usa `VITE_CALI_PHASE4_ADMIN_READ=true`; o formulário requer também `VITE_CALI_PHASE4_WRITE=true`. O rollback retira RPCs, mantendo avaliações e acompanhamentos. PostgreSQL descartável validou escopo, MFA, reexecução, conflito, separação da revisão e preservação do feedback. Painel agregado, trilhas adicionais e homologação no CALI MAPA ficam em aberto.

## Rascunho e aprovação interna de propostas

Em 06/11/2026, a consulta ao catálogo do CALI MAPA confirmou RLS nas quatro tabelas do Portal, com escrita de propostas restrita à identidade administrativa do Portal. Confirmou também os estados textuais, a validade de 1 a 120 dias, a chave única por oportunidade e versão e a ausência de gatilhos próprios de proposta. A função `portal-send-proposal` está ativa com JWT. Essa inspeção não estabeleceu a correspondência do PDF com a revisão aprovada, a proteção do valor após o envio ou o comportamento efetivo de repetição e aceite externo.

A V2 permite editar condições de pagamento, observações e validade em proposta já cadastrada como rascunho, além de aprovar internamente a versão salva. A RPC usa as permissões efetivas do usuário no Portal, exige Admin com MFA e vínculo explícito da oportunidade à empresa piloto. A edição e a aprovação conferem a data da última escrita e registram a versão na auditoria. Valor, escopo, versão e estado da oportunidade são preservados. Preço e criação de proposta continuam sob o contrato do Portal. Envio e aceite ficam em aberto.

Instalar `commercial-draft.sql` depois de `commercial-read.sql`. O editor exige `VITE_CALI_PHASE4_ADMIN_READ=true` e `VITE_CALI_PHASE4_WRITE=true`. O PostgreSQL descartável verificou RLS, MFA, empresa, recusa de versão obsoleta e bloqueio de edição após aprovação. O rollback remove as RPCs e conserva versões e eventos. A inspeção hospedada ocorreu em leitura e a operação V2 aguarda homologação.

## Rascunhos de Forms

Admin com MFA cria rascunho para a empresa piloto e edita título, descrição e perguntas de texto curto ou longo. Novos rascunhos usam audiência Cliente e confirmação por e-mail desativada. O slug permanece estável. O editor aceita até 40 perguntas na inclusão e preserva identificadores, ordem, lógica condicional e demais campos legados nas perguntas existentes. Formulário aberto, encerrado ou com resposta registrada fica fora da edição. A escrita recusa a versão obsoleta. Abrir e encerrar continuam como ações distintas.

Instalar `forms-draft.sql` depois de `operation-receipts.sql` e `forms-operations.sql`. O editor usa as flags gerais de leitura e escrita da Fase 4. O teste em PostgreSQL descartável verificou MFA, isolamento por empresa, repetição, concorrência e preservação das perguntas legadas. O rollback retira as RPCs V2 e conserva rascunhos e trilha. O rascunho foi homologado no CALI MAPA conforme o resultado abaixo. Rota pública, respostas, anexos e exportação continuam pendentes.

## Triagem de respostas de Forms

O catálogo hospedado confirmou as colunas `stage` e `owner`, a configuração `forms.stages` e as policies de leitura/atualização restritas a Admin. A consulta ao catálogo não leu respostas ou dados pessoais.

Admin com MFA abre a triagem de um formulário da empresa piloto. A lista mostra até 25 registros por página com nome, data, etapa e responsável. A etapa segue as opções do formulário. Uma etapa antiga pode ser mantida ou trocada por opção atual. A escrita confere os valores anteriores, grava apenas etapa e responsável e registra evento sem esses textos. Repetir o mesmo resultado não duplica o evento. E-mail, conteúdo, anexos e notas ficam fora da projeção. A triagem não envia comunicação.

Instalar `forms-triage.sql` após `forms-operations.sql`. A tela usa as flags gerais de leitura e escrita da Fase 4. O teste isolado verificou MFA, escopo A/B, projeção mínima, etapa inválida, repetição e recusa de sobrescrita. O rollback retira as RPCs e preserva a triagem. A triagem com resposta sintética foi homologada conforme o resultado abaixo.

## Lote de homologação de Forms no CALI MAPA

O catálogo de 06/11 confirmou a guarda de sessão do piloto já instalada. A guarda operacional da Fase 4, a tabela de recibos e a RPC de listagem V2 de Forms estavam ausentes. As tabelas efetivas de Forms e auditoria foram conferidas. Os gatilhos encontrados em Forms e respostas atuam em exclusão, fora dos casos deste lote.

**Aplicação concluída em 06/11/2026.** Com autorização explícita, o lote instalou somente `pilot-role.sql`, `operation-receipts.sql`, `forms-operations.sql`, `forms-draft.sql` e `forms-triage.sql`, nesta ordem, em uma transação. A checagem anterior confirmou duas empresas piloto, a guarda de sessão e ausência dos novos objetos. O catálogo confirmou a execução das sete RPCs por `authenticated` e a restrição dos dois auxiliares. As operações verificam papel, MFA, sessão, aceite e empresa piloto.

**Prova no navegador.** A sessão Admin existente na V2 local abriu `/admin/formularios` com as flags de leitura e escrita. Criou o rascunho sintético `teste-v2-forms-fase-4-empresa-a` em A, adicionou perguntas curta e longa, editou a curta e confirmou os textos após recarregar. A lista de B ficou vazia. O banco confirmou estado `draft`, audiência `client`, confirmação por e-mail desativada, duas perguntas, zero respostas, um evento de criação e três de edição. O servidor local foi encerrado.

**Triagem no navegador.** Com autorização específica, uma resposta fictícia foi inserida no formulário fechado `teste-v2-forms-triagem-empresa-a`, separado do rascunho anterior. A sessão Admin mudou a etapa de Novo para Em análise, atribuiu responsável fictício e confirmou a persistência após recarregar. A lista de B permaneceu vazia. A verificação do registro confirmou conteúdo preservado, um evento de auditoria, ausência de e-mail do respondente e ausência de confirmação. Os registros de teste ficaram identificados. O servidor local foi encerrado.

Abertura e encerramento de coleta continuam pendentes de prova hospedada.

**Reversão.** Desligar as flags locais e executar `rollback-forms.sql`. A reversão retira as RPCs de Forms, mantém as funções compartilhadas e preserva rascunhos, respostas, recibos e auditoria. O teste descartável confirma que as operações de projeto continuam disponíveis após essa reversão.

## Capacidade e saldo de horas no piloto

O catálogo do CALI MAPA confirmou que `capacity_month` usa a franquia do ciclo do mês ou a franquia mensal da empresa. O consumo soma lançamentos operacionais, incluindo os que entram no resumo legado sem aparecer como itens para o Cliente. A V2 chama esse mesmo cálculo depois de validar sessão, empresa e, para Cliente, visibilidade do mês. Quando a franquia é positiva, apresenta saldo e excedente. Sem franquia definida, apresenta o consumo e omite saldo e excedente.

A tela separa capacidade mensal e extrato. O extrato mantém o total dos lançamentos que aquele perfil pode listar. A consulta agrega os minutos operacionais sem copiar descrições ou justificativas internas. A resposta anterior da RPC continua compatível com a tela.

O PostgreSQL descartável confirmou mês oculto, fronteira A/B, consumo com horas internas agregadas, saldo, excedente e ausência de franquia. A instalação proposta consiste somente em `read-hours.sql`. O preflight confirmou as dependências e a ausência de `v2_read_pilot_hours` no CALI MAPA. Para homologar, instalar essa RPC e conferir um mês visível e um oculto com Cliente A, além da leitura Admin em A/B. A reversão deste lote remove apenas `cali_workspace.v2_read_pilot_hours(uuid,date,integer)` e recarrega o catálogo PostgREST. A prova no navegador hospedado continua pendente.
