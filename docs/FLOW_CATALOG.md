# Catálogo de fluxos e especificações de experiência

Atualização: 25/10/2026. **18 fichas documentais preenchidas com fontes, transições, permissões e dúvidas; não é validação funcional.** Oficial consultado somente em leitura na revisão `f3d3f14043a6abc38636f0340fe831e621d8b357`. A V2 continua demonstrativa e sem integração.

Revisão de produto de 26/10: usar o funcionamento testado da [publicação 83](BASELINE_REFERENCE_2026-10-26.md), as [regras atuais](PRODUCT_RULES.md) e o [roadmap por entregas completas](ROADMAP.md). DEC-13 substitui DEC-07: DISC é linha oficial, com públicos de respondente/avaliador/gestão distintos. Resumo Admin está definido em RESUMO-01 / DEC-19; apenas conteúdo Partner permanece para sua fase; Partner fica posterior, sem reduzir cobertura Cliente/Admin.

## Como interpretar

Um fluxo é a tarefa de um ator com início, decisão/ação e resultado observável. Uma página pode conter vários fluxos; um fluxo pode atravessar várias páginas.

- **Demo:** há composição/interação local no código, sem contrato operacional comprovado.
- **Documentado:** jornada mencionada em contexto/handoff, sem implementação comprovada nesta V2.
- **Inventário adicional:** caminho encontrado na referência oficial e ainda a reconciliar.
- **Especificação pendente:** falta preencher atores/permissões, transições, conteúdo, falhas e aceite com fonte atual.

As fichas do levantamento estão preenchidas; dúvidas sobre contratos ausentes, diferenças entre camadas e estado aplicado continuam abertas. Dono significa domínio técnico proposto em [Arquitetura](ARCHITECTURE.md), não pessoa nomeada nem pasta já criada. [Matriz Cliente/Admin](PERMISSIONS.md) distingue UI, SQL, EDGE e não comprovado; botão demonstrativo não prova permissão.

## Mapa de cobertura

| ID | Tarefa/jornada | Atores a reconciliar | Domínio e referência V2 | Estado atual da V2 | Ficha reconciliada |
| --- | --- | --- | --- | --- | --- |
| FLOW-01 | Aderir, receber convite, acessar, expirar/encerrar sessão e recuperar continuidade | Admin, Cliente, Partner conforme contrato | Acesso/contas; somente prévias de perfil no código atual | Documentado; autenticação não implementada | [Preenchida; dúvidas registradas](flows/ACCESS_ACCOUNTS.md) |
| FLOW-02 | Cadastrar/acompanhar conta, contrato, ciclo, visibilidade e encerramento | Admin; Cliente nas participações previstas | Empresas; `src/features/companies/CompaniesPage.tsx` e `src/api/modules/companies` | Consulta demo com filtros/seleção na URL; ciclo real ainda não implementado | [Preenchida; dúvidas registradas](flows/ACCESS_ACCOUNTS.md) |
| FLOW-03 | Elaborar, revisar, apresentar e acompanhar proposta | Admin e destinatário autorizado | Proposals; seção Admin | Demo; estados/aceites comerciais a reconciliar | [Preenchida; dúvidas registradas](flows/ACCESS_ACCOUNTS.md) |
| FLOW-04 | Encontrar prioridade e seguir para ação/objeto correto | Cliente, Admin | Visões iniciais; `ClientHome.tsx`, `AdminPreview.tsx` | Demo | [Preenchida; dúvidas registradas](flows/WORKSPACE_HOURS_TEAM.md) |
| FLOW-05 | Planejar projeto/frente/cronograma e validar alterações | Admin, Cliente, Partner atribuído quando previsto | Projects; `main.tsx`, `AdminPreview.tsx` | Demo | [Preenchida; dúvidas registradas](flows/PROJECTS.md) |
| FLOW-06 | Executar/revisar entregável, conversar, solicitar ajuste, aprovar e avaliar | Admin, Cliente, Partner conforme operação | Projects; `DeliverablesView.tsx` | Demo; transições/pesquisa a reconciliar | [Preenchida; dúvidas registradas](flows/PROJECTS.md) |
| FLOW-07 | Registrar atuação por timer/manual e acompanhar extrato por ciclo/período | Operador autorizado; Cliente consulta | Hours; `main.tsx`, seção Admin | Demo; registro real/timer ausentes nesta V2 | [Preenchida; dúvidas registradas](flows/WORKSPACE_HOURS_TEAM.md) |
| FLOW-08 | Consultar/cadastrar equipe, importar, registrar movimento e confirmar período | Papel habilitado por operação; Cliente/Admin | Team; `main.tsx`, `TeamEnhancements.tsx`, `IndicatorExtras.tsx` | Demo; confirmação/importação real ausentes | [Preenchida; dúvidas registradas](flows/WORKSPACE_HOURS_TEAM.md) |
| FLOW-09 | Consultar agenda, solicitar/agendar, confirmar, remarcar ou cancelar | Cliente, Admin, operadores conforme contrato | Calendar; `WorkflowViews.tsx`, seção Admin | Demo; integrações ausentes | [Preenchida; dúvidas registradas](flows/CALENDAR.md) |
| FLOW-10 | Abrir, acompanhar, responder, anexar, encerrar, avaliar e reabrir ocorrência | Cliente, Admin, Partner autorizado | Records; `WorkflowViews.tsx`, seção Admin | Demo | [Preenchida; dúvidas registradas](flows/RECORDS.md) |
| FLOW-11 | Gerenciar/consultar arquivo, versão, acesso, ciência e sincronização | Cliente, Admin, Partner conforme operação | Documents; `WorkflowViews.tsx`, seção Admin | Demo; storage/Drive ausentes | [Preenchida; dúvidas registradas](flows/DOCUMENTS_REPORTS.md) |
| FLOW-12 | Fechar período, curar/revisar/publicar relatório e consultar/PDF/ciência | Admin, Cliente, outros operadores conforme contrato | Reports; `WorkflowViews.tsx`, seção Admin | Demo; geração/publicação reais ausentes | [Preenchida; dúvidas registradas](flows/DOCUMENTS_REPORTS.md) |
| FLOW-13 | Publicar/consultar aviso, comentar, registrar ciência e relacionar agenda | Papel habilitado por operação; Cliente/Admin | Notices; `NoticesView.tsx`, calendário e seção Admin | Demo; fontes locais desconectadas | [Preenchida; dúvidas registradas](flows/ADMIN_LIFECYCLE.md) |
| FLOW-14 | Localizar módulo, receber sinalização e abrir objeto; consultar perfil/sair | Usuário do workspace | Shell e menus; `main.tsx`, `ClientHome.tsx` | Demo parcial; busca global/sessão reais ausentes | [Preenchida; dúvidas registradas](flows/WORKSPACE_HOURS_TEAM.md) |
| FLOW-15 | Operar empresas atribuídas e administrar equipe CALI | Partner, Admin | Referência oficial `/equipe/*` e equipe CALI | Inventário adicional; sem área equivalente completa nesta V2 | [Preenchida; dúvidas registradas](flows/ADMIN_LIFECYCLE.md) |
| FLOW-16 | Auditar eventos e acompanhar satisfação | Admin e outros papéis previstos | Satisfação parcial na prévia Admin; auditoria na referência | Demo parcial/inventário adicional | [Preenchida; dúvidas registradas](flows/ADMIN_LIFECYCLE.md) |
| FLOW-17 | Executar DISC, Mapa de People e formulários por subfluxo | CALI, Cliente de gestão e respondente conforme relatório/operação | DISC é produto oficial; Forms/Mapa rastreados separadamente | Sem implementação V2; públicos confirmados em DEC-13; contratos técnicos pendentes | [Preenchida; dúvidas registradas](flows/FORMS_PEOPLE_PROFILE.md) |
| FLOW-18 | Consultar frentes/ajuda/legal e exercer ações de encerramento/exportação permitidas | Atores definidos pelo contrato | Entradas parciais na home; contexto/handoff e referência oficial | Demo parcial/documentado/inventário adicional | [Preenchida; dúvidas registradas](flows/ADMIN_LIFECYCLE.md) |

