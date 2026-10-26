# Regras de produto CALI

Atualização: 26/10/2026. **Contrato de produto confirmado, sem implementação nesta entrega.** Fonte canônica das regras operacionais e de experiência consolidadas após a revisão da Patrícia e autorização do Felipe. Fontes: [decisões e públicos](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417356971), [regras e prioridades](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417361907) e complemento de interface fornecido na conversa de 26/10.

As regras definem resultado e público; não determinam automaticamente schema, biblioteca ou comprovação de produção. O código de referência é a [publicação 83](BASELINE_REFERENCE_2026-10-26.md). O [registro de decisões](DECISIONS.md) preserva substituições; as fichas detalham operações e casos; DS/UX transformam intenção em composição verificável. Não duplicar versões concorrentes das regras.

## Públicos e responsabilidades

- Cliente administra Equipe e participa das operações autorizadas de sua empresa; até quatro acessos equivalentes, sem hierarquia de principal. Colaborador cadastrado não é login.
- Admin conduz operação, correções e liberação; aprovação interna CALI é diferente de aprovação de entregável pelo Cliente e de ciência de relatório.
- Respondente DISC é destinatário do próprio PDF; ser respondente não concede acesso à empresa, ao avaliador ou ao relatório de gestão.
- Pessoa focal é destinatária operacional da campanha; não cria acesso privilegiado ou substitui a equivalência dos acessos Cliente.
- Prioridade de construção: rotina Admin/Cliente, DISC e demais fluxos Admin/Cliente, Partner em etapa posterior. A área Partner completa exige recorte próprio antes de implementação.

## Interface e conteúdo

| ID | Regra confirmada | Critério de construção e aceite |
| --- | --- | --- |
| UI-01 | Somente tema claro em Admin e Cliente | Sem alternador/modo noturno; verificar ambos os layouts |
| UI-02 | Cards separados e alinhados; referência de 14–16 px | DS define token consistente e verifica alinhamento em desktop/mobile; não comprimir conteúdo até encostar |
| UI-03 | Barras de controles organizadas em uma linha | Priorizar linha única no espaço disponível; em largura estreita, preservar acesso com composição responsiva ou rolagem controlada, sem cortar ações |
| UI-04 | Rolagem com apresentação discreta, sem barra visual permanente | Não bloquear rolagem nem esconder sua existência; garantir uso por toque/teclado e indicação de conteúdo adicional; respeitar necessidades de acessibilidade |
| UI-05 | Notas e observações complementares no rodapé | Erro de campo, impedimento de envio e alerta de ação permanecem associados ao contexto que precisam explicar |
| UI-06 | Datas, contagens e metadados compactos, sem card próprio | Hierarquia secundária legível; não reduzir tipografia para compensar composição inadequada |
| UI-07 | Fotos e logos quadrados, cantos de 7 px; não circulares | Token específico e proporção preservada nos consumidores |
| UI-08 | Folha e lima como elementos de marca | Usar assets CALI identificados; não fabricar símbolos como substituto dos oficiais |
| UI-09 | Alertas de atenção/erro em âmbar ou vermelho, com orientação | Texto informa situação e ação; sucesso e informação mantêm semântica própria; cor não é a única indicação |
| UI-10 | Cadastros em formulário único dividido em seções | Não criar wizard artificial; etapas funcionais de importação, prévia e confirmação continuam conforme o fluxo |
| UI-11 | Diálogos no padrão atual CALI, inclusive exclusão | Identificar referência visual na publicação 83 e usar componente comum com foco, teclado e confirmação do objeto/efeito |
| UI-12 | Cards sem redundância de texto | Evitar repetição desnecessária de título/rótulo; não eliminar palavras indispensáveis ao significado ou à acessibilidade |
| UI-13 | PDFs usam Inter, sem serifa | Verificar fonte/fallback na geração e coerência com a versão aprovada |
| UI-14 | Toda entrega já funciona em celular | Mobile participa do aceite de cada fluxo, não de uma fase final de correção |

Conteúdo para Patrícia, clientes e produto usa português claro, consultivo e consistente com a voz CALI. O estilo de resposta técnica das sessões do Felipe é preferência pessoal; não se propaga ao produto ou aos demais agentes/usuários.

## Negócio e comunicação

