# Partner interno — fase 5

O piloto usa o vínculo da Equipe CALI para dar acesso por empresa e módulo. O papel interno segue a [interface Partner da publicação 83](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/staff/StaffWorkspace.tsx), os [termos vigentes](ACCESS_COMPANIES.md) e a [ficha FLOW-15](../flows/ADMIN_LIFECYCLE.md).

## Matriz de trabalho

| Recorte | Regra reconciliada | Situação |
| --- | --- | --- |
| Admissão | Identidade confirmada, convite individual, sessão viva, TOTP verificado, AAL2 e aceite da versão vigente. Revisão do vínculo, desativação ou revogação retiram acesso. | Candidata instalada e testada no CALI MAPA com identidade fictícia. |
| Projetos | Empresa e módulo atribuídos. Listagem de projetos e detalhe de entregáveis. | Leitura de projetos inscritos no piloto. Escrita e submissão para revisão em recorte próprio. |
| Ocorrências | Empresa e módulo atribuídos. Conversa do Cliente no recorte inicial. | Leitura e resposta pública em ocorrência fictícia aberta. Notas internas, anexos e solicitação de encerramento em recorte próprio. |
| Horas | Partner consulta as próprias horas. Cronômetro registra trechos privados; lançamento manual exige justificativa e decisão Admin. | Fila manual homologada. Cronômetro instalado com vínculo opcional a projeto, entregável, subtarefa ou ocorrência. |
| Agenda, Documentos, Relatórios, Avisos e Equipe | Consultar registros da empresa conforme atribuição de módulo e visibilidade do registro. | Cinco projeções instaladas e provadas com dados sintéticos. PDF da revisão vigente liberada pela V2 já tem download. Arquivos de Documentos e operações de escrita ainda exigem contrato próprio. |
| Mapa | A publicação 83 não oferece Mapa no Partner; a V2 exige Admin na triagem. | Sem concessão ao Partner. Ampliação exige definição de público e finalidade. |
| Resumo diário Partner | Empresas abrangidas e presença de horas dependem da definição da Patrícia. | Decisão em aberto em [DEC-19](../PRODUCT_RULES.md#resumo-01--contrato-admin-definido-partner-posterior). |

## Isolamento no CALI MAPA

O catálogo hospedado tem um perfil Partner e um vínculo legado com identidade. O predicado legado junta perfil e membro e concede acesso a numerosas policies, inclusive escritas. O piloto V2 não cria esse perfil nem preenche o vínculo legado. Só admite o convite fictício reservado e revalida identidade, empresa, revisão, sessão, MFA e termos a cada consulta. A publicação jurídica continua sendo a mesma versão e hash da V2, com aceite em registro privado do piloto.

Aplicar em uma transação [a base de convites fictícios](../../supabase/proposals/phase-4/staff-pilot-admission.sql), [as RPCs Partner](../../supabase/proposals/phase-5/partner-pilot.sql) e [o leitor de detalhe](../../supabase/proposals/phase-5/partner-detail.sql) e [a fila de horas](../../supabase/proposals/phase-5/partner-hour-review.sql). Antes de aplicar, conferir ausência da candidata, escopo das empresas e versão de termos. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-pilot.sql) roda em transação revertida e usa as fixtures A/B. [Rollback funcional](../../supabase/proposals/phase-5/rollback-partner-pilot.sql) retira os endpoints e mantém histórico e termos privados. A instalação verificou que as definições de `is_partner` e `partner_can_access` legadas ficaram intactas.

O Auth hospedado e a Data API foram exercitados com identidade descartável confirmada, TOTP real e JWT do próprio Auth, sem enviar e-mail. A tentativa em AAL1 falhou. Depois do convite e dos termos, A leu Projetos, Ocorrências e somente horas próprias. B e módulo não atribuído foram recusados nos ensaios. Na Data API, Projetos e Ocorrências abriram os detalhes e a revogação cortou a mesma sessão antes do logout. A identidade, convite, sessão e aceite da prova foram removidos.

A rota `/equipe` usa `VITE_CALI_PHASE5_PARTNER=true` apenas no Vite dev, em `127.0.0.1` conectado ao CALI MAPA. A tela abre separada de Admin/Cliente. A entrada sem sessão foi conferida no navegador. A rota aceita OTP nativo de oito dígitos para identidade fictícia no formato reservado. Emissão por caixa de teste e prova completa do código no navegador permanecem pendentes. A prova automatizada de interface cobre navegação, escopo e retirada do detalhe após revogação.

## Horas manuais e decisão Admin

Partner com módulo Horas envia data, minutos, descrição e justificativa. A fila reusa o identificador do envio em caso de repetição e rejeita alterações no mesmo pedido. Partner vê os próprios pedidos e a decisão. Admin decide dentro da empresa, com MFA e termos vigentes. A recusa exige motivo. A aprovação revalida o vínculo e grava o lançamento privado pelo contrato existente, na mesma transação da decisão. Uma repetição com a mesma decisão não duplica a hora.

No CALI MAPA, a rodada de Auth para preparar a fila gravou uma solicitação antes de expirar e foi limpa. O ensaio seguinte usou uma sessão SQL fictícia para preparar duas solicitações pela RPC, comprovando repetição, divergência de conteúdo, corte de empresa e recusa de decisão pelo Partner. Admin autenticado recusou uma solicitação na interface e conferiu o motivo persistido. A aprovação foi exercitada pela mesma sessão Admin em uma chamada de prova com rollback. O banco conferiu uma hora privada, mesmo com duas decisões iguais. Após reverter, o extrato ficou sem lançamentos fictícios. As solicitações, a identidade e a função temporária foram removidas.

