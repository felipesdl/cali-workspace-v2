# Contexto de produto e vocabulário

Atualização: 26/10/2026. Documento de entrada para produto, design, desenvolvimento e IA. Consolida contexto e decisões expressas já registrados, sem aprovar funcionalidades adicionais.

## Problema e resultado esperado

CALI e empresas atendidas precisam acompanhar a execução da assessoria, decisões, entregas, horas e evolução do trabalho com contexto e rastreabilidade. O sistema deve responder: o que aconteceu, qual é a situação, quem precisa agir e qual o próximo passo.

Princípio registrado no README e handoff: **CALI administra; cliente acompanha, participa, valida e avalia dentro do acesso contratado/autorizado.** Isso não significa que toda tela do cliente seja somente leitura; ações específicas exigem contrato e permissão próprios.

Base de evolução confirmada pelo usuário: este repositório V2. Escopo confirmado: padronizar todos os fluxos de Cliente e Admin e consolidar bordô, marfim e dourado. Oficial é referência somente leitura nesta etapa.

## Regras alvo decididas em 26/10/2026

Há até quatro acessos Cliente equivalentes por empresa, sem cadastro principal como hierarquia de acesso. Todos mantêm Equipe e podem informar/consultar os dados privados da própria empresa; Admin também. Cliente faz lançamento inicial das métricas mensais e somente Admin corrige valores já lançados. Isso não transforma Cliente em administrador de contrato nem muda fórmula de indicador. Pessoa focal de uma campanha é destinatária operacional, sem privilégio de login.

Adesão registrada antecede convite; aceite de uso é obrigatório no primeiro acesso e a cada nova versão, com bloqueio se a verificação falhar. Finalidade e tratamento de campos pessoais devem estar documentados e refletidos nas informações apresentadas no acesso, conforme [Dados pessoais](DATA_PRIVACY.md).

DISC possui três relatórios: respondente recebe somente o próprio PDF por e-mail; avaliador é interno da CALI, sem opção de liberação; Cliente recebe somente gestão após aprovação/liberação CALI. Esta regra (DEC-13) substitui DEC-07. Critérios de respostas, parecer, assinatura/protocolo e canais estão em [Regras de produto](PRODUCT_RULES.md).

Admin pode reabrir o mesmo entregável/relatório com motivo e histórico. Item fica indisponível ao Cliente até nova liberação. Entregável corrigido exige nova aprovação; nova ciência de relatório depende de solicitação do Admin. Validações anteriores permanecem históricas, sem serem atribuídas automaticamente ao conteúdo corrigido.

Fonte das decisões: [registro vigente](DECISIONS.md), incluindo DEC-13 a DEC-18 da revisão de produto. Base de paridade: funcionamento oficial testado pela Patrícia em 26/10, [publicação 83](BASELINE_REFERENCE_2026-10-26.md). Regras alvo não certificam políticas já aplicadas na V2. Chat não gera e-mail; pedido mensal aparece só para Cliente; resumo diário é para Admins ativos da CALI, nunca Cliente/staff; contrato Admin definido em RESUMO-01 / DEC-19. Versão Partner fica para sua fase e digest de chat das 08h não retorna.

## Atores e responsabilidades

| Ator/conceito | Responsabilidade contextual | Limite |
| --- | --- | --- |
| Administradora CALI | Conduzir contas, planejamento, execução, revisão e publicação | Permissão efetiva exige contrato e validação no backend |
| Cliente | Acompanhar sua empresa e executar ações específicas de participação/validação | Não recebe acesso Admin pelo alternador de demonstração |
| Partner interno | Colaborar na operação atribuída; papel encontrado no código oficial | Não equivale ao plano comercial CALI Partner; matriz ainda precisa ser reconciliada |
| Colaborador da empresa | Pessoa cadastrada no domínio Equipe | Cadastro não cria login nem concede acesso |
| Visitante/destinatário externo | Usar fluxo público específico quando existir no contrato oficial | Não herda acesso ao workspace nem às demais empresas |

