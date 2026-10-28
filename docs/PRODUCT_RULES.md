# Regras de produto CALI

Atualização: 28/10/2026. **Contrato de produto confirmado, sem implementação nesta entrega.** Fonte canônica das regras operacionais e de experiência consolidadas após a revisão da Patrícia e autorização do Felipe. Fontes: [decisões e públicos](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417356971), [regras e prioridades](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417361907) e complemento de interface fornecido na conversa de 26/10.

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
| NEG-02 | Resumo diário CALI às 19h de Brasília, inclusive fins de semana | Admins ativos; Cliente/staff não recebem; ações do dia por empresa em dois blocos e horas; sem chat, pendências antigas ou envio sem atividade; Partner recebe em etapa futura com conteúdo ainda a definir; ver RESUMO-01 |
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

## Acesso Admin — DEC-21, confirmação de 28/10

Admin deve cadastrar e confirmar o segundo fator antes de entrar, inclusive no primeiro uso. Falha de verificação mantém o acesso bloqueado e oferece retry; não transportar exceções de ausência de fator, erro ou ambiente QA do oficial. Cliente continua com o contrato já definido. A decisão está documentada; implementação e testes reais ainda pendentes. Ver [contratos de acesso](contracts/ACCESS_COMPANIES.md).

## Registro de adesão — DEC-23

A investigação não localizou operação própria no cadastro/primeiro acesso. Felipe autorizou criar o registro mínimo da adesão da empresa, distinto do aceite individual dos termos e comprovado antes do convite (DEC-08). Contrato V2 definido; persistência e operação real ainda pendentes. Não inventar assinatura, anexo ou prazo por consequência dessa criação. [Detalhes e limites](contracts/ACCESS_COMPANIES.md#registro-próprio-de-adesão--dec-23).

## RESUMO-01 — contrato Admin definido; Partner posterior

Fonte: [resposta da Patrícia em 26/10](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6418618652). O resumo já existe no oficial e é referência da V2. DEC-19 fecha o produto Admin; detalhes da versão Partner ficam para sua fase, sem bloquear Admin/Cliente.

| Tema | Regra vigente |
| --- | --- |
| Público atual | Admins ativos que conduzem o trabalho CALI; Cliente e equipe interna/staff não recebem |
| Partner | Receberá em etapa posterior; Patrícia definirá empresas abrangidas e presença de horas nessa versão. Não reutilizar automaticamente o conteúdo global Admin |
| Organização | Por empresa; empresas com mais movimento primeiro; dentro de cada empresa, “O cliente fez” antes de “A CALI fez” |
| O cliente fez | Ações Cliente que geraram aviso à CALI: dados do mês, aprovação, resposta, documento e solicitação |
| A CALI fez | Ações CALI que geraram aviso ao Cliente: entregável, relatório liberado e lembrete |
| Horas | Horas do dia por empresa e total geral; fonte/data de referência reconciliadas no contrato técnico |
| Item | Horário, título do aviso, até 180 caracteres do texto e link para abrir no aplicativo |
| Limite visual | Até 12 itens por bloco de cada empresa; excedente exibido como “e mais N” |
| Totais no topo | Ações dos clientes, ações da CALI e horas registradas; limite visual não redefine os totais |
| Período | Somente dia corrente em Brasília, janela de calendário 00h–23h59; pendência antiga não reaparece por continuar pendente |
| Envio | Todos os dias às 19h de Brasília, inclusive fim de semana; sem atividade elegível não envia |
| Exclusões | Mensagens de chat e avisos internos da equipe/staff |
| Resumo de chat das 08h | Desligado desde 18/10 segundo a Patrícia; não reativar na V2 |

O envio das 19h utiliza os dados existentes quando a consulta ocorre. A janela de calendário até 23h59 não faz aquela mensagem conter atividades futuras. Não prometer fechamento integral do dia, reenvio ou recuperação automática posterior ao envio: essas capacidades não foram solicitadas nem comprovadas. Detalhamento técnico e diferenças observadas: [Dados e contratos](DATA_CONTRACTS.md#contrato-do-resumo-admin-e-limites-da-fonte).

Aceite futuro: Admin ativo/inativo/sem e-mail; Cliente/staff sem recebimento; dia sem atividade; dia só com horas; duas empresas; ordem dos blocos e empresas; 0/12/13 itens por bloco; 180/181 caracteres; totais além dos itens visíveis; ausência de chat/staff; não repetir pendência antiga; execução em fim de semana/fuso Brasília; duplicidade/retry e limite de volume. Código e migrations são evidência estática, não teste do envio em produção.

## Privacidade e paridade

Finalidade, leitores e guarda dos campos de Equipe são documentados em [Dados pessoais e informação no acesso](DATA_PRIVACY.md) e apresentados de forma correspondente na experiência de entrada. Não inventar prazo de retenção nem reutilizar o prazo de eliminação da empresa para todos os campos.

Cada entrega deve conferir seu checklist contra a publicação 83 e o contrato atual, registrando diferença aprovada. As regras acima são produto confirmado; a afirmação de que já existem no aplicativo não substitui teste de UI, banco, arquivo ou envio da V2.