## Cronômetro e vínculos

Aplicar [cronômetro](../../supabase/proposals/phase-5/partner-timer.sql) após a admissão. O vínculo opcional usa os IDs sintéticos já inscritos em Projetos ou Ocorrências e exige também a atribuição ao módulo de origem. O servidor revalida a cadeia projeto, entregável e subtarefa, o estado operacional e a ocorrência aberta. A operação usa os registros nativos de timer e horas, sem conceder acesso ao contrato legado.

Somente o titular do convite opera o cronômetro; um segundo timer aberto é recusado. Ao encerrar, o servidor descarta trechos inferiores a 30 segundos e arredonda os demais para cima. Registra a hora privada, com o mesmo contexto, e protege o retry por identificador de operação. A [prova no CALI MAPA](../../supabase/proposals/phase-5/prove-partner-timer.sql) foi revertida: bloqueio de outra empresa e alvo não inscrito, unicidade de timer aberto, vínculo com subtarefa, descarte de trecho curto, gravação privada de 2 minutos em 61 segundos, repetição sem duplicar e corte após revogação.

## Catálogos adicionais

A [consulta Partner](../../supabase/proposals/phase-5/partner-catalogs.sql) retorna cinco projeções com paginação e registro sintético inscrito por UUID e empresa. Agenda requer evento não cancelado com visibilidade para Equipe CALI. Documentos exige publicação e visibilidade de Cliente e só mostra metadados. Relatórios omite notas e revisões retiradas. A revisão vigente e liberada pela V2 tem download privado. Avisos exige publicação e público elegível. Equipe mostra nome, cargo e área de registros ativos, sem contatos, salários ou dados privados. A [prova no CALI MAPA](../../supabase/proposals/phase-5/prove-partner-catalogs.sql) confirmou leitura, ausência de campos privados e retirada de itens que perderam visibilidade; reverteu todas as fixtures. A instalação inscreveu dois eventos sintéticos já existentes.

No Chrome, a tela abriu o formulário de código. A rodada autenticada usou senha da fixture e TOTP real; confirmou convite e termos pela interface, navegou nos cinco catálogos, iniciou e encerrou timer vinculado a subtarefa, e perdeu acesso ao recarregar a mesma sessão após revogação. A primeira rodada encontrou campos extras no payload de aceite; o ajuste enviou apenas versão e hash e a repetição passou. Identidade, aceite, timer e demais registros da fixture foram removidos. A rodada não comprova entrada por OTP.

## Resposta em ocorrência

A [RPC de resposta](../../supabase/proposals/phase-5/partner-record-reply.sql) exige a guarda Partner do módulo Ocorrências, ocorrência aberta e inscrição sintética. Publica na conversa do Cliente e muda a ocorrência para aguardar resposta do Cliente. Usa o papel de apresentação da CALI e preserva o UUID real do autor no registro e na auditoria. O recibo recusa conteúdo divergente e preserva uma única publicação após retry. O movimento avisa apenas no aplicativo. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-record-reply.sql) confirmou no CALI MAPA autoria, estado, ausência de e-mail, recusa de empresa B, conversa encerrada e sessão revogada; reverteu a fixture. No Chrome, a sessão fictícia por senha e TOTP publicou a resposta e a releu na conversa; a mesma sessão perdeu acesso após revogação. Identidade, convite, mensagem, ocorrência e notificações fictícias foram retirados.

## PDF de relatório liberado

A [consulta de PDF](../../supabase/proposals/phase-5/partner-report-download.sql) exige Relatórios, inscrição sintética, empresa atribuída e a revisão vigente liberada no Workspace. Lê o artefato conferido pelo Admin, verifica o hash no frontend e proíbe cache HTTP. Não gera documento novo, não lê o acervo e não registra ciência em nome do Cliente. O catálogo inclui a revisão V2 liberada, cujo status no banco permanece aprovado. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-report-download.sql) confirmou bytes, hash, recusa da revisão anterior, empresa B, retirada e ausência de ciência; reverteu a fixture. Chrome também baixou a revisão fictícia e conferiu nome e bytes. Após revogar a sessão, a prova removeu relatório, artefato e identidade descartável.

## Emissão de OTP e pendências

No CALI MAPA, o Auth nativo usa template com link, OTP de oito dígitos e nenhum SMTP próprio configurado. O [SMTP padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) restringe os destinatários a endereços da equipe do projeto. A Edge hospedada de login existente liga o usuário ao perfil Partner legado e altera o vínculo de equipe; ela não atende o isolamento deste piloto. Por isso, não foi usada para o endereço autorizado. A auditoria não encontrou referência direta ao endereço nas colunas de e-mail verificadas em Auth, Workspace, escopos privados e schema público. Nenhum envio ou provisionamento foi feito para ele.

Para homologar entrega e login por código, primeiro configurar um canal de teste isolado com template numérico compatível. A emissão deve exigir identidade pré-inscrita e negar criação automática. O destinatário de teste, convite, fatores, sessões, aceite e registros gerados devem ser retirados após a prova. A identidade fictícia reservada e o formulário da V2 podem continuar sendo usados para testar a interface sem enviar e-mail.

O fechamento ainda exige OTP de ponta a ponta, arquivos e operações/revisões dos módulos. O resumo Partner aguarda a definição de público e horas pela CALI.