Este quadro explica papéis; não substitui a matriz executável de permissões em [Dados e contratos](DATA_CONTRACTS.md).

## Vocabulário de trabalho

| Termo | Significado de trabalho | Distinção importante |
| --- | --- | --- |
| Conta/empresa | Organização atendida e seu contexto de acesso | Nome usado na UI não é identidade estável nem autorização |
| Plano | Modalidade comercial contratada | Não define sozinho todos os direitos de acesso |
| Ciclo de serviço | Recorte contratual de acompanhamento/consumo | Não presumir equivalência com mês civil |
| Projeto | Organização de objetivo, escopo, responsáveis e execução | Não é apenas agrupamento visual de cards |
| Frente/workstream | Divisão de trabalho vinculada ao projeto/contratação | Reconciliar catálogo e nomes do oficial antes de mapear tipos |
| Entregável | Resultado sujeito ao fluxo de execução, revisão e validação pertinente | Documento anexado e entregável não são sinônimos |
| Tarefa/subtarefa | Unidade executável vinculada ao trabalho | Sua conclusão não implica aprovação de todo o entregável |
| Cronograma | Organização temporal dos marcos e dependências | Calendário também pode exibir compromissos de outra natureza |
| Lançamento de horas | Registro de atuação, com origem e vínculo | Não representa controle de ponto; timer/manual não podem duplicar consumo |
| Ocorrência | Assunto registrado com contexto, acompanhamento e transições | Não transforma nota interna em conversa pública |
| Documento | Arquivo/conteúdo com versão e acesso definidos | Presença no catálogo não significa publicação ou ciência |
| Relatório | Leitura de fatos do período, com curadoria e versão | Conteúdo demonstrativo não é resultado oficial |
| Ciência | Registro de conhecimento de um conteúdo específico | Não equivale a aprovação, assinatura ou entrega de e-mail |
| Publicação | Disponibilização autorizada de uma versão ao público correto | Salvar rascunho não significa publicar |
| Indicador | Resultado com regra, origem, período e qualidade conhecidos | Número fictício não define fórmula nem meta |
| Aviso/notificação | Conteúdo comunicado e sinalização de evento, respectivamente | Ver aviso, confirmar ciência e receber comunicação são eventos distintos |

Definições acima orientam leitura. Campos, estados e relações exatos são fechados por domínio, com evidência do contrato oficial.

## Jornadas e limites

Jornadas a cobrir: adesão/acesso; planejamento; execução; interação; entrega; fechamento/relatório; renovação/encerramento. Mapa de fluxos e responsáveis: [Catálogo de fluxos](FLOW_CATALOG.md).

O handoff caracteriza CALI como assessoria estratégica, não como HRIS/DP completo. Não acrescentar folha de pagamento, férias, ponto, recrutamento completo ou avaliação de desempenho individual. O perfil comportamental DISC é linha oficial do produto e integra o escopo da V2, com relatórios do respondente, avaliador e gestão e seus públicos distintos. Módulos adicionais existentes são rastreados na paridade; não autorizar expansão por omissão ou analogia.

Valores demonstrativos, quantidades de horas e textos de fixtures não definem contrato comercial. Não criar funcionalidades/bloqueios de plano com base em semelhança de tela. Não reformular indicadores de headcount nesta etapa documental.

## Como usar antes de construir

1. Identificar ator, tarefa e resultado observável.
2. Localizar fluxo no catálogo e regras/decisões aplicáveis.
3. Separar proposta de experiência, contrato de dados e comportamento já implementado.
4. Resolver somente as pendências que bloqueiam o recorte autorizado.
5. Atualizar a fonte dona da mudança; não criar nova definição concorrente em um handoff.

Fontes: [README](../README.md), [handoff histórico](HANDOFF_MESTRE_CALI_WORKSPACE_V2_2026-10-08.md), [baseline](BASELINE_2026-10-25.md), [cruzamento posterior das fichas](flows/SOURCES.md) e confirmações do usuário em 25/10/2026. Nenhuma consulta ao banco ativo foi realizada.
