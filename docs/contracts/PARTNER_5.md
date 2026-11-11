# Partner interno — fase 5

O piloto usa o vínculo da Equipe CALI para dar acesso por empresa e módulo. O papel interno segue a [interface Partner da publicação 83](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/staff/StaffWorkspace.tsx), os [termos vigentes](ACCESS_COMPANIES.md) e a [ficha FLOW-15](../flows/ADMIN_LIFECYCLE.md).

A publicação 83 documenta o papel e as operações de origem. Para o visual vigente, ver a [revisão contra a main da V2](../HOMOLOGACAO_PATRICIA.md#revisão-visual-contra-a-main-da-v2), que não tem uma tela Partner conectada equivalente.

## Matriz de trabalho

| Recorte | Regra reconciliada | Situação |
| --- | --- | --- |
| Admissão | Identidade confirmada, convite individual, sessão viva, TOTP verificado, AAL2 e aceite da versão vigente. Revisão do vínculo, desativação ou revogação retiram acesso. | Candidata instalada. E-mail, código, MFA, convite, aceite e corte da mesma sessão homologados no navegador integrado com identidade descartável. |
| Projetos | Empresa e módulo atribuídos. Listagem de projetos e detalhe de entregáveis. | Leitura de projetos inscritos e submissão de entregável para revisão CALI. Decisão Admin aplica a transição para validação do Cliente. |
| Ocorrências | Empresa e módulo atribuídos. Conversa do Cliente no recorte inicial. | Leitura, resposta pública e pedido de encerramento em ocorrência fictícia aberta. Admin decide; notas internas e anexos seguem fora deste recorte. |
| Horas | Partner consulta as próprias horas. Cronômetro registra trechos privados; lançamento manual exige justificativa e decisão Admin. | Fila manual homologada. Cronômetro instalado com vínculo opcional a projeto, entregável, subtarefa ou ocorrência. |
| Agenda, Documentos, Relatórios, Avisos e Equipe | Consultar registros da empresa conforme atribuição de módulo e visibilidade do registro. | Cinco projeções instaladas e provadas com dados sintéticos. Documentos avulsos publicados e relatórios liberados pela V2 têm download da revisão vigente. Agenda, Avisos e Equipe têm leitura no recorte Partner. |
| Mapa | A publicação 83 não oferece Mapa no Partner; a V2 exige Admin na triagem. | Sem concessão ao Partner. Ampliação exige definição de público e finalidade. |
| Resumo diário Partner | Empresas abrangidas e presença de horas dependem da definição da Patrícia. | Decisão em aberto em [DEC-19](../PRODUCT_RULES.md#resumo-01--contrato-admin-definido-partner-posterior). |

## Isolamento no CALI MAPA

O catálogo hospedado tem um perfil Partner e um vínculo legado com identidade. O predicado legado junta perfil e membro e concede acesso a numerosas policies, inclusive escritas. O piloto V2 não cria esse perfil nem preenche o vínculo legado. Só admite o convite fictício reservado e revalida identidade, empresa, revisão, sessão, MFA e termos a cada consulta. A publicação jurídica continua sendo a mesma versão e hash da V2, com aceite em registro privado do piloto.

Aplicar em uma transação [a base de convites fictícios](../../supabase/proposals/phase-4/staff-pilot-admission.sql), [as RPCs Partner](../../supabase/proposals/phase-5/partner-pilot.sql) e [o leitor de detalhe](../../supabase/proposals/phase-5/partner-detail.sql) e [a fila de horas](../../supabase/proposals/phase-5/partner-hour-review.sql). Antes de aplicar, conferir ausência da candidata, escopo das empresas e versão de termos. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-pilot.sql) roda em transação revertida e usa as fixtures A/B. [Rollback funcional](../../supabase/proposals/phase-5/rollback-partner-pilot.sql) retira os endpoints e mantém histórico e termos privados. A instalação verificou que as definições de `is_partner` e `partner_can_access` legadas ficaram intactas.

O Auth hospedado e a Data API foram exercitados com identidade descartável confirmada, TOTP real e JWT do próprio Auth, sem enviar e-mail. A tentativa em AAL1 falhou. Depois do convite e dos termos, A leu Projetos, Ocorrências e somente horas próprias. B e módulo não atribuído foram recusados nos ensaios. Na Data API, Projetos e Ocorrências abriram os detalhes e a revogação cortou a mesma sessão antes do logout. A identidade, convite, sessão e aceite da prova foram removidos.

A rota `/equipe` usa `VITE_CALI_PHASE5_PARTNER=true` apenas no Vite dev, em `127.0.0.1` conectado ao CALI MAPA. A tela abre separada de Admin/Cliente. A entrada sem sessão foi conferida no navegador. A rota mantém a entrada nativa reservada ao formato fictício. A homologação por e-mail usou canal isolado temporário e já removido. A prova automatizada de interface cobre navegação, escopo e retirada do detalhe após revogação.

## Horas manuais e decisão Admin

Partner com módulo Horas envia data, minutos, descrição e justificativa. A fila reusa o identificador do envio em caso de repetição e rejeita alterações no mesmo pedido. Partner vê os próprios pedidos e a decisão. Admin decide dentro da empresa, com MFA e termos vigentes. A recusa exige motivo. A aprovação revalida o vínculo e grava o lançamento privado pelo contrato existente, na mesma transação da decisão. Uma repetição com a mesma decisão não duplica a hora.

No CALI MAPA, a rodada de Auth para preparar a fila gravou uma solicitação antes de expirar e foi limpa. O ensaio seguinte usou uma sessão SQL fictícia para preparar duas solicitações pela RPC, comprovando repetição, divergência de conteúdo, corte de empresa e recusa de decisão pelo Partner. Admin autenticado recusou uma solicitação na interface e conferiu o motivo persistido. A aprovação foi exercitada pela mesma sessão Admin em uma chamada de prova com rollback. O banco conferiu uma hora privada, mesmo com duas decisões iguais. Após reverter, o extrato ficou sem lançamentos fictícios. As solicitações, a identidade e a função temporária foram removidas.

## Cronômetro e vínculos

Aplicar [fila de horas](../../supabase/proposals/phase-5/partner-hour-review.sql) e [cronômetro](../../supabase/proposals/phase-5/partner-timer.sql), nesta ordem e na mesma transação, após a admissão e os recibos de operação. Conferir as definições legadas antes de aplicar em homologação. O vínculo opcional usa os IDs sintéticos já inscritos em Projetos ou Ocorrências e exige também a atribuição ao módulo de origem. O servidor revalida a cadeia projeto, entregável e subtarefa, o estado operacional e a ocorrência aberta. A operação usa os registros nativos de timer e horas, sem conceder acesso ao contrato legado.

Somente o titular do convite opera o cronômetro; um segundo timer aberto é recusado. Ao encerrar, o servidor descarta trechos inferiores a 30 segundos e arredonda os demais para cima. A DEC-29 encaminha o trecho à mesma fila das horas manuais. Aprovação Admin grava uma única hora privada com autor, data, duração e vínculos do cronômetro. Recusa preserva a solicitação e o motivo. O encerramento automático e o fechamento associado ao trabalho também encaminham os timers do piloto à fila. O caminho legado de encerramento manual recusa esses timers. A [prova local](../../supabase/proposals/phase-5/prove-partner-timer.sql) cobre aprovação, recusa, repetição e vínculo preservado. A rotina de inatividade foi exercitada localmente com as definições versionadas da V1. A correção está pendente de aplicação em homologação. Em caso de reversão, retirar o acesso ao piloto e preservar a fila e os recibos.

## Catálogos adicionais

A [consulta Partner](../../supabase/proposals/phase-5/partner-catalogs.sql) retorna cinco projeções com paginação e registro sintético inscrito por UUID e empresa. Agenda requer evento não cancelado com visibilidade para Equipe CALI. Documentos exige publicação; arquivos legados inscritos expõem só metadados visíveis ao Cliente. Documento avulso V2 inscrito expõe o PDF vigente. Relatórios omite notas e revisões retiradas. A revisão vigente e liberada pela V2 tem download privado. Avisos exige publicação e público elegível. Equipe mostra nome, cargo e área de registros ativos, sem contatos, salários ou dados privados. A [prova no CALI MAPA](../../supabase/proposals/phase-5/prove-partner-catalogs.sql) confirmou leitura, ausência de campos privados e retirada de itens que perderam visibilidade; reverteu todas as fixtures. A instalação inscreveu dois eventos sintéticos já existentes.

No Chrome, a tela abriu o formulário de código. A rodada autenticada usou senha da fixture e TOTP real; confirmou convite e termos pela interface, navegou nos cinco catálogos, iniciou e encerrou timer vinculado a subtarefa, e perdeu acesso ao recarregar a mesma sessão após revogação. A primeira rodada encontrou campos extras no payload de aceite; o ajuste enviou apenas versão e hash e a repetição passou. Identidade, aceite, timer e demais registros da fixture foram removidos. A rodada não comprova entrada por OTP.

## Resposta em ocorrência

A [RPC de resposta](../../supabase/proposals/phase-5/partner-record-reply.sql) exige a guarda Partner do módulo Ocorrências, ocorrência aberta e inscrição sintética. Publica na conversa do Cliente e muda a ocorrência para aguardar resposta do Cliente. Usa o papel de apresentação da CALI e preserva o UUID real do autor no registro e na auditoria. O recibo recusa conteúdo divergente e preserva uma única publicação após retry. O movimento avisa apenas no aplicativo. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-record-reply.sql) confirmou no CALI MAPA autoria, estado, ausência de e-mail, recusa de empresa B, conversa encerrada e sessão revogada; reverteu a fixture. No Chrome, a sessão fictícia por senha e TOTP publicou a resposta e a releu na conversa; a mesma sessão perdeu acesso após revogação. Identidade, convite, mensagem, ocorrência e notificações fictícias foram retirados.