Lista de páginas e rotas pertence à Arquitetura. Inventário de operação/tabela/RPC pertence a Dados e contratos. Este catálogo relaciona tarefas e aponta para a especificação pertinente.

## Ficha obrigatória antes de alterar comportamento

Preencher no próprio catálogo enquanto o fluxo for curto; criar `docs/flows/<dominio>.md` somente quando houver especificação concreta que justifique arquivo próprio. Não gerar dezoito arquivos vazios.

```text
ID / nome do fluxo / domínio / responsável pela validação:
Estado: levantado / proposto / confirmado / implementado / validado
Fonte funcional: documento + revisão + evidência de decisão
Fonte visual: arquivo/tela/captura identificada + revisão
Ator, objetivo, entrada e pré-condições:
Empresa, período, objeto/versão e escopo de acesso:
Passos e decisões; alternativa de abandono/cancelamento:
Transições: anterior / ação / guarda / seguinte / ator / efeito
Anatomia: título, contexto, informação, ação principal e secundárias
Padrão: página, drawer, modal ou composição específica
Navegação: URL direta, retorno, filtros, rascunho e mudança de empresa
Estados: inicial, loading, vazio, parcial, sucesso, erro, negado, expirado
Formulários: campos reais, validação, envio, falha e preservação
Permissões: quem consulta/altera/publica/aprova/exporta, por operação
Contrato de dados vinculado e autoridade de totais/indicadores:
Efeitos externos, confirmação real e prevenção de duplicidade:
Responsividade e percurso por teclado:
Critérios observáveis de aceite e casos de falha:
Evidência de QA/contrato/isolamento; ambiente e revisão:
Pendências, decisões associadas e próxima ação:
```

Pesquisa, evidência de QA e aprovação têm estados separados: tela especificada não significa usabilidade validada; mock não comprova autorização do backend.

## Fichas, evidência e permissões

[Índice das fichas e contrato comum](flows/README.md), [fontes imutáveis e lacunas de RPC](flows/SOURCES.md), [matriz Cliente/Admin](PERMISSIONS.md) e [dúvidas REF-01 a REF-24](DECISIONS.md) são os complementos deste catálogo. Cada ficha declara o que foi observado e os cenários de aceite futuros. Nenhuma foi marcada como implementada/validada por consequência da documentação.

## Critério de fechamento do catálogo

Fichas preenchidas nesta etapa são levantamento estático. Para fechamento operacional, cada fluxo aplicável ainda precisa de contrato reconciliado e evidência de comportamento permitido/negado no ambiente autorizado. Módulo adicional tem decisão explícita de preservar/migrar/adiar, com impacto conhecido. Exclusão não pode acontecer por esquecimento no redesign. Ver [Roadmap](ROADMAP.md) e [Decisões](DECISIONS.md).