| ID | Regra confirmada | Contrato e aceite |
| --- | --- | --- |
| NEG-01 | Mensagem de chat nunca gera e-mail | Não criar disparo de e-mail por mensagem; testar notificações sem introduzir esse efeito |
| NEG-02 | Resumo diário por e-mail às 19h | Existência/horário declarados; conteúdo, público, recorte e regras detalhadas aguardam resposta da Patrícia em RESUMO-01 |
| NEG-03 | Atrasos e menções com `@` avisam a pessoa pertinente/citada | Público e objeto corretos; reconciliar canais no oficial sem pressupor e-mail em toda operação |
| NEG-04 | Pedido de dados do mês aparece somente para Cliente | Admin acompanha os dados e a operação administrativa, sem receber a solicitação como tarefa de preenchimento Cliente |
| NEG-05 | Relatórios têm assinatura virtual e foto da Patrícia e protocolo `CALI-TIPO-AAAA-NNNNNN` | Identidade/protocolo vinculados à revisão aprovada e rastreáveis; não alegar certificação digital ou mecanismo de assinatura não comprovado |
| NEG-06 | Geração, aprovação, liberação e envio entram na auditoria | Eventos distintos com autor, objeto/revisão e resultado; salvar/enfileirar não equivale a entregar |
| NEG-07 | Respondente recebe seu relatório somente em PDF por e-mail | Após resposta, tela de agradecimento; sem resultado individual na página ou exposição por token público |
| NEG-08 | Metodologia e cálculos DISC não aparecem ao respondente | Projeção pública e conteúdo do PDF do respondente não expõem material interno reservado |
| NEG-09 | Convite DISC vence em sete dias, no fim do dia em Brasília | Reconciliação do marco inicial no contrato; representar fim do dia no fuso `America/Sao_Paulo`, sem herdar timezone do navegador |
| NEG-10 | No máximo três lembretes DISC, segunda a sexta, das 8h às 18h | Contagem/repetição e janela testadas; não inventar regra de feriados ou cadência não encontrada |
| NEG-11 | Pessoa focal avisada na véspera e no encerramento | Destinatário operacional correto; sem transformar o contato em Cliente principal |
| NEG-12 | Gestão requer cinco respostas; abaixo de 15 usa palavras, sem números/gráficos | Menos de cinco não libera relatório de gestão; cinco a 14: qualitativo; a partir de 15 segue composição validada; testar 4/5/14/15 |
| NEG-13 | Gestão não apresenta nomes de respondentes | Projeção/tela/PDF e anexos não reidentificam pessoas por listagem nominal |
| NEG-14 | Aprovar gestão exige resultado buscado pela empresa e parecer da Patrícia | Aprovação congela revisão, assinatura e protocolo; mudança de conteúdo retorna a rascunho, exige nova aprovação e preserva histórico |
| NEG-15 | Admin/Cliente primeiro; Partner depois | Roadmap por entregas completas mantém cobertura global e posterga a área Partner; não remover fluxos silenciosamente |
| NEG-16 | Textos seguem a voz CALI | Revisar rótulos, mensagens, e-mails e PDFs; linguagem da sessão técnica não é linguagem do produto |

## Relatórios DISC e entrega

| Relatório | Público | Entrega permitida |
| --- | --- | --- |
| Respondente | Próprio respondente | PDF por e-mail; página final apenas de agradecimento |
| Avaliador | Uso interno da CALI | Sem opção de liberação ao Cliente ou ao respondente |
| Gestão | Gestão da empresa, após aprovação/liberação CALI | Empresa com conta: aplicativo e aviso por e-mail; empresa sem conta: PDF no e-mail do gestor |

DEC-13 substitui DEC-07. Empresa com conta não recebe poder de liberar avaliador; empresa sem conta não recebe acesso ao workspace por consequência do envio de PDF. Reabrir/corrigir preserva identidade e histórico. Nova aprovação interna e nova liberação são necessárias após alteração; nova ciência do Cliente segue DEC-12, somente se Admin solicitar.

## RESUMO-01 — definição detalhada pendente

Felipe encaminhou questionamento à Patrícia. Não preencher por suposição nem interpretar “tudo” como especificação. Registrar resposta para:

1. Destinatários Cliente e CALI; mesmos conteúdos ou versões por papel.
2. Assuntos incluídos/excluídos, sem disparo de e-mail por mensagem de chat.
3. Campos de cada item: assunto, situação, prazo, pessoa que age, link e conteúdo adicional desejado.
4. Período coberto e repetição de pendências antigas.
5. Fuso, dias de envio e comportamento sem novidades/pendências; horário citado de 19h não fecha essas escolhas.
6. Ordem/seções e exemplo de mensagem Cliente/CALI.

Até resposta, nenhum público, conteúdo ou agenda detalhada do resumo está aprovado para implementação. A pendência bloqueia esse resumo, não os demais fluxos ou comunicações cujo contrato esteja definido.

## Privacidade e paridade

Finalidade, leitores e guarda dos campos de Equipe são documentados em [Dados pessoais e informação no acesso](DATA_PRIVACY.md) e apresentados de forma correspondente na experiência de entrada. Não inventar prazo de retenção nem reutilizar o prazo de eliminação da empresa para todos os campos.

Cada entrega deve conferir seu checklist contra a publicação 83 e o contrato atual, registrando diferença aprovada. As regras acima são produto confirmado; a afirmação de que já existem no aplicativo não substitui teste de UI, banco, arquivo ou envio da V2.