## PDF de relatório liberado

A [consulta de PDF](../../supabase/proposals/phase-5/partner-report-download.sql) exige Relatórios, inscrição sintética, empresa atribuída e a revisão vigente liberada no Workspace. Lê o artefato conferido pelo Admin, verifica o hash no frontend e proíbe cache HTTP. Não gera documento novo, não lê o acervo e não registra ciência em nome do Cliente. O catálogo inclui a revisão V2 liberada, cujo status no banco permanece aprovado. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-report-download.sql) confirmou bytes, hash, recusa da revisão anterior, empresa B, retirada e ausência de ciência; reverteu a fixture. Chrome também baixou a revisão fictícia e conferiu nome e bytes. Após revogar a sessão, a prova removeu relatório, artefato e identidade descartável.

## Documento avulso publicado

A [consulta de documento](../../supabase/proposals/phase-5/partner-document-download.sql) exige módulo Documentos, empresa atribuída, inscrição sintética e igualdade com a revisão publicada atual. Entrega os bytes do artefato V2, com SHA-256 e sem cache HTTP. Não acessa acervo ou arquivos de entregável e não registra ciência pelo Cliente. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-document-download.sql) validou revisão atual, hash, isolamento, retirada e recusa da revisão anterior no CALI MAPA. Dados revertidos.

