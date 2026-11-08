# Fase 4 — Consultas de homologação

Primeiro incremento da fase 4. A publicação 83 continua como referência de interface e comportamento; a composição simplificada serve para validar os contratos do piloto. Paridade e aceite final seguem no [roteiro da Patrícia](../HOMOLOGACAO_PATRICIA.md).

Em 05/11/2026, leitura somente do catálogo do CALI MAPA conferiu colunas, políticas, gatilhos e corpos de RPCs. O incremento usa quatro novas RPCs em propostas SQL, sem mudar tabelas, grants legados ou gatilhos. A aplicação e a prova hospedada estão registradas no lote de leitura ao fim deste documento.

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
- Horas para Cliente combinam permissão por mês, publicação do lançamento e projeto operacional. A soma do extrato usa exatamente os lançamentos exibíveis. A capacidade usa o consumo operacional agregado, conforme o contrato abaixo.

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
| 4A | Planejamento, ajustes por item, execução, subtarefas, conversas, dependências, revisão de prazo e nova aprovação após correção | Migração dos arquivos legados, paridade visual e decisão sobre vencimento de revisão |
| 4B | Lançamento, pausa e retomada sem dupla contagem; solicitação ordinária, oferta, confirmação, remarcação e cancelamento homologados | Homologação hospedada da exclusão e das transições de capacidade, extras, preço aceito, participantes adicionais e Google/Meet |
| 4C | Publicar aviso dirigido, arquivar/restaurar, ciência e desfazer ciência. Mural e agenda leem o mesmo aviso | Anexos de conversa, comentários/reações do mural e resumo Admin |
| 4D | Rascunho mensal captura o retrato das fontes instaladas. Curadoria aprovada, PDF, republicação e retirada homologados | Fontes restantes e paridade visual |
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

