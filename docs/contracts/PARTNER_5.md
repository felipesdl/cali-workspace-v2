# Partner interno — fase 5

O piloto usa o vínculo da Equipe CALI para dar acesso por empresa e módulo. O papel interno segue a [interface Partner da publicação 83](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/src/pages/staff/StaffWorkspace.tsx), os [termos vigentes](ACCESS_COMPANIES.md) e a [ficha FLOW-15](../flows/ADMIN_LIFECYCLE.md).

## Matriz de trabalho

| Recorte | Regra reconciliada | Situação |
| --- | --- | --- |
| Admissão | Identidade confirmada, convite individual, sessão viva, TOTP verificado, AAL2 e aceite da versão vigente. Revisão do vínculo, desativação ou revogação retiram acesso. | Candidata instalada e testada no CALI MAPA com identidade fictícia. |
| Projetos | Empresa e módulo atribuídos. Listagem de projetos e detalhe de entregáveis. | Leitura de projetos inscritos no piloto. Escrita e submissão para revisão em recorte próprio. |
| Ocorrências | Empresa e módulo atribuídos. Conversa do Cliente no recorte inicial. | Leitura de ocorrências fictícias inscritas e mensagens públicas da conversa. Notas internas, anexos e escrita em recorte próprio. |
| Horas | Partner consulta as próprias horas. A publicação 83 diferencia timer direto e lançamento manual sujeito a justificativa e decisão Admin. | Leitura de horas próprias e fila de lançamento manual com decisão Admin homologadas. Timer direto e vínculos com entregáveis seguem em lote próprio. |
| Agenda, Documentos, Relatórios, Avisos, Equipe e Mapa | Projetar e autorizar por operação e módulo, sem expor trilhas privadas, dados salariais ou anexos por associação ampla. | A matriz do legado foi inventariada; a V2 ainda precisa homologar cada projeção. |
| Resumo diário Partner | Empresas abrangidas e presença de horas dependem da definição da Patrícia. | Decisão em aberto em [DEC-19](../PRODUCT_RULES.md#resumo-01--contrato-admin-definido-partner-posterior). |

## Isolamento no CALI MAPA

O catálogo hospedado tem um perfil Partner e um vínculo legado com identidade. O predicado legado junta perfil e membro e concede acesso a numerosas policies, inclusive escritas. O piloto V2 não cria esse perfil nem preenche o vínculo legado. Só admite o convite fictício reservado e revalida identidade, empresa, revisão, sessão, MFA e termos a cada consulta. A publicação jurídica continua sendo a mesma versão e hash da V2, com aceite em registro privado do piloto.

Aplicar em uma transação [a base de convites fictícios](../../supabase/proposals/phase-4/staff-pilot-admission.sql), [as RPCs Partner](../../supabase/proposals/phase-5/partner-pilot.sql) e [o leitor de detalhe](../../supabase/proposals/phase-5/partner-detail.sql) e [a fila de horas](../../supabase/proposals/phase-5/partner-hour-review.sql). Antes de aplicar, conferir ausência da candidata, escopo das empresas e versão de termos. A [prova SQL](../../supabase/proposals/phase-5/prove-partner-pilot.sql) roda em transação revertida e usa as fixtures A/B. [Rollback funcional](../../supabase/proposals/phase-5/rollback-partner-pilot.sql) retira os endpoints e mantém histórico e termos privados. A instalação verificou que as definições de `is_partner` e `partner_can_access` legadas ficaram intactas.

O Auth hospedado e a Data API foram exercitados com identidade descartável confirmada, TOTP real e JWT do próprio Auth, sem enviar e-mail. A tentativa em AAL1 falhou. Depois do convite e dos termos, A leu Projetos, Ocorrências e somente horas próprias. B e módulo não atribuído foram recusados nos ensaios. Na Data API, Projetos e Ocorrências abriram os detalhes e a revogação cortou a mesma sessão antes do logout. A identidade, convite, sessão e aceite da prova foram removidos.

A rota `/equipe` usa `VITE_CALI_PHASE5_PARTNER=true` apenas no Vite dev, em `127.0.0.1` conectado ao CALI MAPA. A tela abre separada de Admin/Cliente. A entrada sem sessão foi conferida no navegador. O login por e-mail e o convite de destinatário real exigem homologação própria. A prova automatizada de interface cobre navegação, escopo e retirada do detalhe após revogação.


## Horas manuais e decisão Admin

Partner com módulo Horas envia data, minutos, descrição e justificativa. A fila reusa o identificador do envio em caso de repetição e rejeita alterações no mesmo pedido. Partner vê os próprios pedidos e a decisão. Admin decide dentro da empresa, com MFA e termos vigentes. A recusa exige motivo. A aprovação revalida o vínculo e grava o lançamento privado pelo contrato existente, na mesma transação da decisão. Uma repetição com a mesma decisão não duplica a hora.

No CALI MAPA, a rodada de Auth para preparar a fila gravou uma solicitação antes de expirar e foi limpa. O ensaio seguinte usou uma sessão SQL fictícia para preparar duas solicitações pela RPC, comprovando repetição, divergência de conteúdo, corte de empresa e recusa de decisão pelo Partner. Admin autenticado recusou uma solicitação na interface e conferiu o motivo persistido. A aprovação foi exercitada pela mesma sessão Admin em uma chamada de prova com rollback. O banco conferiu uma hora privada, mesmo com duas decisões iguais. Após reverter, o extrato ficou sem lançamentos fictícios. As solicitações, a identidade e a função temporária foram removidas.

Continuam pendentes a homologação do login por código e do aceite pela interface Partner, timer direto, vínculos operacionais e a matriz das outras operações. O resumo Partner aguarda a definição de público e horas pela CALI.