## Revisão de entregável e encerramento de ocorrência

A [fila privada](../../supabase/proposals/phase-5/partner-review.sql) recebe uma solicitação aberta por alvo e protege reenvios. Partner pode enviar um entregável elegível para revisão CALI ou solicitar o encerramento de uma ocorrência aberta. Admin com sessão, MFA e aceite vigentes devolve com motivo ou aprova. Aprovação aplica a transição canônica e a decisão na mesma transação: entregável segue para validação do Cliente; ocorrência é encerrada. Partner acompanha apenas as próprias solicitações no módulo atribuído. Os gatilhos já instalados mantêm os avisos do piloto sintético no aplicativo.

A [prova de revisão](../../supabase/proposals/phase-5/prove-partner-review.sql) confirmou no CALI MAPA submissão, repetição, duplicidade e recusa de decisão pelo Partner; reverteu os dados. O [ensaio descartável](../../supabase/proposals/phase-5/test-partner-review.sh) confirmou aprovação dos dois tipos, devolução, isolamento e decisão repetida sem duplicação. A ponta Admin também passou no navegador integrado do CALI MAPA com sessão Admin real e itens fictícios: aprovou um encerramento e um envio de entregável à validação do Cliente e devolveu outro encerramento com motivo. O banco confirmou as transições, a devolução sem encerrar e nenhum e-mail enfileirado. Os três itens, pedidos, identidade, avisos e registros de prova foram removidos.