Instalar `document-operations.sql` antes de `delivery-operations.sql`. As flags continuam sendo as do piloto. A prova PostgreSQL descartável verificou rascunho oculto, envio com versão obsoleta rejeitado, acesso A/B, retirada, exigência de nova revisão, preservação do histórico e nova aprovação. A prova usa auxiliares legados sintéticos. A [prova no navegador autenticado](#lote-de-projetos-e-entregáveis-no-cali-mapa) cobriu duas revisões no CALI MAPA.

## Revisões de aprovação interna do relatório

A aprovação cria, na mesma transação, um retrato privado da versão, incluindo período, resumo, fontes coletadas, protocolo quando atribuído e referências da assinatura/foto CALI. Sem nome ou foto configurada, a aprovação fica bloqueada. O histórico na tela Admin mostra apenas versão, data e protocolo; os dados de origem ficam no banco para a futura geração do PDF.

O Admin pode reabrir uma aprovação interna da V2 com motivo. O relatório mantém o mesmo identificador e volta a rascunho na versão seguinte. Editar e aprovar de novo não sobrescreve o retrato anterior. As operações usam a versão da tela e recusam relatórios já enviados ou publicados. O Cliente não lê o histórico interno. O rollback remove as operações e conserva as aprovações anteriores.

PostgreSQL descartável verificou bloqueio sem foto, escopo A/B, reabertura, nova aprovação, motivo auditado, recusa de ação obsoleta e preservação do resumo anterior. As referências aos arquivos de identidade não congelam seus bytes. O próximo incremento descreve geração, armazenamento e publicação para as revisões novas da V2.

## PDF executivo, publicação e ciência por revisão

A Edge `workspace-executive-pdf` recebe empresa, relatório e versão. A Data API valida Admin com MFA, aceite e revisão aprovada e devolve um ticket de dois minutos mais o retrato necessário para renderizar. O servidor gera PDF A4 com Inter incorporada, período, resumo, horas, entregáveis, avaliação agregada quando há pelo menos duas respostas, foto e assinatura virtual. Valores ausentes ou incompatíveis nos indicadores obrigatórios bloqueiam a geração, sem substituição por zero. A arte contém somente os campos selecionados; notas, registros e comentários brutos não são copiados para o PDF. Foto e imagem de assinatura vêm das referências aprovadas, sem redirects, com origem e tamanho restritos. Os bytes ficam congelados na primeira geração bem-sucedida.

O protocolo V2 `CALI-EXEC-AAAA-NNNNNN` é reservado na primeira tentativa e mantido por revisão. Só a Edge usando o papel servidor pode gravar o PDF privado e seu digest. Admin consulta a cópia antes de publicar. A publicação no Workspace exige o PDF da versão atual, registra autoria e hora e não chama o envio legado. Cliente baixa só a revisão liberada da própria empresa, sem cache ou link público. A primeira publicação pede uma ciência por empresa. Ao reabrir com motivo, o mesmo relatório volta a rascunho, a publicação anterior sai do catálogo Cliente e o histórico fica disponível ao Admin. Ao publicar correção, ciência nova é opcional e nunca é copiada da anterior.

Instalar `report-draft-operations.sql` antes de `report-release-operations.sql`. Gerar o bundle com `npm run executive:functions:build`. A Edge do piloto deve manter JWT obrigatório no gateway e usa apenas as credenciais do ambiente servidor. O bundle e as propostas não ativam runtime. Depois de instalar em homologação autorizada, usar as flags de leitura/escrita e `VITE_CALI_PHASE4_REPORT_RELEASE=true`. Para reverter, desligar a flag e usar `rollback-write.sql` para retirar as RPCs, preservando PDFs, publicações e ciências.

Validação local cobre PDF paginado, Inter incorporada, protocolo e assinatura, rejeição de entrada incompleta, três revisões, isolamento A/B, MFA, corte da versão retirada e ciência idempotente. O [lote hospedado](#lote-de-pdf-executivo-no-cali-mapa) validou geração, liberação, ciência e retirada com Admin e Cliente A. O PDF da revisão com curadoria, paridade visual com a publicação 83 e comunicação externa seguem em aberto.

## Remarcação e cancelamento de reunião ordinária

Cliente pede mudança de reunião futura, confirmada e visível de sua empresa. Um pedido pendente por evento. Repetir a mesma solicitação preserva o identificador e não duplica a decisão ou seus efeitos. Remarcação exige duas opções sem sobreposição, dias de semana, 9h–16h de Brasília, duração original e antecedência de 48 horas pelo helper legado de dias de semana. A reunião fica como está enquanto o pedido aguarda análise.

Admin com MFA explica a decisão e, para remarcar, escolhe uma das opções. A confirmação confere se a reunião mudou, se o horário ainda está no futuro e se entrou um conflito na agenda da empresa. A remarcação atualiza o mesmo evento e mantém sincronização pendente; cancelamento indica apenas a retirada no Workspace. A aplicação não chama Google/Meet neste fluxo. Extras, cobrança, preço aceito e participantes não são alterados por estas operações.

Instalar `agenda-change-operations.sql` depois de `operation-receipts.sql` e `agenda-operations.sql`. O ambiente precisa das RPCs e tabela de mudanças legadas. As RPCs legadas podem enfileirar notificações com e-mail; isolar o transporte antes do QA hospedado. A prova descartável usa dependências sintéticas e valida isolamento, MFA, pendência sem mudança, recusa de duplicidade, conflito, reexecução, atualização do evento e cancelamento. `rollback-write.sql` retira as novas RPCs, preservando pedidos e decisões.

## Avaliação e reabertura de ocorrências

Cliente avalia ocorrência finalizada de sua empresa, com nota de 1 a 5 e comentário obrigatório nas notas 1 a 3. A leitura devolve apenas sua avaliação. Repetir a mesma resposta não duplica o aviso. Alteração da própria avaliação segue o contrato existente de uma resposta por usuário e ocorrência.

Cliente pode pedir reabertura em espera, finalizada ou cancelada. Para ocorrência finalizada, a avaliação precisa ser do solicitante. Novo pedido exige motivo; se já houver um pendente, a operação devolve o mesmo identificador. O pedido preserva a situação até a decisão. Admin com MFA aprova ou recusa; a recusa exige motivo e mantém a situação. A aprovação volta a ocorrência para atendimento, sem desfazer horas ou apagar a avaliação. A CALI também pode reabrir diretamente pela mudança de situação prevista no legado.

Instalar `record-operations.sql` e `record-review-operations.sql` depois de `operation-receipts.sql`. A leitura e as transições dependem das tabelas e RPCs de avaliação e reabertura instaladas. As notificações legadas da avaliação/pedido/decisão podem enfileirar e-mail; isolar transporte antes de homologar. Mensagens e menções gravadas neste fluxo não habilitam e-mail de chat. O rollback retira RPCs da V2 e preserva registros.

PostgreSQL descartável verificou nota inválida, avaliação de outro acesso, isolamento A/B, MFA, pedido único, recusa, aprovação, reexecução e menção sem e-mail de chat. A prova usa dependências legadas sintéticas. A [homologação no CALI MAPA](#lote-de-ocorrências-avisos-e-satisfação-no-cali-mapa) cobriu avaliação e reabertura aprovada; paridade visual permanece pendente.

## Propostas e auditoria no piloto Admin

Propostas consulta `public.cali_submissions` e `public.cali_proposals` para a proposta sintética delegada. A tabela privada `cali_session_guard.phase4_commercial_scope` vincula por UUID a empresa, a oportunidade, a versão e o operador, com prazo de expiração. O catálogo exige Admin com MFA, sessão admitida e aceite vigente. A projeção omite briefing, contatos, notas internas, cálculo e arquivo.

Auditoria consulta os eventos selecionados de `activity_log` da empresa, paginados e filtráveis por mês de Brasília. A projeção inclui evento, instante, autor e, quando disponíveis, protocolo e revisão. Metadados livres, notas e hashes ficam fora. Geração e publicação de relatório aparecem como eventos separados. Quando o PDF foi gerado, o protocolo é obtido do evento de geração da mesma empresa, relatório e revisão. Esta é uma projeção de leitura de uma fonte; não certifica imutabilidade nem substitui todas as trilhas da publicação 83.

Instalar `admin-audit-read.sql` após a guarda de papel do piloto. Instalar `commercial-read.sql` somente após conferir as tabelas e tipos efetivos do Portal, e cadastrar apenas as oportunidades sintéticas revisadas. As duas telas exigem Admin com MFA, empresa piloto e `VITE_CALI_PHASE4_ADMIN_READ=true` além da flag de leitura. Sem fallback a fixtures na composição hospedada. O rollback retira RPCs da V2, mantendo os dados e as inscrições.

PostgreSQL descartável confirmou negação a Cliente e Admin sem MFA, escopo por empresa e inscrição, versões e valor preservados, fronteira do mês em Brasília e ausência de campos privados. A validação deste leitor usou fixtures. O lote abaixo registra a inspeção do catálogo hospedado e as operações de rascunho.

## Acompanhamento Admin de satisfação

Admin com MFA vê as avaliações de 1 a 3 da empresa piloto: ocorrência, entrega original e correção de entregável. A revisão corrigida tem identificador próprio, sem reutilizar a avaliação ou o acompanhamento anterior. As notas 4 e 5 ficam fora deste recorte de acompanhamento de notas baixas.

Tema e anotação ficam em `satisfaction_followups`, separados da avaliação. Salvar ou atualizar não muda nota, comentário nem autoria do Cliente e não gera comunicação. O banco confere empresa, origem, data da avaliação e a versão do acompanhamento; uma alteração obsoleta não sobrescreve a mais recente. Repetir o mesmo conteúdo não duplica evento. Auditoria registra o acompanhamento sem projetar sua anotação interna.

Instalar `satisfaction-operations.sql` depois das operações de entregáveis e ocorrências, com as tabelas legadas `nps_responses` e `satisfaction_followups` conferidas. A consulta usa `VITE_CALI_PHASE4_ADMIN_READ=true`; o formulário requer também `VITE_CALI_PHASE4_WRITE=true`. O rollback retira RPCs, mantendo avaliações e acompanhamentos. PostgreSQL descartável validou escopo, MFA, reexecução, conflito, separação da revisão e preservação do feedback. O [lote hospedado](#lote-de-ocorrências-avisos-e-satisfação-no-cali-mapa) confirmou o acompanhamento de ocorrência. Painel agregado e outras fontes de avaliação exigem provas próprias.

## Rascunho e aprovação interna de propostas

Em 06/11/2026, a consulta ao catálogo do CALI MAPA confirmou RLS nas quatro tabelas do Portal, com escrita de propostas restrita à identidade administrativa do Portal. Confirmou também os estados textuais, a validade de 1 a 120 dias, a chave única por oportunidade e versão e a ausência de gatilhos próprios de proposta. A função `portal-send-proposal` está ativa com JWT. Essa inspeção não estabeleceu a correspondência do PDF com a revisão aprovada, a proteção do valor após o envio ou o comportamento efetivo de repetição e aceite externo.

A V2 permite editar condições de pagamento, observações e validade em proposta já cadastrada como rascunho, além de aprovar internamente a versão salva. A RPC exige Admin com MFA, sessão admitida, aceite vigente e delegação válida para a proposta exata. A edição e a aprovação conferem a data da última escrita e registram a versão na auditoria. Valor, escopo, versão e estado da oportunidade são preservados. Preço e criação de proposta continuam sob o contrato do Portal. Envio e aceite ficam em aberto.

Instalar `commercial-draft.sql` depois de `commercial-read.sql`. O editor exige `VITE_CALI_PHASE4_ADMIN_READ=true` e `VITE_CALI_PHASE4_WRITE=true`. Em 07/11/2026, as quatro RPCs iniciais foram instaladas juntas no CALI MAPA com escopo vazio e escrita sujeita às permissões do Portal. A delegação temporária substituiu essa versão, conforme a homologação abaixo.

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

Abertura e encerramento de coleta continuam pendentes de prova hospedada. Em 07/11, o catálogo confirmou que as funções públicas de leitura e resposta usam slug e situação e não exigem autenticação ou vínculo para audiência `client`. Abrir a fixture hospedada teria efeito público; ela ficou em rascunho. A interface V2 distingue abertura por link público da edição e do encerramento. Uma coleta restrita à empresa exige outro contrato.

**Reversão.** Desligar as flags locais e executar `rollback-forms.sql`. A reversão retira as RPCs de Forms, mantém as funções compartilhadas e preserva rascunhos, respostas, recibos e auditoria. O teste descartável confirma que as operações de projeto continuam disponíveis após essa reversão.

## Capacidade e saldo de horas no piloto

O catálogo do CALI MAPA confirmou que `capacity_month` usa a franquia do ciclo do mês ou a franquia mensal da empresa. O consumo soma lançamentos operacionais, incluindo os que entram no resumo legado sem aparecer como itens para o Cliente. A V2 chama esse mesmo cálculo depois de validar sessão, empresa e, para Cliente, visibilidade do mês. Quando a franquia é positiva, apresenta saldo e excedente. Sem franquia definida, apresenta o consumo e omite saldo e excedente.

A tela separa capacidade mensal e extrato. O extrato mantém o total dos lançamentos que aquele perfil pode listar. A consulta agrega os minutos operacionais sem copiar descrições ou justificativas internas. A resposta anterior da RPC continua compatível com a tela.

O PostgreSQL descartável confirmou mês oculto, fronteira A/B, consumo com horas internas agregadas, saldo, excedente e ausência de franquia. A instalação proposta consiste somente em `read-hours.sql`. O preflight confirmou as dependências e a ausência de `v2_read_pilot_hours` no CALI MAPA. Para homologar, instalar essa RPC e conferir um mês visível e um oculto com Cliente A, além da leitura Admin em A/B. A reversão deste lote remove apenas `cali_workspace.v2_read_pilot_hours(uuid,date,integer)` e recarrega o catálogo PostgREST. A prova no navegador com o CALI MAPA foi concluída no lote abaixo.

## Lote de leitura para homologação A/B

O preflight no CALI MAPA conferiu as colunas e os tipos de Projetos, Horas e dos catálogos, os sete auxiliares de sessão e visibilidade e a ausência das quatro RPCs V2. O lote foi aplicado em 06/11/2026 na ordem `read-projects.sql`, `read-hours.sql` e `read-catalogs.sql`, em uma transação. O catálogo confirmou execução das quatro funções por `authenticated` e ausência do grant para `anon`, `service_role` e `PUBLIC`. Cada função confere sessão, empresa piloto e papel antes de projetar o resultado.

A prova na V2 local usou a flag de leitura e as sessões Admin e Cliente A/B. Agenda, Ocorrências, Documentos, Relatórios e Frentes retornaram o estado vazio nas duas empresas. Avisos mostrou a publicação geral nos quatro contextos. Admin consultou franquia, consumo e saldo em A e B. Os Clientes encontraram novembro oculto, conforme a configuração original.

Para testar resultados positivos, um projeto identificado foi criado em A e outubro foi aberto temporariamente para Horas de A. Admin e Cliente A abriram o detalhe do projeto. Cliente B recebeu “Projeto indisponível” ao usar o mesmo identificador. Cliente A consultou o painel de outubro. O projeto e os dois registros temporários de visibilidade foram removidos, a configuração inicial foi confirmada e os servidores locais foram encerrados. Os estados com lançamentos, anexos ou revisões permanecem cobertos pela prova isolada e pelas homologações dos respectivos fluxos.

Se necessário, `rollback-read.sql` retira as quatro consultas e recarrega o catálogo.

## Lote de auditoria de Formulários

A tela Admin de Auditoria passa a incluir criação e edição de rascunho, abertura, encerramento e triagem. A projeção continua por empresa piloto e usa o autor, a data e o tipo do evento. Etapa, responsável, conteúdo de resposta, identificador de pergunta e notas ficam fora do resultado.

A auditoria lê o protocolo do PDF executivo no evento de geração da revisão correspondente. Assim a consulta usa a trilha já existente e pode ser instalada separadamente das tabelas privadas de Relatórios. O PostgreSQL descartável confirmou a revisão, o protocolo, o evento de triagem, o isolamento e a omissão dos metadados privados.

O preflight confirmou a guarda de papel, as 13 colunas de dependência e cinco eventos de Forms em A. Em 06/11/2026 foi aplicado somente `admin-audit-read.sql`. O catálogo confirmou execução por `authenticated`, guarda de papel Admin e ausência de grant para `anon`, `service_role` e `PUBLIC`.

Na V2 local, Admin viu um evento de criação, três edições e uma triagem em A. Ao selecionar B, a lista ficou vazia. A sessão Cliente A redirecionou de `/admin/auditoria` para `/cliente`. A negação na RPC a Cliente e a exigência de MFA foram testadas no PostgreSQL descartável. Os servidores locais foram encerrados. A reversão remove somente `cali_workspace.v2_read_pilot_audit(uuid,date,integer)` e recarrega o catálogo.

## Lote de Projetos e entregáveis no CALI MAPA

Em 07/11/2026, a leitura do catálogo confirmou as colunas, complexidades MC1/MC2/MC3, exclusão de frente, revisões, tarefas, dependências e gatilhos de notificações. A resolução do ajuste abre outra revisão, mas não aplica a mudança pedida. A edição V2 permite ao Admin salvar a alteração antes da decisão. Não muda as RPCs legadas.

Ordem do lote: `project-qa-transport.sql`, `project-operations.sql`, `project-planning.sql`, `document-operations.sql`, `delivery-operations.sql` e projeção estendida `read-projects.sql`. `pilot-role.sql` já está instalado. A aplicação exige preflight de ausência das novas funções/tabelas e uma transação. A projeção adiciona campos opcionais, preservando assinatura e consumidores anteriores. A edição usa preimagem por `updated_at`, bloqueio do projeto e histórico. Remoção de frente usa o contrato legado com transferência obrigatória.

`project-qa-transport.sql` cria uma inscrição privada de projetos sintéticos. O último gatilho BEFORE de notificações força `email_required=false` somente para esses projetos e seus entregáveis, inclusive atualizações posteriores da fila. As notificações do app são preservadas; projetos não inscritos não mudam. Inscrever o projeto sintético antes de compartilhar ou executar. Nenhum worker ou envio externo é ativado. O gatilho não comprova entrega de e-mail. A inscrição permanece enquanto houver histórico ou lembrete sintético, evitando disparos posteriores.

O lote foi aplicado em uma transação em 07/11/2026. O catálogo confirmou `EXECUTE` para `authenticated` nas sete operações de projeto e nas duas RPCs específicas de PDF; `anon`, `service_role` e `PUBLIC` ficaram sem esse grant. O gatilho foi instalado com lista privada vazia; apenas o rascunho sintético criado pela interface foi inscrito antes do compartilhamento.

| Prova no navegador integrado | Resultado |
| --- | --- |
| Admin / Cliente A | Criação de projeto, frente e entregável; rascunho oculto para A; edição de complexidade MC2, publicação e prazo de 72 horas. |
| Revisão | A solicitou 13/11; Admin salvou o prazo de 16h em Brasília e acolheu; A aprovou a revisão 2 e ativou o projeto. |
| Entrega e correção | Admin publicou PDF 1, A baixou e aprovou. Reabertura manteve o mesmo item, removeu-o da listagem Cliente e recusou baixar pelo botão antigo. Reenvio sem revisão nova recusado. Admin publicou PDF 2 e A aprovou novamente. |
| Cliente B | A mesma URL de projeto retornou projeto indisponível. |
| Persistência | `CALI-PRJ-2026-000004` / `CALI-DEL-2026-000006` mantiveram frente e prazo. A avaliação original, a correção e as duas versões foram preservadas; só a versão 2 ficou publicada. Zero marcações de e-mail ou envio para as notificações do piloto. |

A homologação encontrou perda de vínculo quando a opção provisória do seletor era substituída pela lista de frentes. Seleção passou a manter o valor durante a carga, com teste de regressão. O vínculo do registro sintético foi corrigido pela interface e conferido no banco. Nenhum dado fora do piloto foi alterado.

A bateria suspensa de Auth/Edge/Docker não foi retomada. O PostgreSQL descartável usa apenas socket local e encerra ao terminar. Subtarefas, conversa e dependências foram homologadas no lote seguinte. Paridade com a publicação 83 permanece no aceite final. Arquivos legados permanecem protegidos pela recusa de reabertura; nenhum conteúdo legado foi migrado implicitamente.

Rollback operacional: desligar `VITE_CALI_PHASE4_WRITE`, retirar somente as RPCs novas de Projetos/PDF por `rollback-projects.sql` e manter registros, PDFs, aprovações e inscrições sintéticas. A projeção estendida é compatível com o leitor anterior. A supressão de e-mails do piloto permanece para impedir lembretes futuros dos testes. O rollback geral de escrita não deve ser usado para retirar apenas este lote, pois alcança Forms e outros recortes já homologados.

### Colaboração, histórico e execução de item

`project-journal.sql` expõe revisão de cronograma, movimentos, subtarefas, conversas, dependências e histórico em páginas de 25 registros. A consulta Cliente usa o vínculo da sessão e a visibilidade do projeto, entregável e subtarefa. Omite notas internas, estimativa e responsável administrativo. O histórico preserva a aprovação anterior e a correção no mesmo entregável.

`project-collaboration.sql` usa recibo de reexecução e trava do projeto/entregável. Admin cria/edita subtarefas com prazo em Brasília, complexidade, estimativa, visibilidade e responsável CALI. Envia a parte à revisão, registra retorno de dependência e revisa prazo com motivo e data anterior. Cliente comenta e aprova a parte ou pede até dois ajustes, sem aprovar a entrega inteira. Conversas encerradas recusam escrita. A nota interna nunca entra na projeção Cliente. Mudança de prazo que deixaria uma subtarefa aberta fora da entrega é recusada. A atualização de planejamento revalida a composição antes de abrir nova rodada.

Aplicado no CALI MAPA em 07/11/2026. O entregável de apoio `CALI-DEL-2026-000007` foi inserido como fixture no projeto sintético já inscrito. No navegador, Admin criou a subtarefa, enviou para revisão, compartilhou mensagem e gravou nota interna. Cliente viu a mensagem e não recebeu a nota; pediu ajuste e aprovou a parte após o reenvio. Entrega seguiu em execução. Admin solicitou retorno, Cliente viu a pendência, Admin registrou recebimento e revisou a data com histórico. A prova descartável cobre também limite de dois ajustes, idempotência, MFA, isolamento e conflito.

A pausa revelou `PERFORM … INTO` na função legada de forecast. PostgreSQL interpretou a linha como criação de tabela no schema do primeiro item do `search_path`. `repair-project-forecast.sql` troca somente a leitura por `SELECT … INTO`, mantendo definição restante, assinatura, dono e grants. O hash da definição mudou conforme esperado e o hash de ACL ficou igual. `rollback-project-forecast.sql` restaura a linha anterior. Admin pausou e retomou somente o entregável de apoio; o projeto permaneceu em execução e o histórico exibiu os dois movimentos. A revisão do calendário fora do mesmo dia continua coberta pelo contrato legado e requer cenário próprio de prazo.

Rollback do recorte: `rollback-projects.sql` retira as RPCs V2 e mantém registros, mensagens, dependências, histórico e supressão de e-mail do piloto. A correção do forecast tem reversão própria. Não houve deploy do aplicativo nem ativação de cron.

## Lote de lançamento e timer no CALI MAPA

A função instalada `pause_work_timer` fecha o trecho. Ela gera lançamento com arredondamento para cima a partir de 30 segundos e descarta trechos menores. A tela V2 esperava um registro ainda pausado. `hours-operations.sql` mantém a função legada e registra a continuação em tabela privada. Retomar abre outro timer com os mesmos vínculos, categoria, descrição e visibilidade. Encerrar uma pausa já contabilizada não gera outro lançamento. A pausa de ciclo, que deixa o timer legado em `paused`, permanece distinta. Projeto e entregável interrompidos bloqueiam retomada. Recibos protegem reenvio e um segundo timer não abre enquanto há trecho em execução ou pausa pendente para o mesmo Admin e empresa.

Em 07/11/2026, preflight conferiu as funções instaladas, zero timers abertos em A e capacidade de 750 minutos sem consumo. O lote instalou duas RPCs limitadas a `authenticated`, com guarda Admin e MFA. No navegador, Admin registrou 15 minutos com justificativa interna, iniciou timer, pausou, retomou e concluiu. Banco confirmou 15 minutos manuais e dois lançamentos de 1 minuto para o timer, zero timers e pausas pendentes. Cliente A viu o lançamento permitido sem a nota interna e sem ação de escrita. A regra temporária de novembro foi retirada e o Cliente voltou a ver o mês indisponível.

A prova isolada cobre reexecução de pausa/retomada, exclusão mútua e isolamento. A prova hospedada não cruzou os marcos de capacidade e não ativou agenda ou serviços externos. A [correção auditada](#correção-auditada-de-horas) cobre edição e exclusão justificadas. Vínculos de execução por subtarefa e marcos de capacidade permanecem em recortes próprios. `rollback-hours.sql` retira as RPCs após resolver as pausas do piloto e mantém lançamentos, timers e recibos.

## Lote de agenda ordinária no CALI MAPA

O catálogo confirmou ausência de agendamento de sincronização de Google/Meet e zero encontros incluídos nas empresas sintéticas. A prova inscreveu apenas o assunto sintético de A em `agenda-qa-transport.sql`. A inscrição mantém notificações do app e retira e-mail do pedido e do evento derivado antes do despacho. `agenda-operations.sql` e `agenda-change-operations.sql` instalaram cinco RPCs, com uma vaga contratual temporária em A, sem aceite de preço ou urgência.

Em 07/11/2026, Cliente A solicitou reunião online, Admin ofertou a opção e A confirmou. A tela exibiu confirmação no Workspace e integração pendente. A pediu remarcação para 17/11 ou 18/11, com o horário original preservado durante a análise. Admin aprovou 17/11 às 10h. O protocolo `CALI-EVT-2026-000006` foi preservado. A pediu cancelamento e Admin aprovou; A viu cancelamento e B não recebeu o pedido de A. Banco confirmou duas decisões, cancelamento, franquia restaurada a zero, nenhum adicional, nenhuma taxa e zero marcações ou envios de e-mail para o teste. Nenhuma sincronização externa foi chamada.

A prova PostgreSQL cobre reexecução, conflito de agenda, prazo, isolamento e supressão limitada ao pedido inscrito. `rollback-agenda.sql` retira as RPCs preservando evento, decisões e inscrição. A sincronização externa, as regras de extras e participantes adicionais continuam em recortes próprios.

## Lote de ocorrências, avisos e satisfação no CALI MAPA

Em 07/11/2026, oito RPCs foram instaladas em uma transação para o piloto. O catálogo confirmou execução para `authenticated` e recusa para `anon`. `record-qa-transport.sql` suprime e-mail somente para ocorrência com assunto e empresa inscritos, preservando notificações no app. O teste isolado confirmou que uma ocorrência fora da inscrição mantém o transporte anterior.

- `CALI-REG-2026-000005`: A abriu ocorrência; Admin registrou nota interna e resposta pública, depois finalizou. A viu apenas a resposta pública, avaliou com nota 3/5 e solicitou reabertura. Admin aprovou; A viu a decisão e B recebeu ocorrência indisponível ao abrir a mesma URL. Banco confirmou retorno a atendimento, decisão aprovada, nota original e zero marcações de e-mail.
- `AV-2026-0003`: Admin publicou aviso dirigido a A. A registrou ciência no mural e viu o mesmo título na agenda. B não recebeu o aviso. Após arquivamento, o aviso saiu da agenda de A e ficou disponível para restauração no Admin. Banco confirmou zero marcações de e-mail.
- Satisfação: Admin salvou acompanhamento do tema Atendimento. A nota 3/5 e o comentário original permaneceram iguais depois de recarregar.

`rollback-records.sql` retira as oito operações e o gatilho de menção V2; mantém os registros, recibos e a inscrição que protege a ocorrência sintética de disparos posteriores. PDFs de conversa têm [prova própria](#anexos-pdf-de-ocorrências-no-cali-mapa). Comentários e reações têm [prova própria](#interações-de-avisos-no-cali-mapa). A [prévia do resumo Admin](#prévia-do-resumo-diário-admin-no-cali-mapa) está homologada; envio continua separado. Nenhum serviço externo foi ativado.

## Lote da biblioteca de PDFs no CALI MAPA

No navegador, Admin salvou a revisão 1 privada, publicou para A, e A baixou o PDF sintético e registrou ciência. B ficou sem acesso. Admin adicionou a revisão 2 privada e publicou; o botão antigo de A teve o download recusado pelo servidor. Após recarregar, A viu a revisão 2 e registrou ciência própria. Admin retirou a publicação, A perdeu a listagem e as duas revisões ficaram no histórico administrativo. Foram usadas as RPCs do lote de Projetos já instaladas. Nenhum arquivo legado foi movido; Drive e anexos de ocorrência permanecem fora dessa prova.

## Lote de aprovação interna de relatório no CALI MAPA

`report-draft-operations.sql` foi instalado em 07/11/2026. O catálogo confirmou os auxiliares de prontidão, coleta e identidade e a estrutura da tabela de relatórios. Admin criou o rascunho de outubro para A, editou o resumo, enviou para revisão e aprovou. A não viu o relatório interno. Admin reabriu com motivo e aprovou novamente; a interface exibiu as duas versões no mesmo protocolo `CALI-RPT-2026-000012`. Banco confirmou versão 2 aprovada, duas aprovações preservadas, sem publicação ou envio e zero marcações de e-mail.

O formulário duplicava ao alternar a empresa porque o editor e a consulta de prontidão usavam a mesma chave entre irmãos. A tela agrupa os dois sob a chave da empresa e mantém um único formulário na alternância A/B. A situação de revisão é exibida em português.

A geração, liberação e ciência foram validadas no [lote hospedado seguinte](#lote-de-pdf-executivo-no-cali-mapa). O bundle local passou no build. O preflight da revisão 2 confirmou os tipos de horas, entregáveis e feedback exigidos, a identidade configurada com foto em origem permitida e assinatura virtual, a permissão de uso do schema já existente para o serviço e a ausência de liberações ativas. Para homologar, conferir a disponibilidade da imagem, instalar `report-release-operations.sql` e ativar temporariamente apenas a Edge `workspace-executive-pdf` com JWT. Usar só A, conferir recusa em B e retirar a liberação sintética. Desligar a flag e desativar a função temporária ao fim. `rollback-report-release.sql` remove somente as RPCs de geração/liberação, recusa reversão enquanto houver publicação ativa e conserva PDFs, ciências e histórico. Esse passo exige ativação hospedada explícita. `rollback-report-drafts.sql` retira apenas o acesso às três RPCs de rascunho e preserva relatórios e aprovações.

## Horas vinculadas a entregável e subtarefa

Admin abre Horas pelo entregável ou pela subtarefa. A consulta resolve os nomes e a relação entre empresa, projeto e item, exige MFA e permite registrar horas manuais em contexto operacional. O timer exige execução normal do projeto e entregável. A operação revalida os vínculos antes de gravar e inclui os identificadores no recibo de reenvio. A retomada preserva projeto, entregável e subtarefa e recusa item encerrado. Lançamentos sem vínculo e seus recibos continuam compatíveis.

No CALI MAPA, Admin abriu o entregável sintético de A pelo atalho e lançou dois minutos internos. Depois abriu Horas pelo atalho de uma subtarefa interna, iniciou, pausou, retomou e concluiu o timer. O banco confirmou dois trechos privados, de dois e um minuto, com o mesmo projeto, entregável e subtarefa. A conclusão marcou a subtarefa como concluída e encerrou sua execução. Nenhuma pausa do teste ficou pendente. O PostgreSQL descartável verificou também a recusa de mudança de vínculo no recibo e o bloqueio de Cliente.

Para reverter só o lote, restaurar `v2_pilot_hour_action` de `fe4f122`, remover `v2_pilot_linked_hour_action`, `v2_pilot_hour_link` e a implementação privada, e recarregar o schema da Data API. Concluir timers do recorte antes de reverter. Preservar lançamentos, recibos e histórico.

## Horas vinculadas a ocorrência

Admin com MFA inicia o timer no detalhe de uma ocorrência aberta e acompanha os trechos em Horas. O servidor confere a empresa, o estado da ocorrência e o projeto operacional quando houver. O início é idempotente e compartilha a exclusão mútua com os demais timers e pausas. Retomar um trecho fechado chama a operação legada de ocorrência, preservando o vínculo. O fechamento usa o cálculo e a capacidade existentes, com visibilidade Cliente desmarcada na origem. A conclusão do timer não altera a situação da ocorrência.

No CALI MAPA, Admin iniciou, pausou, retomou e concluiu o timer da ocorrência sintética de A. O extrato apresentou dois trechos de dois minutos com o mesmo protocolo. O PostgreSQL descartável confirmou repetição, pausa pendente, recusa em outra empresa, ocorrência encerrada e tentativa de Cliente. O formulário de horas manuais permanece no fluxo existente.

A instalação atualiza `hours-operations.sql`. Para reverter apenas este incremento, conclua timers e pausas de ocorrência do piloto, reaplique a definição privada de `pilot_hour_action` de `5301d8d` e retire `v2_start_pilot_record_timer(uuid,uuid,uuid)`. Recarregue o schema da Data API e reverta a ação do detalhe da ocorrência. Lançamentos, timers, recibos e histórico são preservados.

## Marcos de capacidade em Horas

A RPC V2 de Horas projeta a pausa vigente e os marcos persistidos para a empresa e o mês consultados. No mês liberado, Cliente vê atenção ao consumo, capacidade integral e excedente. Admin também vê tolerância e revisão da capacidade. A resposta inclui percentual gravado, instante e número de ocorrência quando houver. Nota de pausa, destinatários e metadados de envio ficam fora. A consulta não avalia gatilhos, pausa atividades nem dispara mensagens.

No CALI MAPA, Admin conferiu novembro em A e B sem marcos registrados. Cliente A continuou com novembro fechado. No PostgreSQL descartável, a prova com dados confirmou pausa, isolamento por empresa e mês, o marco público de 75% e a exclusão do marco de revisão e da nota interna na resposta Cliente. O piloto segue sem prova hospedada de cruzamento de faixa e despacho.

Para reverter apenas este lote, restaurar `v2_read_pilot_hours(uuid,date,integer)` de `11060fe` e recarregar o schema da Data API. A operação preserva os marcos, pausas e lançamentos existentes.

## Registro de realização de reunião ordinária

Admin com MFA registra a realização após o fim da reunião contratual confirmada. A V2 verifica vínculo entre solicitação e evento, empresa, resultado anterior e ausência de alteração pendente. Reexecução da mesma conclusão devolve o resultado já gravado. Cliente lê a situação Realizado. A rotina instalada grava o resultado e conclui a solicitação. Ata, falta justificada, reposição e extras seguem em fluxos próprios.

O PostgreSQL descartável confirmou a conclusão, a repetição sem duplicata e as recusas de Cliente, empresa divergente, reunião futura ou cancelada e alteração pendente. A inspeção do CALI MAPA confirmou a rotina de realização e encontrou somente uma reunião sintética anterior do lote A, já cancelada. Instalação e prova hospedada deste incremento ficam para uma reunião sintética encerrada pelo horário e ainda confirmada. A instalação usa a projeção de `agenda-operations.sql` e a RPC de `agenda-change-operations.sql`. Para reverter só esta ação, retire `v2_complete_pilot_appointment(uuid,uuid)` e recarregue o schema da Data API. A projeção desabilita a ação e preserva os resultados gravados.

## Participantes e encontros adicionais no CALI MAPA

A agenda ordinária projeta nome, papel e resposta dos participantes da reunião, preservando empresa, visibilidade e corte por cancelamento. Admin com MFA pode consultar participantes no histórico. A consulta de extras é paginada e separada dos pedidos ordinários. Ela usa os centavos e instantes de aceite registrados, sem expor nome da pessoa que aceitou, notas ou dados de contato. A decisão ordinária recusa pedidos extras online mesmo quando os indicadores de cobrança e urgência estão desligados.

No CALI MAPA, Admin consultou dois participantes no histórico da reunião cancelada de A. Cliente A continuou vendo o cancelamento sem a lista de participantes, e B ficou isolado. Os três contextos exibiram a consulta de extras vazia. O PostgreSQL descartável verificou valores de visita presencial e extra online, aceite, taxa registrada, visibilidade do evento ativo, corte no cancelamento, isolamento e recusa do extra na decisão ordinária. A homologação de extras com pedidos existentes, edição de participantes, aceite, cobrança e integrações externas segue pendente. O inventário hospedado confirmou que cancelar ou reagendar visita extra altera o evento anterior e registra e-mail para Admins. A decisão sobre taxa grava zero ou 16.000 centavos e marca e-mail ao solicitante. Exercitar essas operações exige fixture e isolamento do transporte específicos para extras.

Instalar a atualização de `agenda-operations.sql` e `agenda-extras-read.sql` após conferir as definições hospedadas. Reverter a consulta de extras removendo `v2_list_pilot_agenda_extras(uuid,integer)`. Para reverter também a projeção de participantes, restaurar somente `v2_list_pilot_appointments` de `8777bc6`. A guarda da decisão ordinária pode permanecer. Os registros são preservados.

## Frentes contratadas e Ajuda no CALI MAPA

A RPC de catálogos projeta o título e a descrição da frente, seu escopo contratado, modalidade e vigência. Cliente consulta frentes ativas da própria empresa. Admin também consulta as encerradas. A tela de Frentes leva à solicitação ordinária na Agenda, que mantém as guardas e o formulário existentes. Abrir o formulário não cria pedido.

O CALI MAPA recebeu a projeção após conferência da definição anterior. As empresas A/B estavam sem vínculos. No navegador, B abriu Frentes, viu o estado vazio e chegou ao formulário de encontro do contrato. PostgreSQL descartável comprovou a projeção de uma frente ativa e ocultou a encerrada do Cliente. O lote seguinte validou a [gestão administrativa](#gestão-administrativa-de-frentes-no-cali-mapa).

Reversão deste lote: reaplicar a definição de `v2_read_pilot_catalog` de `2ff8b33` como `create or replace function`, recarregar o schema da Data API e reverter o front deste recorte. Nenhuma associação contratual foi criada pela instalação.

## Gestão administrativa de Frentes no CALI MAPA

Admin com MFA consulta as combinações de frente e modalidade do plano, ativa um vínculo com escopo e vigência e encerra com confirmação. `validate_company_front` continua responsável pelas regras de catálogo, elegibilidade e vagas. A ativação bloqueia a linha da empresa antes da escrita e usa recibo por solicitação. O encerramento preserva o vínculo e sua autoria, e a repetição devolve o mesmo resultado. Cliente segue com leitura da própria empresa. O vínculo não executa cobrança, alteração de plano ou sincronização.

No CALI MAPA, B já tinha CALI Build Essencial. Admin ativou **Indicadores essenciais** com escopo sintético, e a tentativa de ativar **Liderança** em paralelo à frente existente foi recusada. B viu a frente com modalidade e vigência; A ficou vazia. Admin encerrou o vínculo e manteve o registro no histórico. Após recarregar, B voltou ao estado vazio. Em 08/11, Admin ativou e encerrou em A as três modalidades do Full, vaga adicional no Partner e acompanhamento no Build Completo. Cliente A viu as frentes ativas do Full e voltou à lista vazia após o encerramento. A configuração de plano de A foi restaurada. PostgreSQL descartável também passou em repetição, recusa sem plano e isolamento.

Instalar `front-operations.sql` após `pilot-role.sql`, `operation-receipts.sql` e o catálogo atualizado. `rollback-front-operations.sql` retira só as três RPCs e preserva os registros, recibos e auditoria.

## Curadoria de relatórios no CALI MAPA

Admin com MFA edita quatro textos opcionais de até 2.000 caracteres por seção em relatórios V2 em rascunho ou revisão interna. A operação trava a linha, confere o instante visto na tela e grava uma trilha com autoria e versão. As seções ficam na tabela privada `cali_session_guard.phase4_report_curation`; as quatro colunas legadas permanecem reservadas ao contrato anterior. A aprovação congela a curadoria junto das fontes e do resumo. O catálogo Cliente lê as seções da revisão liberada e o gerador usa o mesmo retrato. Aprovações antigas continuam legíveis.

No CALI MAPA, o Admin salvou as quatro seções do relatório sintético `CALI-RPT-2026-000012`, confirmou a persistência após recarga e aprovou a revisão 3. O banco confirmou as aprovações 1, 2 e 3, um evento de curadoria, igualdade entre as seções salvas e o retrato aprovado e zero liberações ativas. As telas de A e B ficaram vazias. A função de PDF seguiu desligada. A prova local cobre o conteúdo entregue ao gerador e ao Cliente na revisão liberada, recusa de versão desatualizada e preservação de revisões anteriores.

A instalação alterou a RPC de aprovação e o catálogo de revisões e adicionou a RPC de curadoria. A flag `VITE_CALI_PHASE4_REPORT_RELEASE` habilita o catálogo com curadoria. Para reverter só este lote, restaurar as definições de `v2_update_pilot_report_draft` e `v2_read_pilot_report_catalog` de `cf431f5`, retirar `v2_curate_pilot_report(uuid,uuid,timestamptz,jsonb)` e recarregar o schema da Data API. Preservar a tabela privada, as aprovações e os PDFs. Antes de gerar o PDF da versão 3, usar o bundle do gerador com suporte à curadoria.

## Indicadores congelados do relatório executivo

O catálogo e a preparação do PDF usam a mesma projeção do retrato aprovado de horas contratadas e registradas, entregáveis criados e aprovados e avaliação média. O servidor só inclui a média a partir de duas avaliações e limita a resposta a valores agregados. Tela e PDF usam a mesma formatação. Os cálculos e fontes congeladas continuam no contrato de coleta existente.

Admin conferiu horas e entregáveis na revisão 3 de `CALI-RPT-2026-000012` no CALI MAPA. A média ficou oculta para o retrato com zero avaliações. O teste descartável confirmou igualdade de indicadores entre a preparação do PDF e o catálogo publicado, omissão da avaliação individual e inclusão do agregado quando elegível. O gerador hospedado seguiu desligado. A prova de republicação da revisão com curadoria e as fontes restantes seguem abertas.

Reversão deste incremento: restaurar `v2_prepare_pilot_report_pdf` e `v2_read_pilot_report_catalog` de `2ae02af`, retirar `cali_session_guard.phase4_report_metrics(jsonb)` e recarregar o schema da Data API. Preservar o retrato, as revisões, os PDFs e as ciências.

## Republicação com curadoria no CALI MAPA

Admin gerou a revisão 3 do relatório sintético `CALI-RPT-2026-000012` e republicou no Workspace com a opção de nova ciência desmarcada. A viu `CALI-EXEC-2026-000002`, os indicadores e a curadoria e baixou o PDF A4 de uma página. B ficou sem a revisão. O arquivo de 211.484 bytes coincidiu com o SHA-256 do banco (`3c35f8711e1a7d50ef28239aad1f00ab7e36e427ce6ac0b565d866396e66bc6a`). A inspeção de texto e página confirmou as quatro seções, os indicadores, a assinatura virtual e o protocolo.

A revisão 2 preservou sua ciência. A revisão 3 manteve ciência opcional desmarcada e zero marcações de e-mail. Admin encerrou o teste reabrindo com motivo, o mesmo relatório voltou a rascunho e o download anterior de A foi recusado. O gerador temporário usou JWT obrigatório e foi removido do catálogo após a geração.

## Limite de autorização no Portal Comercial

A inspeção de 07/11/2026 confirmou que as policies de leitura e escrita de `cali_proposals` e `cali_submissions` usam a identidade da administradora do Portal. Um Admin do Workspace com MFA não recebe automaticamente esse papel. A RPC de escrita continua com privilégios do chamador. Homologar a edição e aprovação exige sessão com as duas autorizações ou decisão explícita sobre uma regra nova no Portal. Não houve ampliação de policies, criação de proposta hospedada, aceite ou disparo de e-mail neste lote.

No navegador integrado, a sessão Admin abriu Propostas e recebeu lista vazia tanto em ativos quanto em arquivados. A conferência administrativa em leitura encontrou 12 oportunidades, nove propostas em rascunho e zero oportunidades inscritas no piloto. Felipe autorizou a delegação temporária abaixo.

## Delegação temporária de Propostas no staging

O CALI MAPA recebeu três RPCs V2 e uma guarda privada. A inscrição vincula proposta, oportunidade, empresa e operador. Felipe autorizou sua conta Admin para a versão 1 da proposta sintética `CALI-QA-V2-PROPOSTA-01` da Empresa A, com validade inicial de uma hora. A oportunidade usa um contato em `example.invalid`. Grants e policies do Portal legado foram preservados.

No navegador integrado, a sessão do Felipe salvou condições e validade de 25 dias e aprovou a versão internamente. O valor permaneceu R$ 100,00. A Empresa B não viu a proposta. O banco confirmou dois eventos de auditoria, nenhum envio e a revogação da delegação. A proposta saiu da lista da Empresa A após nova consulta.

A suíte SQL descartável confirmou a recusa para outro Admin com MFA, falta de MFA, empresa divergente, outra versão, autorização expirada e versão obsoleta. `rollback-commercial.sql` retira as RPCs e a guarda privada. Propostas, inscrições e auditoria ficam preservadas.

## Criação, envio no Workspace e aceite no staging

`commercial-create.sql` cria uma única versão para oportunidade sintética inscrita, com pacote e preço previamente fixados no servidor. O mesmo pedido devolve o rascunho existente. `commercial-delivery.sql` publica no Workspace uma cópia das condições aprovadas para um destinatário sintético inscrito. O Cliente vê a proposta em `/cliente/propostas` e aceita a versão recebida dentro do prazo. Criação, envio e aceite registram os atores na auditoria. A proposta e o histórico permanecem após revogar a delegação e o destinatário.

Em 07/11/2026, o Admin criou, editou, aprovou e enviou a versão 1 de `CALI-QA-V2-PROPOSTA-02` no navegador. Cliente A conferiu as condições e aceitou. O banco confirmou cinco eventos, versão 1, R$ 175,50, estado aceito e nenhum envio de e-mail. As duas autorizações temporárias foram encerradas. Uma nova consulta Cliente mostrou a caixa vazia.

O PostgreSQL descartável comprovou reexecução sem duplicar, MFA Admin, empresa divergente, versão divergente, prazo e revogação do destinatário. O recorte usa preço sintético e entrega autenticada no Workspace. Calculadora comercial, PDF enviado por e-mail e aceite por link externo continuam pendentes. `rollback-commercial.sql` retira as RPCs e mantém propostas, delegações e auditoria.

A leitura da Edge legada confirmou que ela recebe PDF e destinatário no payload, grava o arquivo e chama o Resend antes de atualizar os registros comerciais. A chave de idempotência usa proposta e data da revisão. A integração da V2 precisa vincular o PDF e o destinatário à versão aprovada e registrar a entrega externa separadamente do aceite no Workspace. A Edge legada não foi executada nesta homologação.

## Calculadora CALI Build e e-mail sintético

O piloto aplica no servidor os fatores do CALI Build, arredonda o subtotal em múltiplos de R$ 50, aplica adicionais, desconto de até 50% e o prazo mínimo de quatro ou seis meses conforme o pacote. A base sintética vem da inscrição da oportunidade. Na proposta `CALI-QA-V2-PROPOSTA-03`, o navegador conferiu a versão 1 aprovada a R$ 1.395,00 por mês durante quatro meses. O banco confirmou base de R$ 1.000,00, subtotal de R$ 1.550,00 e desconto de 10%. A calculadora dos demais serviços e o catálogo de preços comerciais ficam em recorte próprio.

O envio de staging lê a revisão aprovada do banco, gera e persiste o PDF e usa apenas `delivered@resend.dev`. O mesmo pedido reutiliza o PDF, o token e a chave de idempotência. O aceite externo usa um token com prazo, guarda somente seu hash e exige confirmação. A abertura do link apenas consulta a proposta. O pacote local também foi validado com transporte simulado, incluindo falha e nova tentativa.

Após autorização explícita, a Edge temporária `workspace-commercial-email` v1 foi publicada no CALI MAPA com JWT obrigatório. Admin enviou o PDF da proposta 03 ao simulador do Resend. O navegador abriu o link de teste no frontend local, mostrou a versão 1 a R$ 1.395,00 mensais durante quatro meses e registrou o aceite após confirmação. O banco registrou o recibo do simulador, PDF de 939 bytes, status `aceita` e os eventos `resend_test` e `external_test`. A homologação cobre o simulador e o link local.

Ao final, o link foi revogado, a delegação expirou e a Edge foi removida. O navegador confirmou a recusa do link após recarregar e o catálogo confirmou a remoção da função. Para retirar também as operações de banco, usar `rollback-commercial-email.sql`. Propostas, PDFs e auditoria ficam preservados.

## Lote de pedido de privacidade no CALI MAPA

A rotina legada de abertura avisa todos os Admins ativos e a de resposta notifica o solicitante. `privacy-qa-transport.sql` suprime os dois avisos apenas para empresa e descrição sintéticas inscritas. O PostgreSQL descartável comprovou que outra solicitação ou outra empresa mantém o transporte anterior.

`report-privacy-operations.sql` foi instalado junto à proteção em 07/11/2026, com a consulta de prontidão e a ciência inicial legada. No navegador, A registrou pedido de acesso, Admin respondeu e A confirmou a resposta após recarregar. B ficou sem o pedido. Banco confirmou estado respondido, dois eventos de auditoria e zero notificações no app ou fila de e-mail. Nenhum dado pessoal foi exportado ou excluído. A ciência do relatório publicado e o ciclo de dados ainda exigem seus recortes próprios.

`rollback-privacy.sql` retira as operações V2 do lote e preserva pedidos, recibos e eventos. A inscrição e o gatilho de supressão permanecem para proteger a fixture em eventuais chamadas legadas.

## Lote de PDF executivo no CALI MAPA

Em 07/11/2026, as seis RPCs de `report-release-operations.sql` foram instaladas no CALI MAPA. A Edge `workspace-executive-pdf` v1 foi publicada temporariamente com JWT obrigatório, sem cron. O Admin gerou o PDF da versão 2 de `CALI-RPT-2026-000012`, liberou no Workspace e baixou a cópia. Cliente A viu o protocolo `CALI-EXEC-2026-000001`, baixou e registrou ciência. Cliente B não viu o relatório. As duas cópias A4 de 210.809 bytes tiveram o mesmo SHA-256 do banco; texto extraído confirmou o protocolo e o resumo.

Admin reabriu a versão com motivo; a versão 3 voltou a rascunho. O botão antigo de A recusou novo download, e a listagem após recarga ficou vazia. Banco confirmou ciência e retirada da versão 2, zero liberações ativas e zero marcações de e-mail. A Edge foi removida e sua ausência confirmada no catálogo. PDF, aprovações, liberação retirada e ciência continuam preservados.

A homologação encontrou falta de confirmação persistente na tela após registrar ciência. O catálogo passou a distinguir ciência já registrada de publicação que não a solicita; a interface usa o estado confirmado pelo servidor. A atualização hospedada substituiu só o leitor, com grants preservados. O teste em PostgreSQL descartável confirma os dois estados e a ciência idempotente. `rollback-report-release.sql` retira as operações V2 sem apagar a prova e exige retirar liberações ativas antes de rodar. A nova renderização requer ativar a Edge de novo.

## Confirmação de coleta pública em Forms

Em 07/11/2026, o CALI MAPA recebeu apenas a guarda de abertura da V2. A RPC anterior encerra formulário aberto e recusa tentativas de abertura. A nova RPC exige Admin com MFA, empresa piloto, situação esperada, perguntas, confirmação por e-mail desativada e confirmação explícita de que qualquer pessoa com o link pode responder. A auditoria registra a abertura como coleta por link público. O catálogo confirmou execução da ação administrativa para `authenticated`, sem grant anônimo. As RPCs públicas legadas permanecem iguais.

A prova descartável cobriu recusa sem confirmação, tentativa pelo contrato anterior, empresa divergente, configuração de e-mail, estado obsoleto, abertura explícita, encerramento e auditoria. No navegador, os formulários de A continuaram fechado e em rascunho e exibiram o aviso de link público. Nenhuma coleta foi aberta no CALI MAPA. `rollback-forms.sql` retira as operações V2 preservando os dados; manter o bloqueio na RPC anterior em reversões parciais.

## Consulta do ciclo de dados no CALI MAPA

Em 07/11/2026, o catálogo confirmou que `company_access_closed` considera conta bloqueada, encerrada ou arquivada. `company_elimination_ready` exige conta encerrada, ao menos 45 dias desde o encerramento e ausência de eliminação anterior. O intervalo é a regra técnica encontrada no banco, sem inferir prazo jurídico nem autorização para eliminar.

`data-lifecycle-read.sql` adiciona uma consulta para Admin com MFA e empresa piloto. O painel de Privacidade mostra situação, corte decorrente da situação da conta, datas quando registradas e cumprimento do intervalo técnico. O retorno omite perfis, anexos, cobranças e conteúdo dos pedidos. No navegador, Admin alternou entre A e B sem alterar contas; as duas estavam ativas e não tinham intervalo cumprido. A prova descartável verificou conta arquivada, fronteira dos 45 dias, eliminação registrada e recusa para Cliente e Admin sem MFA. `rollback-data-lifecycle-read.sql` remove só a consulta.

O inventário confirmou que a exportação legada retorna JSON amplo, separa dados restritos e registra destinatário. A eliminação legada remove linhas, invalida sessões e anonimiza usuários; a rotina recebe a contagem de arquivos removidos, sem orquestrar essa remoção. A V2 ainda precisa reconciliar cobertura, destino, dados restritos e retomada após falha parcial antes de expor as operações. A homologação da consulta não exportou, não encerrou e não eliminou dados.

## Correção auditada de horas

A V2 reaproveita as rotinas legadas de edição e exclusão auditada. `hour-corrections.sql` exige Admin com MFA, empresa piloto, justificativa e a versão do lançamento, com bloqueio da linha durante a operação. O mesmo pedido reexecutado devolve o resultado original; outra operação sobre versão antiga é recusada. A edição mantém vínculo, categoria e nota interna e permite ajustar data, descrição, duração e visibilidade. A exclusão retira o lançamento e preserva a trilha. A projeção Admin inclui a versão somente com a RPC de correção instalada. Cliente não recebe a versão nem a nota interna.

Em 07/11/2026, leitura e correção foram instaladas no CALI MAPA sem alterar as rotinas legadas. No navegador, Admin corrigiu a duração do lançamento sintético de A de 15 para 16 minutos, abaixo dos marcos de capacidade. Extrato e capacidade passaram de 17 para 18 minutos; a nota foi preservada. Exclusão foi exercitada somente no PostgreSQL descartável, com autoria/justificativa, reexecução, versão obsoleta, MFA e fronteira de empresa. `rollback-hour-corrections.sql` retira a operação e faz desaparecer os controles no próximo carregamento; preserva os lançamentos e os eventos.

## Anexos PDF de ocorrências no CALI MAPA

Na conversa existente, Admin ou Cliente anexa um PDF de até 2 MiB por mensagem. Texto e bytes confirmam na mesma transação; erro ou reenvio do mesmo pedido não deixa anexo avulso nem duplica mensagem. Os bytes ficam em tabela privada e a leitura da conversa projeta só o nome e a permissão de retirada. O download confere sessão, empresa, ocorrência, visibilidade da mensagem e retirada; usa `private, no-store` e verifica o digest. A retirada exige motivo e Admin com MFA, somente para anexo de mensagem Admin; preserva a mensagem e a trilha. Mensagens Cliente continuam originais. Arquivos já baixados continuam no dispositivo.

Em 07/11/2026, o lote instalou a tabela privada, três RPCs e a extensão do leitor. Admin enviou um PDF público para A e um PDF interno na mesma ocorrência sintética. A baixou o arquivo público com o mesmo SHA-256 da origem e não viu a nota interna nem seu arquivo. B recebeu ocorrência indisponível. A retirada do PDF público recusou o download no botão antigo; recarga manteve a mensagem sem o botão. Banco confirmou dois PDFs preservados, um retirado, um interno e zero marcações de e-mail.

O PostgreSQL descartável também provou arquivo inválido sem postagem, PDF Cliente, alteração de pedido já usado, negação de download interno/cruzado e retirada idempotente. A reversão `rollback-record-attachments.sql` retira as três RPCs, oculta a capacidade de anexo e preserva bytes e histórico. O acervo de anexos do bucket legado, outros formatos e anexos na abertura da ocorrência ficam fora deste recorte.

## Interações de avisos no CALI MAPA

Admin com MFA e Cliente admitido leem e publicam comentários da empresa em avisos publicados do seu público. Aviso geral não forma conversa entre empresas. O leitor retorna texto, papel e instante, sem identificadores de usuários. Comentários usam recibo de reenvio; a reação própria usa o valor anterior para recusar sobrescrita concorrente. Gostei, Adorei, Aplausos e retirada correspondem ao contrato legado de uma reação por usuário/aviso. Reação existente em outro contexto não é movida. Nenhuma dessas operações dispara notificação.

Em 07/11/2026, três RPCs V2 foram instaladas sem alteração das tabelas ou policies legadas. Admin restaurou somente o aviso sintético dirigido a A. Cliente comentou, reagiu, trocou a reação e recebeu a resposta Admin depois da recarga. B ficou sem acesso. Cliente retirou a reação e Admin arquivou novamente; aviso saiu da listagem de A. Banco confirmou dois comentários, zero reações e zero marcações de e-mail. A prova descartável também cobriu aviso geral com isolamento, conflito, reenvio e recusa após arquivamento.

`rollback-notice-interactions.sql` retira as operações e preserva o histórico. Moderação de comentários e capa foram tratadas nos lotes seguintes.

## Moderação de comentários no staging

Em 07/11/2026, o CALI MAPA recebeu a RPC de moderação, a atualização do leitor e a policy restritiva para a leitura direta de comentários. O Admin restaurou temporariamente o aviso sintético da Empresa A, ocultou um comentário com motivo e confirmou que o Cliente A ainda via a outra resposta. Depois restaurou o comentário, o Cliente A voltou a vê-lo e o aviso foi arquivado novamente. As duas ações ficaram na auditoria. A reversão operacional retira a RPC de moderação e preserva o filtro enquanto houver comentários ocultos.

## Prévia do resumo diário Admin no CALI MAPA

A prévia na Auditoria usa RESUMO-01/DEC-19. Considera notificações do dia em Brasília até a consulta e horas pela data de atuação. Deduplica por empresa, bloco, título, texto e entidade. Ordena empresas pelo volume; mantém os totais completos, até 12 itens por bloco e 180 caracteres por trecho. Inclui empresas com apenas horas. A lista positiva cobre os tipos operacionais conferidos no piloto e exclui chat, mensagens de tarefa/entregável, avisos internos, destinatários de equipe e notificações sem tipo reconciliado. Tipos que ainda não têm produtor ou classificação inequívoca no piloto não entram por aproximação.

Em 07/11/2026, instalou-se apenas o leitor para Admin com MFA e A/B. No navegador, a prévia mostrou 15 ações Cliente, 14 CALI e 18 minutos, com “e mais 3” e “e mais 2” nos blocos. Cliente foi redirecionado ao tentar abrir a Auditoria. O PostgreSQL descartável verificou sábado, fronteira de Brasília, corte de geração, dia vazio, dia só com horas, deduplicação, isolamento, exclusões e 2.101 avisos elegíveis sem truncar o total.

`rollback-admin-daily-preview.sql` remove só a consulta. Não houve configuração de cron, ativação do digest de chat, seleção de destinatários ou envio de e-mail. Despacho das 19h, destinatários ativos com e-mail, idempotência por destinatário/dia e integração de fontes restantes continuam pendentes.

Em 08/11, a prévia passou a incluir a liberação V2 de relatório em “A CALI fez”. Usa a revisão liberada no intervalo de Brasília que ainda estava disponível no instante de corte, com título e link para Relatórios da empresa. A prova no CALI MAPA usou a revisão sintética 4 de `CALI-RPT-2026-000012`: a linha apareceu no instante da liberação e sumiu no da retirada. O PostgreSQL descartável também excluiu a liberação posterior ao corte. O cron legado permaneceu desligado. A reversão em `output/runtime/phase4c/daily-preview-report-rollback.sql` restaura a definição privada anterior.

A [fila privada do piloto](../../supabase/proposals/phase-4/admin-daily-queue.sql) prepara o retrato das 19h de Brasília somente para Admin inscrito, ativo e com e-mail. Uma chave por perfil e dia impede duplicatas. O ensaio no CALI MAPA criou uma entrada para o Admin da fixture de Forms, recusou repetição e execução fora do minuto, e desfez a fila por rollback. A suíte descartável também cobre sábado, dia vazio e exclusão de Cliente, staff e Admin inativo, sem e-mail ou sem inscrição. O [consumo da fila](../../supabase/proposals/phase-4/admin-daily-dispatch.sql) reserva uma entrada por 45 segundos, revalida o perfil e conserva a mesma chave de idempotência em nova tentativa. Um recibo confirma o consumo, com rejeição de reserva obsoleta. No CALI MAPA, a prova transacional cobriu reserva exclusiva, expiração, nova tentativa e recibo fictício com o papel de serviço. O rollback removeu a fila de ensaio e o cron continuou desligado. O worker usa exclusivamente o destinatário [de teste do Resend](https://resend.com/docs/dashboard/emails/send-test-emails). O teste local simulou falha do provedor e confirmou o mesmo corpo e a mesma chave na repetição. A janela de duas horas da fila cabe na [retenção de 24 horas da chave no Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). O cron do resumo Admin segue desligado no staging.

### Envio sintético do resumo Admin pelo Resend

Em 08/11/2026, o worker temporário do CALI MAPA exigiu JWT e uma chave exclusiva. A primeira fixture tinha um link fora do formato aceito e foi recusada na validação anterior à chamada ao provedor. Com a fixture corrigida, o worker respondeu HTTP 200 e a fila confirmou um único recibo do Resend para o resumo fictício destinado a `delivered@resend.dev`.

Após a prova, o catálogo confirmou a remoção do worker, da chave, da fila, da inscrição de teste e das rotinas temporárias de fila e recibo. O cron permaneceu desligado. O teste comprova o transporte ao simulador. O aceite de operação com agendamento e destinatários autorizados permanece no rollout.

### Contenção do resumo legado no staging

Em 07/11/2026, um e-mail recebido às 19h de Brasília incluiu as atividades da Empresa A sintética. O catálogo do CALI MAPA confirmou que o job legado `workspace-admin-daily-summary` (7) executou às 19h e chamava o resumo do próprio staging. A Edge de propostas ainda estava ausente no momento da verificação. O job legado foi pausado com `cron.alter_job` e o catálogo confirmou `active=false`, com o horário e o histórico preservados. A reversão reativa apenas o mesmo job com `cron.alter_job(7, active := true)`. Antes de reativar, separar as empresas e os destinatários de teste do despacho real.


## Complementos locais da fase 4

| Fluxo | Mudança e prova em PostgreSQL descartável | Pendência de homologação |
| --- | --- | --- |
| Projetos | O detalhe sinaliza prazo vencido quando a revisão ainda está pendente. Felipe confirmou que a revisão fica aberta. A prova cobre antes e depois do vencimento e o pedido de ajuste posterior. | Homologação do aviso, migração dos arquivos legados elegíveis e paridade do fluxo. |
| Horas | Admin registra pausa no mês com capacidade excedida e pode retomar no mesmo mês. A decisão mantém o comportamento mensal do painel legado e a leitura do Cliente respeita a visibilidade do extrato. A prova cobre retomada, reexecução, versão obsoleta, mês seguinte e recusa sem excedente. | Instalar e homologar as duas transições em empresa sintética. |
| Agenda | Admin registra reunião ordinária não realizada com motivo interno e indicação de falta justificada. A rotina legada decide se a solicitação volta para análise de reposição. A gravação é vinculada ao evento e uma repetição idêntica preserva o resultado. A prova cobre registro, repetição, conflito, recusa para Cliente e motivo interno fora da consulta do Cliente. | Instalar e homologar realizada e não realizada em reunião sintética passada e confirmada. Fechar oferta de reposição, ata, participantes e extras. |
| Avisos | Admin oculta e restaura comentários com motivo. O texto permanece no histórico e a versão impede sobrescrever decisão concorrente. O Cliente perde acesso tanto pela RPC quanto pela leitura direta sob RLS. A prova cobre restauração, repetição, versão obsoleta e isolamento. A auditoria projeta o evento sem o motivo. | Conferir RLS e permissões efetivas hospedadas antes de instalar. Capa de avisos, anexos e despacho do resumo diário seguem em recortes próprios. |
| Relatórios | O catálogo Admin mostra contagens de projetos, tarefas, eventos, documentos e comentários a partir do retrato já gravado. Em revisão aprovada usa o retrato congelado. Zero aparece como dado disponível, campo ausente não vira zero. A projeção fica fora do Cliente e do PDF. | Validar paridade visual e definir quais fontes adicionais podem ser compartilhadas com o Cliente. |
| Administração | Frentes mostra modalidades limitadas com vaga em uso e atualiza após ativação ou encerramento. A validação transacional continua no banco. A prova cobre opções de Partner, Full e Build Completo e ocupação do Build Essencial. | Homologar demais modalidades no CALI MAPA. Propostas, Forms, Mapa, equipe CALI e ciclo de dados mantêm os gates próprios. |

No preflight hospedado em leitura, `notice_comments` tinha RLS ativo e duas políticas de leitura aplicáveis. A chave única de capacidade por empresa e mês e a rotina legada de resultado da Agenda estavam presentes. Não havia reunião sintética passada e confirmada em A/B.

Este lote tem validação local. A DEC-28 revisada dispensa backup e restauração para os lotes autorizados no staging. A instalação exige preflight e rollback por recorte. Para a moderação, a reversão operacional retira a RPC de escrita e mantém a leitura filtrada e a policy restritiva. Remover o filtro sem restaurar os comentários tornaria visíveis textos já ocultados. O rollback de Agenda preserva os resultados registrados. A retirada de `v2_set_pilot_capacity_pause` desativa o controle de Horas e mantém a decisão mensal gravada. As projeções de Projetos, Relatórios e Frentes são aditivas e compatíveis com as respostas anteriores.

## Contagens das fontes no staging

Foi atualizada somente a definição de `v2_read_pilot_report_catalog`, preservando permissões e operações de escrita. No navegador, o Admin abriu **Fontes do relatório** no rascunho sintético `CALI-RPT-2026-000012` de 01/10/2026. Projetos, tarefas criadas, tarefas concluídas, eventos, documentos e comentários mostraram zero, conforme o retrato do período. Campo ausente continua distinto de zero. A prova em PostgreSQL descartável também cobre a ausência da projeção no Cliente e o uso do retrato congelado após aprovação. Não houve nova publicação ou alteração de PDF. Para reverter, restaurar somente a definição anterior do leitor, guardada no preflight.

## Reposição de reunião ordinária

Na V2, Admin com MFA oferece reposição para reunião contratual marcada como não realizada, quando a regra de resultado permite reposição. O horário é informado em Brasília. A operação mantém duração e condições contratuais, recusa conflito e registra a oferta no pedido existente. Cliente confirma pelo fluxo de Agenda. Na confirmação, o servidor confere se a sessão contratual já está reservada no mês de destino. O novo evento é separado e o anterior permanece no calendário e no histórico como não realizado. O motivo interno fica restrito.

O PostgreSQL descartável comprovou empresa divergente, horário passado, reenvio do mesmo pedido, duração preservada, confirmação do Cliente, recusa por sessão já reservada e histórico preservado.

### Resultado, reposição e capacidade no staging

O CALI MAPA recebeu as operações de resultado, reposição e pausa mensal, além dos campos que exibem as ações disponíveis. As duas reuniões passadas da Empresa A foram inscritas na guarda de e-mail. Pelo navegador, o Admin registrou uma reunião realizada e outra não realizada com falta justificada. O Cliente A viu o resultado sem a justificativa interna e confirmou a reposição de uma hora. O banco confirmou dois eventos distintos para a reposição e preservou o resultado da reunião original.

A primeira oferta sem cobertura terminou em timeout. A RPC passou a tratar a falta de cobertura como erro de validação. O navegador confirmou a mensagem antes de a fixture receber uma sessão mensal temporária para o teste válido. Ao encerrar a prova, a sessão mensal voltou a zero e o evento futuro sintético foi cancelado antes da sincronização externa. O banco confirmou zero notificações destinadas a e-mail nas duas reuniões e nenhum vínculo com o Google.

Em Horas, a franquia de novembro da Empresa A foi reduzida de 12,5 h para 0,25 h durante o teste, usando os 27 minutos sintéticos já registrados. O Admin pausou e retomou as atividades pelo navegador. O banco confirmou os dois eventos de auditoria, a retomada e a restauração de 12,5 h.

A reversão específica restaura as três definições capturadas antes do lote e retira as cinco rotinas novas, incluindo o auxiliar privado, sem apagar histórico. O SQL de reversão está em `output/runtime/phase4b/rollback.sql` no workspace de operação. A guarda de e-mail permanece para as fixtures inscritas.

### Ata em texto e aceite de orçamento online

O Admin com MFA salva a ata de uma reunião ordinária já realizada. A operação usa o campo textual do resultado existente e mantém a data, autoria, justificativa e anexos do resultado. O Cliente da empresa lê a ata em reunião visível e ativa. A versão do texto impede sobrescrita por formulário desatualizado, e a auditoria registra a ação sem copiar o texto.

O solicitante pode aceitar um orçamento online pendente na lista de encontros adicionais. O servidor confere a versão do valor e das condições, usa a rotina legada para registrar o aceite e preserva o preço e o instante do primeiro aceite em repetição. Aceitar o orçamento não confirma um horário.

No CALI MAPA, Admin salvou a ata da reunião sintética realizada da Empresa A e o Cliente leu a mesma ata sem controle de edição. O Cliente aceitou o orçamento sintético de R$ 250,00. O banco confirmou um evento de auditoria por ação, zero notificações destinadas a e-mail e nenhuma criação de reunião a partir do orçamento. O pedido de teste foi encerrado com preço e aceite preservados. O PostgreSQL descartável confirmou recusa de versão antiga, isolamento e repetição.

A reversão do lote restaura os leitores anteriores e retira as duas ações. A captura está em `output/runtime/phase4b/followup-rollback.sql`. Ata e aceite permanecem no histórico.

### Materiais da ata, convidados locais e encontros adicionais

Em reunião ordinária realizada, o Admin publica ou retira um link HTTPS e um PDF de até 2 MiB. O Cliente consulta os materiais das reuniões visíveis da própria empresa. O PDF exige sessão, é entregue sem cache e tem o digest conferido pelo navegador. Uma retirada invalida a versão anterior para download e mantém o histórico privado. O Workspace abre links por ação do usuário. A autorização no destino externo depende do serviço que hospeda o link.

O Admin adiciona convidados externos e retira convidados externos com resposta pendente em reunião futura local. Participantes vinculados e reuniões sincronizadas preservam o fluxo existente. O Cliente vê nome, papel e resposta, sem e-mail. A operação local registra a mudança sem disparar convite externo.

Pedidos adicionais inscritos no piloto exibem decisões conforme papel, versão e estado. Admin pode oferecer ou recusar horário, confirmar visita e registrar decisão de taxa. Cliente solicitante pode confirmar horário, contrapropor, cancelar ou reagendar visita conforme as regras legadas. A visita oferece duas opções de quatro horas. O online exige orçamento aceito e horário fora da cobertura ordinária antes da confirmação. O preço registrado permanece no pedido e as reuniões do piloto ficam locais.

No CALI MAPA, o Cliente A viu o link, baixou o PDF e consultou o convidado sem e-mail. Admin retirou o convidado e os materiais. A visita sintética de R$ 800,00 passou por oferta, confirmação, cancelamento e isenção. A primeira oferta de visita foi recusada pelo legado por trazer um único horário. A operação passou a encaminhar as duas opções do pedido e funcionou no navegador. Uma segunda visita comprovou contraproposta, confirmação direta pela CALI e reagendamento, com o evento anterior cancelado. O online sintético passou por oferta, aceite de R$ 250,00 e confirmação como adicional. Os eventos de teste foram encerrados. O banco confirmou zero notificações destinadas a e-mail ou vínculos com o Google nessas fixtures. O lote seguinte comprovou a abertura de novos pedidos, a edição de orçamento, o registro de despesas, a taxa aplicada e a recusa.

O rollback em `output/runtime/phase4b/materials-guests-extras-rollback.sql` restaura os leitores e retira as novas funções, preservando os dados. Google Calendar/Meet ficou para [revisão pré-rollout](../flows/CALENDAR.md#revisão-pré-rollout). A conexão Google encontrada é global e não tem vínculo com as empresas sintéticas.

## Equipe CALI por empresa

`/admin/equipe-cali` consulta a equipe atribuída à empresa piloto selecionada. O servidor exige Admin com MFA, pagina a resposta e retorna nome, situação, convite, módulos e data de atribuição. A consulta omite e-mails e identidade do Auth. O PostgreSQL descartável comprovou a fronteira de empresa e a recusa para Cliente e Admin sem MFA.

Em 07/11/2026, a consulta foi instalada no CALI MAPA. No navegador, o Admin viu uma atribuição sintética inativa em A e lista vazia em B. O catálogo grava data de convite ao cadastrar um membro. A interface indica convite registrado, pois a data sozinha não comprova envio. A atribuição de teste foi removida após a consulta. Cadastro, atribuição, convite, revogação e decisão de submissões pela V2 continuam em recortes próprios.

## Acervo legado de entregáveis

O CALI MAPA tem três arquivos inventariados fora das empresas A/B: um PDF publicado, um PDF arquivado e um DOCX arquivado. Todos têm até 2 MiB e têm objeto correspondente no Storage. Felipe aprovou ensaiar com conteúdo sintético e mover o acervo inventariado na janela de rollout. Nenhum arquivo real foi lido ou transferido.

O [SQL de preparação](../../supabase/proposals/phase-4/prepare-legacy-delivery-files.sql) confere empresa, projeto, entregável, tamanho, SHA-256 e visibilidade da origem. Registra os bytes e uma cópia privada dos metadados legados, incluindo cadeia de revisão, autoria e versão. O PDF publicado recebe uma revisão inicial na V2 com vínculo ao entregável. O PDF e o DOCX arquivados ficam somente no registro privado, fora das rotas de download. A operação é restrita ao operador do banco, reaplica a mesma cópia sem duplicar e recusa divergência da origem.

O [ensaio local](../../supabase/proposals/phase-4/test-legacy-delivery-files.sql) confirmou hash, cadeia de revisão, rejeição de origem alterada, download do PDF vigente por A e recusa dos arquivados e do download cruzado por B. No CALI MAPA, a cópia de três cargas sintéticas em A passou em uma transação revertida. A conferência após o rollback confirmou ausência da tabela de preparação e da fixture. A prova hospedada usou bytes de teste para o contrato SQL, sem upload, leitura do Storage ou download pelo navegador.

Na janela de rollout, o operador deve conferir a cadeia e o SHA-256 de cada objeto original no bucket privado, preparar os três itens e homologar acesso, histórico e paridade visual antes do corte. A preparação mantém os registros e objetos legados intactos. A troca definitiva ainda exige reconciliar os leitores legados, retirar a publicação anterior e liberar reabertura apenas dos itens com migração confirmada. Até lá, manter o bloqueio de reabertura de itens com arquivos legados. O rollback do ensaio é transacional. Antes do corte definitivo, revisar um rollback que preserve revisões novas e evite restaurar dados sobre alterações posteriores.

O estado da instalação e da prova autenticada de Propostas fica no [contrato do rascunho](#rascunho-e-aprovação-interna-de-propostas).

### Abertura de extras, revisão de orçamento e despesas

A V2 abre visita adicional com duas opções de quatro horas em Brasília e ciência de R$ 800,00. Para online, duas opções com a mesma duração, ciência do valor fixo de R$ 200,00 por 1 hora ou R$ 300,00 por 1h30 e aceite registrado no pedido. Admin com MFA pode editar orçamento ainda pendente de aceite, com versão do pedido e auditoria. A despesa é registrada por linha após a realização da visita. Horas extras exigem quantidade e referência ao orçamento aprovado. A tela do piloto registra protocolo e observação. O lote seguinte integrou os comprovantes à lista de despesas.

As três RPCs exigem sessão e papel do piloto, inscrição sintética, e recibo idempotente. Notificações das fixtures permanecem no app. O registro de despesa ou taxa no piloto não executa cobrança. Google Calendar/Meet segue para a revisão pré-rollout.

Em 08/11/2026, o lote foi instalado no CALI MAPA. No navegador integrado, Cliente A abriu online de R$ 200,00 e visita de R$ 800,00. Admin recusou o online. Em um pedido legado sintético, Admin alterou R$ 250,00 para R$ 275,50, Cliente aceitou a revisão e Admin encerrou o pedido. Em uma visita sintética já realizada, Admin registrou estacionamento de R$ 18,75 com protocolo. Em outra visita, Admin confirmou o horário, Cliente cancelou e Admin registrou a taxa de R$ 160,00. A visão Admin de B ficou vazia. O banco confirmou os valores, estados, evento cancelado, notificações sem e-mail e cron do resumo desligado. Os dois eventos das fixtures ficaram locais.

A primeira confirmação encontrou um evento cancelado no mesmo horário. A rotina legada verificava colisão sem excluir cancelados. A prova desse lote prosseguiu em horário livre, com a visita realizada preparada como fixture. O lote seguinte corrigiu o conflito e integrou o registro de realização. O rollback específico em `output/runtime/phase4b/extra-intake-rollback.sql` restaura a projeção anterior, retira as três RPCs e preserva histórico.

### Conclusão da visita extra e comprovantes no CALI MAPA

Admin com MFA registra a realização de uma visita presencial do piloto após o fim do evento, com vínculo ao pedido confirmado. Evento cancelado, visita futura ou alteração pendente impedem o registro. A agenda usa o resultado existente e libera a despesa apenas depois da realização. Admin consulta os protocolos e pode anexar um PDF de até 2 MiB por despesa, inclusive em despesa já registrada. O comprovante do piloto fica em armazenamento privado do Workspace, com conferência de empresa, auditoria de anexo e hash no download. Uma vez salvo, o PDF permanece associado à despesa. Os comprovantes legados em Storage seguem fora deste recorte.

A correção em `fix-cancelled-extra-visit-conflict.sql` exclui eventos cancelados da busca de colisão das duas confirmações legadas. A instalação confere a cláusula existente antes de alterá-la. Colisões com eventos ativos continuam bloqueadas. No CALI MAPA, Admin e Cliente A confirmaram pelo navegador usando horários antes bloqueados por eventos cancelados. Admin tentou primeiro um horário com evento ativo e recebeu a recusa esperada. As visitas futuras do teste foram canceladas após a prova.

Em uma visita sintética com horário passado e ainda sem resultado, Admin registrou a realização pelo navegador, lançou estacionamento de R$ 19,42 e anexou o PDF ao protocolo gerado. O download teve o mesmo SHA-256 do original e a lista persistiu após recarga. Cliente A viu a visita realizada sem dados de despesas, e a consulta Admin de B ficou vazia. O PostgreSQL descartável também verificou repetição do registro e anexo, recusa de substituição do PDF e bloqueio de leitura por Cliente ou outra empresa. Banco confirmou eventos locais, zero e-mails e cron do resumo desligado. Google Calendar/Meet segue para a revisão pré-rollout.

Para instalar sobre a base do piloto, aplicar `agenda-extra-expense-receipts.sql` antes de atualizar a projeção em `agenda-extras-read.sql`. A realização estende `phase4_record_appointment_outcome` em `agenda-change-operations.sql`. No CALI MAPA, o rollback específico em `output/runtime/phase4b/extra-visit-completion-rollback.sql` restaura as quatro definições anteriores e retira as RPCs de comprovantes, preservando arquivos e histórico.

## Prazo de revisão vencido no CALI MAPA

Em 08/11, a consulta de Projetos passou a retornar o indicador de atraso para revisão pendente. No navegador, Cliente A viu o prazo vencido e enviou um pedido de ajuste. A consulta Admin de B não exibiu o projeto de A. O banco confirmou a transição para ajuste solicitado, com zero marcações de e-mail. O projeto sintético foi retirado da visão do Cliente com o histórico preservado. A reversão específica em `output/runtime/phase4a/overdue-review-rollback.sql` restaura apenas a consulta anterior.

## Capas privadas no mural

Admin pode anexar, trocar ou remover uma capa PNG ou JPEG de até 1 MiB em aviso publicado dirigido a uma única empresa piloto. O mural retorna a versão atual, e a leitura dos bytes exige sessão, empresa e acesso ao aviso. As versões anteriores ficam privadas, com histórico de autoria e sem acesso pelo leitor de capas. O acervo de capas do Storage legado segue em seu fluxo próprio.

No CALI MAPA, Admin publicou um aviso sintético em A e anexou um PNG. Cliente A carregou a imagem, a consulta de B ficou sem o aviso e a retirada da capa refletiu em A após recarga. Admin arquivou o aviso. O PostgreSQL descartável verificou reexecução, recusa de versão obsoleta, recusa de edição pelo Cliente, fronteira de empresa e bloqueio de versão retirada. O rollback em `output/runtime/phase4c/notice-cover-rollback.sql` restaura a projeção e retira as duas RPCs, preservando o histórico.

## Contagens visíveis ao Cliente na tela e no PDF

Decisão de 08/11. O relatório inclui contagens de projetos, tarefas, eventos, documentos publicados e comentários de entregáveis que a empresa já pode consultar. A aprovação congela as contagens para a revisão. O cálculo usa datas de Brasília e exclui rascunhos de projeto, entregáveis cancelados ou privados, tarefas e comentários internos, eventos cancelados e documentos arquivados. O catálogo Admin mantém seus agregados operacionais. Revisões já aprovadas conservam seu retrato original.

No CALI MAPA, a revisão 4 de `CALI-RPT-2026-000012` contou um evento de outubro visível ao Cliente e excluiu o evento interno. O Cliente A viu os seis valores na tela e no PDF `CALI-EXEC-2026-000003`, cujo hash conferiu com o banco. B ficou sem o relatório. A revisão foi retirada, as fixtures de agenda foram canceladas e a função temporária de PDF com JWT obrigatório foi removida. A suíte PostgreSQL verificou fronteira do mês, visibilidade, isolamento e congelamento. O rollback específico em `output/runtime/phase4d/client-counts-rollback.sql` restaura o leitor anterior e retira o congelamento para aprovações futuras, preservando revisões e PDFs.

## Coleta pública de texto na V2

A rota `/f/$slug` atende formulários de texto criados pela V2 e abertos explicitamente para link público em empresa piloto. A projeção retorna perguntas, título e descrição quando aberto. Ao encerrar, devolve só o estado. O envio reaproveita a persistência legada, valida os campos de texto no servidor, usa um recibo por tentativa e serializa com o fechamento. A coleta fica disponível por link para visitantes, e a configuração exige confirmação por e-mail desativada. Anexos e perguntas condicionais seguem em recortes próprios. A exportação de texto encerrado tem prova abaixo.

No CALI MAPA, o Admin abriu a coleta sintética de A após confirmação explícita. A primeira abertura não exibiu o link porque as RPCs públicas estavam ausentes no catálogo efetivo. O Admin encerrou a coleta com zero respostas. Após aplicar `forms-public-collection.sql` e verificar os GRANTs, o Admin reabriu a mesma fixture e o navegador sem login carregou as duas perguntas, enviou uma resposta fictícia e mostrou a confirmação. O Admin encerrou a coleta e viu uma resposta. Após recarregar, a rota pública mostrou coleta encerrada. O banco confirmou um recibo, uma resposta, zero marcações de e-mail e zero coletas de teste abertas.

O PostgreSQL descartável verificou leitura anônima, rejeição de campo desconhecido, reexecução e recusa de nova resposta após o encerramento. O rollback em `output/runtime/phase4e/forms-public-rollback.sql` retira as duas RPCs V2 e restaura a listagem Admin, preservando as respostas e o histórico.
## Exportação Excel de Forms

Admin com MFA pode exportar uma coleta V2 de texto encerrada da empresa piloto. A planilha mantém a ordem das perguntas e registra data em Brasília, etapa, responsável e respostas textuais. Cada célula é texto, inclusive entradas que começam com sinal de fórmula. A exportação omite contatos, notas internas e anexos. O servidor limita a operação a 500 respostas e 2 MiB e recusa excedentes sem entregar arquivo parcial. O download fica no navegador e a Auditoria registra a preparação, com quantidade e sem conteúdo das respostas.

A publicação 83 exporta XLSX e pode incluir contato, nota e links temporários de arquivos. O piloto V2 preserva o formato. Os campos e anexos da coleta legada aguardam contrato de acesso e guarda próprios.

No CALI MAPA, Admin baixou o XLSX da coleta de A com uma resposta fictícia. A estrutura do arquivo, as cinco colunas e o valor de teste foram conferidos. B ficou sem o formulário. O banco confirmou um evento de auditoria, coleta encerrada e zero marcações de e-mail. A suíte descartável negou exportação em coleta aberta, outra empresa, Cliente, anônimo e Admin sem MFA. O teste do XLSX confirma escape XML e células sem fórmula. [Rollback](../../supabase/proposals/phase-4/rollback-forms-export.sql) desliga a exportação e conserva respostas e auditoria.

## Triagem do Mapa de People

O Admin com MFA consulta registros sintéticos explicitamente vinculados por empresa, operador e prazo em `/admin/mapa-people`. A V2 mostra protocolo, data, situação e parecer, sem devolver contato ou diagnóstico. A triagem aceita Novo, Em andamento e Cancelado e preserva outros campos de observações. Registros de envio e exclusão não são editáveis por este fluxo. A escrita usa revisão concorrente e grava autoria e situação, sem copiar o parecer para o log. Nenhuma RPC legada ganhou destinatários ou escopo.

No PostgreSQL descartável, o operador listou e salvou parecer, a repetição idêntica não duplicou evento e uma revisão obsoleta foi recusada. B, Cliente, Admin sem MFA, inscrição expirada e protocolo fora do piloto não tiveram acesso. No CALI MAPA, a rota autenticada abriu em A/B sem expor registros legados. A escrita no navegador permanece pendente. O staging não tinha fixture compatível e o gatilho legado de INSERT chama transporte externo sem exceção de teste. Jornada, relatório e transporte permanecem separados. O [rollback](../../supabase/proposals/phase-4/rollback-mapa-operations.sql) desliga as RPCs e preserva registros e histórico.

## Rascunhos administrativos da Equipe CALI

Admin com MFA cadastra rascunho inativo, escolhe os módulos da referência, edita nome e módulos e retira o vínculo com a empresa piloto. A criação e a atribuição são atômicas. A escrita exige revisão atual e usa recibo idempotente. A edição e retirada se limitam a rascunhos sintéticos sem conta ou convite, vinculados exclusivamente à empresa selecionada. A remoção conserva o registro inativo e os eventos de auditoria. A gestão de acesso Partner continua separada.

No navegador do CALI MAPA, Admin criou em A, conferiu lista vazia em B, editou nome e módulos e retirou o vínculo. O banco confirmou três eventos, zero vínculos restantes, rascunho inativo, sem conta e sem convite. A suíte SQL recusou escrita cruzada e revisão obsoleta. O [rollback](../../supabase/proposals/phase-4/rollback-staff-roster-write.sql) desliga a escrita e conserva a leitura e a trilha.

## Tipos numérico e data em Forms

O editor e a coleta V2 suportam número e data além das perguntas de texto. O servidor diferencia zero de campo ausente, exige JSON numérico para número, valida data no calendário e preserva os valores na exportação Excel como células de texto. As regras de obrigatoriedade, coleta encerrada, empresa e idempotência continuam aplicáveis. Os controles públicos aparecem apenas em formulário V2 explicitamente aberto.

No CALI MAPA, uma fixture transacional aceitou zero e 29/02/2028, recusou 29/02/2026 e persistiu uma única resposta após repetição. O rollback da fixture ocorreu antes do commit das funções. A coleta não ficou publicada e nenhum e-mail foi enviado. A suíte descartável verificou também data obrigatória ausente, número enviado como texto e exportação de ambos. As definições anteriores foram guardadas em `output/runtime/phase4e/forms-types-rollback.sql`. Antes de voltar às definições anteriores, fechar coletas com os novos tipos para preservar o histórico de respostas.

## Alternativas em Forms

O editor e a coleta V2 aceitam escolha única, múltipla e Sim/Não. A definição de alternativas exige textos distintos; a coleta valida as opções, a obrigatoriedade e a ausência de seleções repetidas. A exportação mantém a ordem das perguntas e apresenta as seleções de uma pergunta na mesma célula de texto.

No CALI MAPA, a transação recusou uma opção fora da lista e uma seleção duplicada, aceitou as três respostas válidas e preservou uma submissão na repetição. A fixture foi revertida antes do commit das funções, sem coleta aberta nem e-mail. A suíte descartável comprovou também as colunas no Excel. As definições anteriores estão em `output/runtime/phase4e/forms-choices-rollback.sql`. Fechar coletas com alternativas antes da reversão. Lógica condicional, anexos e outros tipos legados continuam separados.

## Calculadora do portfólio no CALI MAPA

Os [contratos de preço do piloto](../../supabase/proposals/phase-4/commercial-pricing.sql) cobrem 15 combinações de pacote e serviço além de CALI Build. A referência de cálculo foi [o Portal Comercial na revisão bd2e965](https://github.com/patricia258/cali-portal/blob/bd2e965e9dcc0bc2d8163d62422b03cdd2cb3128/js/services.js). As fórmulas preservam a distinção entre mensal e avulso, faixas, tetos, desconto, materiais e duração mínima. A operação continua limitada ao rascunho, pacote e operador delegados. A prova não libera catálogo, aprovação ou envio.

Os 15 resultados da suíte descartável coincidiram com a execução das fórmulas do Portal. No navegador do CALI MAPA, Admin calculou a proposta sintética de Palestra com cinco participantes, materiais, R$ 75 de adicionais e 5% de desconto. A tela e o banco confirmaram subtotal de R$ 2.100 e total de R$ 1.995; a delegação foi encerrada e o rascunho ficou sem envio. As definições anteriores estão em `output/runtime/phase4e/commercial-portfolio-rollback.sql`. Ativação comercial e parâmetros de priorização ou substituição manual de preço ainda exigem recorte próprio.

## Resumo do diagnóstico do Mapa de People

Admin pode abrir o resumo de uma resposta sintética vinculada a seu operador e empresa. A [consulta](../../supabase/proposals/phase-4/mapa-report-read.sql) aplica MFA e validade da delegação. O retorno contém notas e versão do cálculo, sem contato ou respostas brutas. A referência foi [o relatório do Mapa na revisão 134f17c](https://github.com/patricia258/mapa-de-people/blob/134f17cabada7cc0a220d93b30a2c93651aadb25/relatorio.html): notas de 0 a 10 e pesos de 25%, 30%, 20% e 25%. O resumo não apresenta nota quando faltam dimensões ou subcamadas exigidas.

O PostgreSQL descartável conferiu resultados do diagnóstico legado e da versão 2, ausência de diagnóstico, isolamento A/B, delegação vencida, outro Admin, Cliente, anônimo e Admin sem MFA. O CALI MAPA recebeu a consulta; catálogo e verificação transacional confirmaram a projeção, as permissões e o cálculo auxiliar. Não havia resposta delegada. Nenhuma resposta foi inserida, porque o gatilho legado envia uma notificação externa. Jornada, relatório completo, PDF e prova com resposta delegada no staging seguem pendentes. [Rollback da consulta](../../supabase/proposals/phase-4/rollback-mapa-report-read.sql).

## Compatibilidade da abertura de Forms

A abertura V2 e o leitor público usam a mesma validação de audiência, origem do rascunho e perguntas suportadas. Um formulário legado, vazio, com pergunta incompatível ou identificador repetido não pode ser aberto pela V2. Um formulário legado aberto continua podendo ser encerrado. A lista Admin mostra a abertura apenas para coletas aptas, e a confirmação explícita continua obrigatória. Os leitores e a submissão legados não foram alterados.

No CALI MAPA, Admin viu a abertura disponível no Forms sintético de A já homologado; a coleta legada de triagem permaneceu fechada e sem ação de abrir. O catálogo confirmou zero coletas abertas no piloto. A cópia descartável comprovou a recusa do formulário incompatível e a abertura/encerramento do rascunho apto. A reversão das três definições está em `output/runtime/phase4e/forms-opening-rollback.sql`; reverte esta guarda antes da reversão das alternativas.

## Caminhos condicionais e PDF de resposta em Forms

No rascunho, Admin define destinos por opção de escolha única ou Sim/Não. A opção pode seguir para a próxima pergunta, saltar para uma pergunta posterior ou encerrar. O banco rejeita destinos inválidos e recalcula o caminho a cada envio. A gravação também confere o caminho quando a coleta condicional da V2 recebe uma chamada pela interface legada.

A coleta aceita uma pergunta de anexo PDF, com até 2 MiB por resposta. O arquivo fica em tabela privada, com gravação atômica junto da resposta e recibo. A planilha registra apenas a presença do PDF. Admin com MFA pode baixar o anexo pela triagem da empresa. O download confere integridade e registra a operação. Outros formatos e anexos de coletas legadas exigem outro contrato.

A suíte isolada comprovou salto, encerramento, bloqueio de respostas fora do caminho, obrigatoriedade, reenvio, tentativa legada com referência a PDF inexistente e download negado a Cliente e outra empresa. No CALI MAPA, as coletas sintéticas, duas respostas condicionais e um anexo foram revertidos antes do commit das funções. O banco confirmou zero PDFs retidos no ensaio. O rollback exato está em `output/runtime/phase4e/forms-branch-pdf-rollback.sql` e recusa execução se já houver PDFs coletados.

Em 08/11, o formulário sintético de A `teste-v2-qa-condicional-pdf-0811` passou no navegador do CALI MAPA. O caminho “Não” registrou uma resposta sem anexo. O caminho “Sim” registrou a segunda resposta com PDF. O download pela triagem Admin retornou um arquivo idêntico ao original, byte a byte. O teste encontrou exibição antecipada do campo de PDF antes de responder à pergunta condicional obrigatória. A interface passou a aguardar a escolha, com as três situações verificadas no navegador. A coleta terminou fechada com duas respostas sintéticas e um PDF privado. Nenhuma configuração de envio foi alterada. A reversão de UI é independente do contrato de banco e preserva o anexo registrado.

## Campos de contato no Forms V2

O editor piloto oferece Nome, E-mail e Telefone / WhatsApp conforme os tipos da [publicação 83](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/forms/formModel.ts). A página pública informa quem pode consultar esses dados. A abertura mantém a confirmação explícita de que qualquer pessoa com o link pode responder e exige que a confirmação por e-mail esteja desativada.

A coleta confere os formatos também no servidor, incluindo o caminho pelo endpoint legado quando a pergunta pertence a um Forms V2 elegível. Quando há PDF, a mesma gravação registra o nome e o e-mail das primeiras perguntas de contato respondidas no caminho. O e-mail fica em minúsculas. As três respostas seguem como texto nas colunas correspondentes do Excel. A triagem e a exportação continuam restritas a Admin com MFA e à empresa selecionada.

A prova em PostgreSQL descartável cobriu publicação, formatos inválidos, o caminho legado, o caminho com PDF e a exportação. Em 08/11, as cinco definições do lote de contato foram instaladas no CALI MAPA. No navegador, Admin criou e abriu a coleta sintética da Empresa A. A conferência confirmou os tipos `name`, `email` e `phone` no rascunho antes da abertura. Uma resposta foi registrada; nome, e-mail em minúsculas e telefone conferiram no banco e no Excel baixado. A coleta ficou fechada, com confirmação por e-mail desativada e zero envios. Um rascunho anterior usava resposta curta no lugar de e-mail e ficou fechado; não foi usado como prova. Em eventual rollback, encerrar primeiro as coletas que usam os novos tipos e restaurar as definições anteriores de edição, elegibilidade, validação e submissão, preservando as respostas.

## Escala e bloco de texto no Forms V2

O editor permite criar e editar uma escala de inteiros entre 0 e 10, com mínimo menor que máximo e rótulos opcionais nos extremos. O padrão é 0 a 10. A coleta pública grava o valor como número e o Excel mantém a nota na coluna da pergunta. O bloco de texto exibe instruções na posição do fluxo, sem campo de resposta nem coluna na planilha. A publicação exige pelo menos uma pergunta que aceite resposta.

O PostgreSQL descartável valida edição, limites, rejeição de nota fracionária ou enviada como texto, bloqueio de resposta para o bloco e persistência e exportação da nota zero. Os contratos de rascunho, coleta e exportação são um lote só; aplicar nessa ordem. Instalação e prova pelo navegador do CALI MAPA seguem pendentes para esses dois tipos. Para reverter, encerrar primeiro as coletas que os usam e restaurar as funções anteriores de edição, coleta, guarda e exportação, preservando as respostas.

## Ativação sintética da Equipe CALI

Admin com MFA alterna a situação de membros fictícios com módulos e vínculo exclusivo à empresa selecionada. A operação usa revisão e recibo. Exige endereço reservado, ausência de conta, autor de convite e aceite. O catálogo hospedado preenche a data de convite no cadastro inicial, por isso a data isolada não determina elegibilidade.

No navegador do CALI MAPA, o membro fictício de A foi criado, ativado e devolvido a inativo. A suíte isolada cobriu recusa entre empresas, reenvio e revisão antiga. O rollback exato em `output/runtime/phase4e/staff-activation-rollback.sql` retira a operação e restaura a projeção anterior. Convite, autenticação e revogação de uma pessoa da Equipe seguem com aceite próprio.

## Exportação estruturada e prévia de eliminação

A exportação reaproveita os dados estruturados e o registro de destinatário do contrato legado. Preserva o bloco separado de dados restritos e acrescenta perguntas e respostas estruturadas de Forms. Os bytes de anexos ficam fora do JSON. Admin com MFA confirma o destinatário autorizado e baixa o arquivo na interface, com limite de 8 MiB e resposta privada.

A prévia de eliminação aplica a elegibilidade vigente e exibe contagens do Storage legado, Forms e PDFs V2. As duas consultas foram instaladas no CALI MAPA, com verificação de permissões. A suíte isolada cobriu o retorno estruturado e a elegibilidade. Em 08/11, Admin com MFA baixou o JSON no navegador para uma empresa descartável sem usuários. Uma cópia local isolada incluiu somente essa empresa adicional no seletor. O JSON continha o rascunho esperado, separava dados restritos e não continha os IDs de A/B. Após simular 46 dias de encerramento na fixture, a prévia mostrou zero objetos legados, um formulário e zero PDFs de Forms. Empresa, inscrição e rascunho foram removidos, com a auditoria preservada. A execução do fluxo de eliminação permanece pendente. Falta reconciliar as superfícies V2, arquivos externos e a retomada após falha parcial antes de habilitar a exclusão. [Rollback](../../supabase/proposals/phase-4/rollback-data-lifecycle-export.sql).

### Inventário ampliado de arquivos para eliminação

A prévia inclui revisões de documentos, anexos de ocorrências, PDFs de relatórios, PDFs de encontros, comprovantes de despesas, PDFs de propostas vinculadas e capas com bytes de avisos exclusivos da empresa. A contagem abrange versões históricas. Capas de avisos gerais ou com mais de um destinatário empresarial ficam fora da contagem. Se a versão anterior da RPC estiver instalada, a interface indica que o inventário ampliado está indisponível.

O PostgreSQL descartável confirmou contagens distintas para A/B e exclusão de capas compartilhadas e gerais. No CALI MAPA, a consulta foi atualizada mantendo os GRANTs. Admin viu as sete categorias na prévia da empresa descartável, que não possuía esses arquivos. A fixture foi removida após o ensaio. Para reverter apenas esta ampliação, reaplicar a definição capturada em `output/runtime/phase4e/privacy-inventory-rollback.sql`. Permanecem pendentes o inventário dos sistemas externos e a execução retomável da eliminação.

## Jornada e relatório detalhado do Mapa

A jornada consulta sessões sintéticas delegadas explicitamente à empresa e ao operador. O Admin vê etapa, horários, dispositivo, origem, cópias e situação. O estado Abandonou usa o limite de 15 minutos da publicação 83. A projeção pagina e não entrega a chave da sessão original.

No navegador do CALI MAPA, a sessão sintética apareceu em A na etapa 3 de 7, com um evento de cópia, e não apareceu em B. A suíte isolada também cobriu o escopo e a paginação por empresa. A delegação e os quatro eventos de homologação foram removidos após a conferência.

O relatório inclui síntese, notas, observações por dimensão, parecer e serviço recomendado. Tela e PDF usam a mesma composição de conteúdo. O download revalida o acesso ao relatório. A consulta detalhada foi instalada no CALI MAPA. O PDF de uma resposta fictícia foi gerado, reaberto e renderizado em três páginas no ambiente local. Em 08/11, Admin abriu a resposta fictícia delegada à empresa A no staging e baixou o PDF A4 de uma página. A nota 6,7/10, as dimensões e a recomendação conferiram com a tela. A empresa B não exibiu a resposta. A inserção de teste não disparou o e-mail legado. O gatilho foi restaurado dentro da mesma transação e a resposta e a delegação foram removidas após a prova. A comparação visual com a referência segue pendente. A implementação para o simulador da devolutiva está descrita abaixo. A reversão do lote está em `output/runtime/phase4e/mapa-journey-report-rollback.sql`.

### Devolutiva sintética do Mapa

A interface Admin em desenvolvimento apresenta a confirmação do diagnóstico se `VITE_CALI_PHASE4_MAPA_EMAIL=true`. A [Edge](../../supabase/functions/workspace-mapa-email-pilot/index.ts) usa a sessão do Admin na preparação do envio. A [RPC](../../supabase/proposals/phase-4/mapa-email.sql) exige MFA, empresa piloto, delegação vigente, registro sintético elegível e igualdade com a revisão conferida. O PDF é gerado pelo mesmo código do download a partir da projeção autorizada pelo banco. O único destino da Edge é `delivered@resend.dev`. Não há campo de destinatário nem anexo fornecido pelo navegador.

Uma revisão tem uma única reserva. Se houver falha depois da aceitação, repetir dentro de dez minutos reutiliza a mesma chave e o mesmo PDF. Depois disso, um envio sem recibo exige conferência operacional. O recibo registra aceite do simulador e autoria na auditoria, sem marcar a resposta legada como enviada. O ensaio em PostgreSQL descartável cobriu a revisão alterada, a empresa incorreta, a janela de repetição e o registro idempotente. O teste da Edge usou um transporte substituto e conferiu destino, anexo, repetição após falha de gravação e ausência de despacho quando a autorização falha.

Em 08/11, Admin com MFA confirmou a devolutiva do diagnóstico fictício `CALI-QA-V2-MAPA-EMAIL-0811` no navegador. A Edge temporária, com JWT obrigatório, enviou um único PDF a `delivered@resend.dev`. A interface mostrou a aceitação do simulador e o banco registrou uma reserva, um recibo e um evento de auditoria. O estado e a data de envio da resposta legada ficaram intactos.

Após a prova, a Edge, sua flag temporária, as RPCs, a resposta fictícia e sua delegação foram retiradas. O gatilho legado voltou ao estado inicial e a trilha do ensaio foi preservada conforme o [rollback SQL](../../supabase/proposals/phase-4/rollback-mapa-email.sql). A homologação cobre a aceitação pelo simulador. O envio para destinatários reais segue pendente.
