# Experiência UX/UI CALI

Estado: **diretrizes propostas**, consolidadas em 25/10/2026 a partir do código V2, contexto e handoff. Identidade e escopo foram confirmados; detalhes de interação/composição ainda precisam de validação. Não houve pesquisa com usuários, auditoria visual ou teste de usabilidade nesta revisão.

Atualização de produto em 26/10: [Regras de produto](PRODUCT_RULES.md) confirmam UI-01 a UI-14 e os públicos/fluxos DISC. Base de paridade: [publicação 83](BASELINE_REFERENCE_2026-10-26.md). Diretriz proposta não substitui essas regras; o detalhamento abaixo as aplica sem afirmar QA já executado.

## Responsabilidade deste documento

- UX/UI define como a pessoa encontra informação, executa tarefa, entende o resultado e continua o trabalho.
- [Design system](DESIGN_SYSTEM.md) define tokens, componentes reutilizáveis e seu comportamento técnico/acessível.
- [Contexto de produto](PRODUCT_CONTEXT.md) define problema, atores e linguagem.
- [Catálogo de fluxos](FLOW_CATALOG.md) relaciona jornadas e especificações por domínio.
- [Arquitetura](ARCHITECTURE.md) define o lugar do código; [Dados e contratos](DATA_CONTRACTS.md), a autoridade e as operações.

UX/UI escolhe quando usar um drawer; DS implementa seu foco e teclado; contrato define o que pode ser exibido ou alterado nele. Não duplicar essas responsabilidades em três especificações.

## Princípios de experiência

1. Começar pela tarefa: contexto, situação e próxima ação precisam ser localizáveis sem percorrer todos os módulos.
2. Preservar contexto: abrir detalhe não deve perder empresa, período, filtro e posição da lista sem motivo.
3. Tornar estado verdadeiro: separar rascunho, salvo, publicado, enviado, entregue, lido e aprovado conforme o contrato.
4. Mostrar a informação necessária ao papel e à tarefa, mantendo notas/dados internos fora da experiência cliente.
5. Usar densidade com hierarquia e legibilidade; não reduzir fonte para esconder excesso de conteúdo.
6. Usar a composição adequada ao trabalho; evitar organização universal por cards.

## Arquitetura da informação

Navegação tem três níveis: global do workspace, seções/abas do módulo e filtros locais. Empresa e período são contexto; não viram um quarto menu com significado ambíguo.

O usuário deve reconhecer onde está e como voltar. Título de página, item ativo e breadcrumb, quando necessário, representam a mesma localização. Nome de rota interna não precisa aparecer na linguagem da interface. Caminhos e compatibilidade permanecem no mapa de [Arquitetura](ARCHITECTURE.md).

Admin e Cliente usam somente tema claro. Fotos/logos quadrados com raio de 7 px, elementos de marca e PDFs em Inter seguem o DS; toda entrega inclui mobile. Textos do produto e comunicações usam a voz CALI, sem propagar o estilo das sessões técnicas do Felipe.

Catálogo de módulos não deve ser diferente em cada menu. Entrada não permitida não concede acesso por URL. Escolher ocultar ou explicar indisponibilidade conforme o caso de uso; não mostrar formulário editável quando a operação é apenas consulta.

## Anatomia da página

Ordem proposta: contexto necessário; título e descrição útil; ação principal; navegação local; filtros; conteúdo; estado/resultado e próximo passo. Não repetir título do módulo em sucessivos containers.

Cada região tem uma ação prioritária conforme a tarefa, com secundárias menos proeminentes. Exportar, editar e pedir ajuste não precisam competir visualmente. Ação destrutiva ou de consequência ampla exige explicitar objeto, efeito e possibilidade de reversão.

| Família de tela | Composição principal | Informação prioritária |
| --- | --- | --- |
| Início cliente/mesa Admin | Prioridades, pendências e próximos eventos contextualizados | Quem age, sobre o quê e até quando, se houver prazo validado |
| Diretório/estrutura | Lista pesquisável, organização e detalhe contextual | Identidade, vínculo e contexto organizacional |
| Horas | Extrato e resumo do ciclo/período | Contratado, consumo, saldo/excedente e origem das atividades |
| Projetos/execução | Objetivo, situação, cronograma e unidades de trabalho | Dependência, responsável, marco e ação necessária |
| Ocorrência/conversa | Lista de assuntos e histórico do objeto | Protocolo, situação, participantes e próxima resposta |
| Documentos | Catálogo de versões/publicações com detalhe | Arquivo, versão, acesso, ciência e vínculo |
| Relatório | Leitura executiva com fonte, período e versão | Fatos, interpretação, decisões e próximos passos |
| Avisos | Mural organizado por público e data | Conteúdo, alcance e ação/ciência quando aplicável |
| Cadastro/proposta | Formulário ou etapas justificadas pelo trabalho | Dados exigidos, revisão e consequência da confirmação |

Essas famílias não aprovam novo conteúdo ou indicador. Especificação da tela deve declarar quais informações existem no contrato.

Notas/observações complementares ficam ao final da página; erro de campo e alerta necessário para agir permanecem junto da ação/contexto. Datas/contagens/metadados usam hierarquia secundária compacta e legível, sem card próprio. Evitar repetição redundante em cards sem proibir palavras necessárias ao conteúdo.

## Navegação e continuidade

- URL deve representar contexto compartilhável; busca em digitação e menu aberto permanecem transitórios conforme a arquitetura.
- Abrir detalhe por link direto precisa funcionar sem depender de uma lista previamente visitada. Oferecer retorno contextual ou destino seguro.
- Trocar empresa/período deve atualizar conteúdo e resumo em conjunto; detalhe antigo não pode parecer pertencer ao novo recorte.
- Definir preservação/reset de filtros e rascunhos por fluxo. Não guardar dados silenciosamente nem apagá-los sem política explícita.
- Se houver alteração não salva, decidir quando avisar ao sair; ação já confirmada deve manter estado consultável quando o contrato exigir.