## OTP por e-mail e limpeza

A [função temporária](../../supabase/functions/workspace-partner-otp-qa/index.ts) enviou pelo Resend exclusivamente ao endereço autorizado. Esse endereço foi apenas destino de entrega. A identidade Auth continuou no formato sintético reservado, sem perfil ou vínculo legado. A [reserva privada](../../supabase/proposals/phase-5/partner-otp-qa.sql) limitou cada janela a um envio e cinco tentativas; a [prova SQL](../../supabase/proposals/phase-5/prove-partner-otp-qa.sql) confirmou uso único, validade e recusa sem chave. A troca pelo Auth hospedado usou apenas o login da conta descartável, sem credencial administrativa. SMTP e função de acesso existente ficaram intactos.

Foram aceitos dois envios no total, um por janela. Na primeira janela o código foi aceito e o Auth criou sessão, mas o formulário não abriu o MFA. Após retirar essa janela, a segunda usou a tela sem atualização automática e recarga depois de salvar a sessão. No navegador integrado, o destinatário digitou o código recebido, confirmou TOTP, aceitou convite e termos e abriu Empresa A. SQL confirmou AAL2, convite e aceite. A mesma sessão perdeu acesso após revogação. A [limpeza](../../supabase/proposals/phase-5/rollback-partner-otp-qa.sql) retirou a função, segredo, RPC, reserva, conta fictícia, convite, fator, sessões e aceite. O servidor local foi encerrado. O endereço não foi cadastrado no CALI MAPA.

## Limites de fechamento

O recorte técnico do piloto cobre admissão por código, consultas dos módulos, horas, resposta a ocorrência, PDFs V2 e fila das duas revisões. Não inclui operação Partner no acervo, anexos ou notas internas de ocorrências, demais pedidos de alteração ou publicação, nem ampliação do Mapa. Este recorte técnico está fechado no CALI MAPA. O canal OTP temporário não é infraestrutura de rollout. Público e presença de horas no resumo diário Partner dependem de decisão CALI em DEC-19.


## Revisão de materiais e recuperação no preview

O Partner entra com código, MFA, convite e termos vigentes. O cronômetro permanece visível entre módulos. A pausa automática gera alerta e conserva o trecho na fila para ajuste com justificativa. A aprovação Admin publica o lançamento de horas. O [runbook](../RUNBOOK.md#preview-protegido-para-homologação) descreve a preparação do agendador e do transporte de teste para a prova de inatividade.

Relatórios exigem acesso ao módulo. Propostas e pareceres do Mapa exigem atribuição ao registro. A revisão Admin pode devolver o material ou incorporá-lo ao fluxo oficial. Entrega e reenvio seguem a dupla confirmação da revisão vigente. Conferir o [roteiro da candidata](../HOMOLOGACAO_PATRICIA.md#regressão-do-pr-3-no-preview) com dois Partners e empresas distintas.