## Página, drawer, modal e popover

| Padrão | Quando usar | Limite |
| --- | --- | --- |
| Página | Trabalho independente, conteúdo extenso ou navegação própria | Ter URL e retorno definidos |
| Drawer | Inspecionar/agir sobre objeto mantendo a lista em contexto | Definir comportamento em URL direta e viewport estreito |
| Modal | Decisão ou edição focada com início/fim claros | Sem modais aninhados; informar consequência antes de confirmar |
| Popover/menu | Opções curtas e auxiliares | Não hospedar formulário longo ou informação essencial dependente de hover |

DS é dono do foco, Escape, retorno ao gatilho, scroll e teclado. Fluxo decide se um envio em andamento pode ser fechado/cancelado e como o resultado será recuperado. Se detalhe virar tela cheia no mobile, preservar objeto, ação e retorno.

## Busca, filtros e tabelas

- Label e placeholder devem refletir os campos realmente pesquisados. Não prometer cargo/área quando busca aceita apenas nome.
- Período, filtros ativos, contagem e ação de limpar precisam ser identificáveis. Diferenciar seleção em edição de filtro aplicado quando houver confirmação.
- Barras de filtros/ações/abas priorizam uma linha no espaço disponível. Em mobile ou zoom, usar composição responsiva ou rolagem controlada sem esconder ações; rolagem discreta continua perceptível e utilizável por toque/teclado.
- Diferenciar sem registros, nenhum resultado no filtro, acesso não permitido e dados ainda indisponíveis.
- Resumo deve informar se cobre todo o recorte ou apenas página/seleção. Paginação não pode alterar silenciosamente significado do total.
- Ações de linha referenciam identidade estável. Ordenação deve ter critério perceptível; seleção precisa indicar alcance e consequência de ação em lote.

## Formulários, validação e feedback

Cadastro usa formulário único organizado em seções, sem wizard artificial. Prévia de importação, aceite, aprovação e transições reais continuam como operações próprias; essa regra visual não elimina guardas/confirmações funcionais. Antes de coletar campos pessoais, explicar uso/obrigatoriedade e disponibilizar as informações de [Dados pessoais](DATA_PRIVACY.md), também apresentadas no acesso conforme a versão vigente.

- Label persistente, obrigatoriedade, formato e exemplo quando necessário. Campo desabilitado deve ter motivo compreensível quando isso afeta a tarefa.
- Validar no momento útil; associar erro ao campo e preservar dados após falha. Em formulário longo, orientar até o erro relevante.
- Na confirmação, indicar o objeto/versão e a ação real: salvar rascunho, publicar, aprovar ou solicitar ajuste. Não usar “Concluir” para consequências distintas.
- Durante envio, evitar submissão duplicada e mostrar estado sem remover contexto. Erro de rede não autoriza declarar falha definitiva de operação cujo resultado é desconhecido; contrato define reconciliação/retry.
- Sucesso descreve o que foi confirmado e próximo passo. Preview local permanece explicitamente demonstrativo. Upload e envio externo têm estados próprios.

## Estados e conteúdo

Loading pertence à região carregada; não esconder shell funcional sem necessidade. Atualização de filtro deve indicar que dados estão sendo atualizados, sem apresentar recorte anterior como atual. Skeleton só quando ajuda a compreender a composição.

Vazio explica causa e próxima ação compatível com o papel. Erro informa operação afetada e recuperação possível. Acesso negado não aparece como lista vazia. Dado parcial/incompleto precisa de limite claro; não completar métricas com ficção.

Linguagem em português, direta e consultiva: objeto, situação e próxima ação. Data e duração têm formatação comum; mostrar timezone/referência quando relevantes. Cores e ícones complementam texto; não são a única forma de comunicar estado.

Exemplos propostos: “Nenhum lançamento neste período”, “Não foi possível carregar o extrato. Tentar novamente”, “Prévia local; nenhum aviso publicado”. Texto final depende da operação real.

## Responsividade e acessibilidade

Larguras de verificação herdadas do plano: 1440, 1280, 1024 e 390 px; não são breakpoints obrigatórios. Definir comportamento pelo espaço necessário ao conteúdo e testar também larguras intermediárias/zoom.

Navegação essencial funciona por toque e teclado. Em telas estreitas, priorizar identidade e próxima ação, sem ocultar contexto decisivo. Tabelas largas usam overflow intencional ou representação alternativa especificada; não desaparecer com colunas sem analisar impacto. Não depender de hover.

Verificar hierarquia de headings, labels, ordem e visibilidade de foco, anúncio de estados/erros, contraste nos pares reais, leitura sem cor, ampliação e movimento reduzido. Critérios e evidência ficam na [Política de mudança](CHANGE_POLICY.md); nenhuma conformidade foi certificada aqui.

## Como especificar e validar uma tela

Para cada tarefa, preencher a ficha do [Catálogo de fluxos](FLOW_CATALOG.md) com anatomia, estados, ações, política de continuidade e critérios observáveis. Usar layout existente como referência identificada, não como aprovação de todos os detalhes.

Antes de declarar experiência validada: executar tarefa com dados sintéticos coerentes; cobrir erro/vazio/negação; verificar Cliente/Admin pertinentes e viewport/teclado; registrar evidência visual da revisão. Quando houver validação com usuários, registrar tarefa, perfil, resultado e dificuldades; não inventar pesquisa ou taxa de sucesso.
