# Registro de decisões e questões abertas

Atualização: 28/10/2026. Registra estado e evidência; regras completas permanecem nos documentos donos. Data recente ou presença em código não transforma uma hipótese em aprovação de produto.

## Decisões de produto e escopo

| ID | Decisão | Evidência na conversa | Documento dono |
| --- | --- | --- | --- |
| DEC-01 | Esta V2 é a base de evolução | “esse repo que coloquei aqui é o v2, ele é a base do sistema agora” | [Arquitetura](ARCHITECTURE.md) |
| DEC-02 | Padronizar todos os fluxos de Cliente e Admin | “a gente vai atacar todos os fluxos” | [Roadmap](ROADMAP.md) |
| DEC-03 | Consolidar identidade existente | Resposta afirmativa a bordô, marfim e dourado | [Design system](DESIGN_SYSTEM.md) |
| DEC-04 | Oficial consultável somente em leitura nesta etapa | “Sim, somente leitura” | [AGENTS](../AGENTS.md) e [baseline](BASELINE_2026-10-25.md) |
| DEC-05 | Até quatro acessos Cliente equivalentes por empresa, sem hierarquia de cliente principal; todos podem manter Equipe | Resposta expressa: todos mantêm equipe e a remoção de um acesso não depende de principal | [Matriz alvo](PERMISSIONS.md), FLOW-02/08 |
| DEC-06 | Admin pode reabrir o mesmo entregável ou relatório para corrigir, com motivo e histórico | “Admin pode reabrir o mesmo item, com motivo e histórico” | FLOW-06/12 e [matriz alvo](PERMISSIONS.md) |
| DEC-07 | **Substituída por DEC-13.** Decisão anterior permitia individual e agregado liberados pela CALI | Resposta anterior preservada: “Individual e agregado, ambos liberados pela CALI” | Histórico de FLOW-17; não usar como alvo vigente |
| DEC-08 | Adesão registrada antes do convite; termos obrigatórios no primeiro acesso e a cada nova versão | Resposta expressa à opção que também bloqueia entrada se falhar a verificação do aceite | FLOW-01/02 |
| DEC-09 | Cliente informa e consulta dados privados de Equipe da própria empresa; Admin também | “Cliente informa e consulta; Admin também” para remuneração, revisão salarial, gênero e filhos | FLOW-08 e [matriz alvo](PERMISSIONS.md) |
| DEC-10 | Cliente faz lançamento inicial das métricas mensais de Equipe; correções posteriores somente pelo Admin | “Cliente lança; correções posteriores somente pelo Admin” | FLOW-08 |
| DEC-11 | Item reaberto fica indisponível ao Cliente até nova liberação | “Item fica indisponível até nova liberação” | FLOW-06/12 |
| DEC-12 | Após correção liberada, entregável exige nova aprovação; relatório exige nova ciência somente quando Admin solicitar | “Nova aprovação do entregável; nova ciência do relatório só quando Admin solicitar” | FLOW-06/12 |
| DEC-13 | DISC: Cliente somente gestão; avaliador interno CALI sem liberação; respondente somente PDF próprio por e-mail e tela de agradecimento | Revisão da Patrícia em 26/10 e autorização posterior do Felipe; substitui DEC-07 | [Regras](PRODUCT_RULES.md), FLOW-17 e [matriz](PERMISSIONS.md) |
| DEC-14 | Funcionamento oficial de 26/10, publicação 83 testada pela Patrícia, é base de paridade; oficial permanece somente leitura | Felipe confirmou usar como funciona agora; metadados identificam publicação 83 no SHA já utilizado | [Referência funcional](BASELINE_REFERENCE_2026-10-26.md) |
| DEC-15 | Caveman somente nas sessões técnicas do Felipe; conteúdo para Patrícia/clientes/produto segue a voz CALI | Revisão da Patrícia e encaminhamento aprovado pelo Felipe | [AGENTS](../AGENTS.md), [UX/UI](UX_UI.md) |
| DEC-16 | Consolidar regras operacionais e de interface da revisão de produto com critérios técnicos de uso/legibilidade/responsividade | Comentários e complemento da Patrícia; definição posterior do resumo Admin registrada em DEC-19 | [Regras](PRODUCT_RULES.md), DS/UX e fichas |
| DEC-17 | Construir por fluxos completos, começando pela rotina Admin/Cliente, depois DISC; Partner posterior | Revisão de produto e autorização do Felipe; preserva cobertura dos demais fluxos | [Roadmap](ROADMAP.md) |
| DEC-18 | Finalidades, leitores e guarda são documentados e refletidos na informação/validação do acesso | Felipe direcionou o tema à documentação e validação do usuário ao acessar; nenhum prazo novo definido | [Dados pessoais](DATA_PRIVACY.md), FLOW-01/08/18 |
| DEC-19 | Resumo das 19h somente para CALI: Admins ativos; Cliente/staff não recebem; contrato Admin de RESUMO-01 fechado; Partner posterior com conteúdo a definir; resumo de chat das 08h não retorna | [Resposta da Patrícia](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6418618652), 26/10/2026 | [Regras](PRODUCT_RULES.md#resumo-01--contrato-admin-definido-partner-posterior), FLOW-14 e [Dados](DATA_CONTRACTS.md) |

DEC-05 a DEC-12 registram a rodada inicial de 26/10. DEC-13 a DEC-18 incorporam a revisão de produto autorizada depois: **DEC-13 é o alvo vigente do DISC e substitui DEC-07**. Demais decisões anteriores continuam válidas. Fontes: [revisão da Patrícia](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417356971), [regras/prioridades](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417361907) e confirmações do Felipe. Nenhuma decisão documental autoriza integração, deploy, migration ou mudança de fórmula.

## DEC-20 — Stack e organização de dados confirmadas em 27/10/2026

Felipe escolheu TanStack Form (`@tanstack/react-form`), Query e Router, date-fns, Axios e Zod, com API organizada por módulos, hooks próprios e keys padronizadas por constantes `as const`. Versões foram selecionadas conforme compatibilidade; não foi exigida migração de React. Vite permanece o bundler; seu uso permite diferentes routers, e TanStack Router é a escolha explícita desta base.

Implementação local: `src/api/modules/companies` possui schemas, keys, service, composição dos mocks de desenvolvimento e hooks de consulta; filtros usam Form/Zod e URL. Identificadores constantes e factories de tuplas substituem TS enums para query keys. Axios fica na fronteira de transporte; não duplicar Query em context. Mutation só será criada com operação de escrita real e contrato reconciliado. Versões e gates: [runbook](RUNBOOK.md); fronteiras: [arquitetura](ARCHITECTURE.md).

Autorização desta rodada: sincronizar main e iniciar fase 1 localmente. Sem Supabase oficial, migrations, comunicações ou publicação.

## DEC-21 — MFA obrigatório para Admin, inclusive primeiro uso

Em 28/10, após explicação dos dois passos e das exceções encontradas no oficial, Felipe confirmou: “Sim, liberar Admin só após confirmar os dois passos”. Exigir cadastro e validação do autenticador antes de liberar área/poderes Admin; ausência de fator não libera, falha mantém bloqueio com retry. A decisão não altera o fluxo Cliente nem resolve automaticamente a divergência de allowlist/perfil ativo. Não há bypass por ambiente QA. Contrato em [Acesso/empresas](contracts/ACCESS_COMPANIES.md); implementação e prova no backend continuam pendentes.

## DEC-22 — Ambiente local dedicado para a fase 1

Definição técnica de 28/10 no escopo autorizado: Supabase CLI 2.122.0/Docker local, projeto/rede dedicados, portas de loopback, dados sintéticos, captura local de e-mail e nenhum vínculo com projeto hospedado. Configuração/preflight foram implementados em 28/10; ativação/baseline e provas locais ocorreram em 29/10, com a topologia corrigida em DEC-25. Esta escolha não autoriza executar migrations do oficial, importar dados/credenciais, publicar ou alterar outros projetos. [Definição e evidências](LOCAL_ENVIRONMENT.md).

## DEC-23 — Investigar e criar registro próprio de adesão quando ausente

Em 28/10, Felipe pediu investigar cadastro/primeiro acesso e, se não houver registro, criar um. Inspeção do cadastro/documentos, TermsGate, workspace-access e dos 166 SQLs da referência encontrou contratos/aditivos e aceite individual dos termos, sem registro autônomo da adesão da empresa. Criado contrato mínimo novo da V2: empresa, referência da formalização, autoria e instante do servidor; operação Admin, antes do convite, preservando DEC-08. Não foi inventada assinatura digital, upload obrigatório ou prazo de validade. Persistência/servidor foram implementados/testados localmente em 29/10 (DEC-25). Formato/comprovação documental, UI e gate de convite permanecem para o fluxo aplicável. [Investigação e alvo](contracts/ACCESS_COMPANIES.md#registro-próprio-de-adesão--dec-23).

## DEC-24 — Tailwind e migração incremental de estilos

Em 28/10, Felipe aprovou integrar Tailwind à branch atual e migrar o que já foi construído, evoluindo o legado junto dos commits dos fluxos e deixando a limpeza global para o fim. Implementados Tailwind 4.3.3, plugin Vite e ordenação Prettier; Button, Field e empresas migrados com remoção dos três CSS substituídos. Tokens/identidade e contratos funcionais permanecem no DS/domínio. Prefixo `tw:`, ausência de Preflight e utilities sem layer preservam a coexistência com o legado; [política e inventário](DESIGN_SYSTEM.md#inventário-da-migração-de-estilos). Não implica migrar todas as prévias nesta rodada nem encerrar a fase 1.

## DEC-25 — Baseline local de adesão e ingress isolado

Definição técnica de 29/10 no recorte autorizado por Felipe: implementar/testar baseline e persistência de adesão local, mantendo PR #2 atualizado. Baseline nova, sem copiar/executar migrations do oficial; papel persistido ativo/Admin, AAL2 e fator TOTP verificado são a autoridade única na operação, sem allowlist de e-mails ou bypass por fator ausente. Referência, autoria/instante e histórico são protegidos no servidor; comprovação documental, convites e aceite individual não são fabricados por essa gravação.

O runtime demonstrou que rede exclusivamente internal não publica portas no host. Serviços de negócio permanecem somente nessa rede; ingress HAProxy dedicado, fixado por digest, usa segunda bridge exclusiva e publica quatro portas em 127.0.0.1, com destinos fixos/forwarding desligado. Bootstrap inicial exclui PostgREST até aplicar explicitamente o schema; migrations/seeds de negócio continuam desligados. Provider de e-mail precisa ficar habilitado para login; signup público permanece bloqueado pela configuração global e foi testado. [Topologia, provas e comandos](LOCAL_ENVIRONMENT.md), [persistência e limites](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910). Não é decisão de produto nova nem autorização de produção.

## DEC-26 — Códigos/termos locais e sessão preparada por contrato

Continuidade autorizada por Felipe em 29/10: implementar códigos e termos versionados no ambiente isolado, preparando sessão/guardas da SPA e mantendo PR #2 atualizado. DDL ausente de códigos recebe implementação nova V2; preservar seis dígitos/10 minutos/120 segundos/cinco tentativas, com locks e uso único. Entrega é somente Mailpit; geração Auth posterior ao consumo falha fechada, sem prometer atomicidade distribuída. Não provisionar perfil/convite por e-mail nem liberar Partner nesta etapa.

Termos têm conteúdo/digest imutáveis por versão, aceite corrente por ator/instante do servidor e nova confirmação a cada publicação. Só textos sintéticos foram preparados; nenhum conteúdo jurídico/prazo de guarda de produção foi inventado. Sessão vigente é requisito no servidor; corte de perfil/empresa revoga sessões e códigos pendentes sem recuperar essas credenciais ao reativar. Controller e Router recebem fonte por injeção, mas adapter/eventos/telas da SPA continuam pendentes; demo não é autenticação. [Contrato](contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910), [operação](LOCAL_ENVIRONMENT.md).

## Propostas técnicas/de experiência

Manter React/Vite; usar router; separar adaptadores/hooks; adotar cache de servidor; definir tokens, escala tipográfica, composição e padrões de interação são propostas em [Arquitetura](ARCHITECTURE.md), [Design system](DESIGN_SYSTEM.md) e [UX/UI](UX_UI.md). A seleção DEC-20 e o primeiro consumidor demo estão implementados; demais padrões continuam propostos até possuir consumidor e validação.

Decisões rotineiras de implementação dentro de um recorte autorizado podem ser tomadas e registradas pelo implementador. Questão aberta não exige perguntar tudo ao usuário: primeiro conferir código, contratos e evidência disponíveis; perguntar somente o que continuar bloqueando uma decisão de produto/escopo.

## Prioridade de resolução antes das fases

Revisão de prioridade original: 25/10/2026. Atualização de execução: fase 1 iniciada localmente em 27/10, sem integração real. As 24 referências não são 24 decisões a repassar ao usuário. Há decisão de produto, informação técnica ausente e comprovação que só existe durante implementação/homologação.

### Decisões de produto que afetam os contratos da V2

As questões abaixo delimitam permissões, exposição de dados e ciclo de vida. Estado atualizado conforme respostas expressas; opção apresentada ou recomendação não constitui resposta nem aprovação.

| ID de resolução | Decisão necessária | Impacto | Referências | Estado |
| --- | --- | --- | --- | --- |
| PROD-01 | Quantidade e equivalência dos acessos Cliente; manutenção de Equipe | Matriz de papéis, telas de acesso e escrita de pessoas/revisão mensal | REF-03, REF-11 | Resolvida: DEC-05 |
| PROD-02 | Correção após aprovação de entregável ou disponibilização de relatório | Estados, histórico, publicação e operações permitidas | REF-07, REF-15 | Resolvida: DEC-06/11/12 |
| PROD-03 | Públicos dos três relatórios DISC | Projeção, rotas, arquivos, entrega e liberação | REF-20 | Resolvida: DEC-13, substitui DEC-07 |
| PROD-04 | Adesão, momento do convite, aceite e falha de verificação | Onboarding e bloqueio de acesso sem comprovação | REF-02, OPEN-02 | Resolvida: DEC-08 |
| PROD-05 | Informação e consulta de dados privados por Cliente/Admin | Campos de salário/gênero/filhos, formulário e projeção privada | REF-10 | Resolvida: DEC-09 |
| PROD-06 | Lançamento inicial e correção de métricas mensais | Escrita e auditoria; não redefine fórmulas | REF-10, REF-11 | Resolvida: DEC-10 |
| PROD-07 | Visibilidade durante correção de item reaberto | Acesso ao conteúdo durante revisão | REF-07, REF-14, REF-15 | Resolvida: DEC-11 |
| PROD-08 | Nova aprovação de entrega e ciência de relatório após liberar correção | Validação do objeto corrigido e histórico das validações anteriores | REF-07, REF-15 | Resolvida: DEC-12 |

As oito perguntas iniciais foram respondidas; a revisão posterior substituiu PROD-03 por DEC-13. **OPEN-13 / RESUMO-01 está resolvido para Admin por DEC-19**; escopo/conteúdo da versão Partner foi explicitamente adiado à sua fase. Não perguntar novamente o que está fechado nem inventar a versão Partner. Equivalência Cliente não concede gestão de contrato ou outra empresa; pessoa focal não cria hierarquia de privilégio.

O [roadmap revisado](ROADMAP.md) vincula decisões às entregas completas, dependências, bloqueios e aceite dos 18 fluxos. As antigas ondas de integração foram substituídas por entregas que incluem interface, dados, acesso e falhas. Detalhar o plano não resolve TEC-01/02/03 nem autoriza executá-lo. Questões técnicas são investigadas antes de perguntar eventual escolha funcional ao produto.

Reabertura mantém a identidade do item, mas preserva o conteúdo/validações anteriores em histórico. Aprovação anterior não aprova automaticamente o entregável corrigido. Em relatório, não solicitar nova ciência não equivale a registrar ciência do conteúdo corrigido; a ciência anterior permanece atribuída à revisão efetivamente conhecida.

### Bloqueios técnicos: responsabilidade de engenharia

| Prioridade | Trabalho necessário | Quando bloqueia | Referências |
| --- | --- | --- | --- |
| TEC-01 — antes de reproduzir integração | Obter e versionar definições ausentes, schema/policies efetivos e ordem/patches aplicados, por fonte/ambiente expressamente autorizado | Integração do domínio e reprodução fiel; não impede analisar/extrair padrões visuais em si | REF-04, REF-06, REF-12, REF-13, REF-21, REF-23 |
| TEC-02 — antes de habilitar acesso real | Unificar guardas de sessão ativa, papel, empresa, MFA e storage conforme contrato decidido e intenção documentada; provar caminhos permitidos/negados | Auth, escrita real e dados privados | REF-01, REF-14; partes técnicas de REF-03/07/10/11/15/17/18/20 |
| TEC-03 — antes de habilitar efeitos reais | Reconciliar pausa/retomada, capacidade, atomicidade, concorrência, idempotência e confirmação de entrega | Timer, mutações compostas, comunicação, arquivos e exportação/eliminação | REF-05, REF-08, REF-09, REF-16, REF-22 |

Não pedir ao usuário nomes de RPC, ordem de migration, código SQL, estratégia de cache, transação ou retry. São itens de investigação/implementação. Se faltar acesso à fonte, pedir apenas o acesso/exportação estritamente necessário em etapa própria; esta priorização não autoriza conexão ao banco, execução ou escrita no oficial.

Percentuais, prazos e valores já encontrados no código precisam ser reconciliados com a base efetiva e o contrato. Não pedir números novos como atalho para contornar ausência de definição. Alteração de regra comercial só entra como decisão de produto se a reconciliação realmente deixar conflito não resolvido.

### Questões de domínio e homologação, sem bloquear toda a base

| Grupo | Encaminhamento |
| --- | --- |
| Ciência/desfazer, reações, autoria de mensagens e edição de Forms — REF-17/18/19 | Preservar e esclarecer contrato por operação; perguntar eventual escolha funcional antes de alterar esse comportamento, sem transformar cada detalhe em pré-requisito global de DS/rotas |
| Fórmulas/qualidade de indicadores — OPEN-05 | Preservação solicitada continua válida; inventariar regra e casos de teste sem formular novo turnover/headcount nesta rodada |
| Tipografia/contraste/continuidade/fixtures — OPEN-06/07/08/11, REF-24 | Decisões técnicas/UX propostas e QA do recorte; não exigir que usuário escolha pixels, query keys ou defaults de componentes para liberar planejamento |
| Ambiente isolado e comprovação operacional — OPEN-10/12 | Definir infraestrutura de teste e critérios antes da integração; prova não pode ser produzida por uma resposta de produto |
| Paridade de módulos adicionais — OPEN-09 | Escopo geral de todos os fluxos já foi confirmado; não perguntar novamente por um piloto. Registrar somente exceção concreta se surgir |

Esses itens permanecem visíveis; não foram marcados como resolvidos nem descartados. O pedido de resolver decisões antes das fases é respeitado: as decisões de produto foram documentadas antes das fases; a fundação local agora segue DEC-20 sem antecipar integração real.

## Pendências que não devem virar suposição

| ID | Questão/evidência | O que falta | Momento de resolver e responsável necessário |
| --- | --- | --- | --- |
| OPEN-01 | Papel `partner` aparece no oficial, mas fontes históricas o tratam como futuro | Administração/efeitos Cliente já descritos na matriz estática; matriz completa do terceiro papel permanece fora deste recorte | Integração de acesso; responsável funcional e técnico |
| OPEN-02 | Oficial libera UI em erro de consulta; alvo decidido em DEC-08 exige adesão antes do convite e aceite versionado com bloqueio em falha | Decisão funcional resolvida; falta implementar/provar comprovação e bloqueio, sem substituir revisão dos textos legais | Antes de habilitar acesso/convite; responsável técnico/legal |
| OPEN-03 | Patch versionado altera revisão de cronograma para 24h × parâmetro (padrão 3), mas runtime também chama RPC v39 sem corpo | Aplicação efetiva, contrato v39 e decisão funcional; não alterar prazo de dúvida de relatório | Antes de portar planejamento/aprovações; responsável funcional |
| OPEN-04 | SQL de capacidade encontrado usa 75%/100%, excedente, 110% e terceira ocorrência; fontes antigas diferem | Reconciliar pipelines antigos/novo e estado aplicado; ver REF-09 | Antes de implementar alertas; responsável funcional |
| OPEN-05 | Fórmulas, bases e amostras de indicadores não estão fechadas aqui | Fonte oficial, período, qualidade, visibilidade e casos retroativos | Antes de calcular/expor indicador; responsável funcional/dados |
| OPEN-06 | Corpo de 16 px na regra oficial e raiz de 13 px na V2 | Validar tipografia/densidade por família de tela, sem microtexto | Fundação visual; responsável design/produto |
| OPEN-07 | Contraste de tokens/pares secundários e tamanhos ainda sem QA | Pares e estados acessíveis no layout real | Antes de homologar DS; responsável design/desenvolvimento |
| OPEN-08 | Fichas agora descrevem continuidade observada e contrato comum proposto | Validar restauração por URL, rascunhos e responsividade; ver REF-24 | Implementação/homologação do fluxo; responsável UX/funcional |
| OPEN-09 | Fichas cobrem os 18 IDs, incluindo módulos oficiais adicionais | Decisão de migração/paridade e lacunas de servidor identificadas, não pesquisa de navegação vazia | Fase 1; responsável de produto |
| OPEN-10 | Laboratório executado em DEC-22/25, com baseline de adesão e atores sintéticos | Bindings, negativas de IP externo/canário do host, captura local, Auth/TOTP e RLS de adesão testados; códigos/termos/estado/revogação também testados em DEC-26; faltam integração/eventos/telas da SPA e demais operações | Antes da integração; responsável técnico; [evidências](LOCAL_ENVIRONMENT.md) |
| OPEN-11 | Fixtures atuais têm métricas/estado desconectados | Cenários sintéticos coerentes por empresa/período, inclusive falha e vazio | Antes de homologar experiência; responsável domínio/QA |
| OPEN-12 | UX/UI foi especificada sem teste de usabilidade | Executar tarefas, registrar dificuldades e ajustar hipóteses com evidência | Homologação de recortes e sistema; responsável design/produto |
| OPEN-13 | **Resolvida para Admin em DEC-19**; resumo diário definido pela Patrícia | Implementar/provar contrato Admin; versão Partner com empresas/horas ainda a definir na fase dele; limites técnicos em Dados | Resumo Admin integra sua entrega completa; definição Partner não bloqueia Cliente/Admin |
| OPEN-14 | Dados pessoais precisam de finalidade/guarda e informação no acesso/coleta | Identificar consumidores, documentar prazos a validar e refletir conteúdo na versão apresentada; sem inventar valores | Documentação/validação do recorte antes de migrar/coletar os campos; produto e responsáveis pelos textos/dados |

Patrícia é a fonte de validação das regras de produto desta revisão; responsáveis técnicos, de textos/dados e operação ainda precisam ser identificados para cada aceite. A tabela não atribui trabalho individual por suposição.

## Dúvidas do cruzamento Cliente/Admin — 25/10/2026

Referência estática fixada em `f3d3f14043a6abc38636f0340fe831e621d8b357`. Nenhum item autoriza correção nesta etapa. “Encontrado” não comprova banco ativo. Fontes e transições estão vinculadas nas fichas; [29 chamadas sem corpo localizado](flows/SOURCES.md).

| ID | Evidência/questão | O que precisa ser decidido ou comprovado | Fonte dona |
| --- | --- | --- | --- |
| REF-01 | Rota exige perfil ativo/role; is_admin usa allowlist/MFA, aceita ausência de fator verificado; outras RPCs/EDGE usam role/active | MFA decidido em DEC-21: obrigatório antes de liberar Admin, com bloqueio em falha. Reconciliar identidade/allowlist/perfil ativo e provar guardas nas superfícies; não reabrir a decisão do segundo fator. | [Acesso](flows/ACCESS_ACCOUNTS.md), [matriz](PERMISSIONS.md) |
| REF-02 | TermsGate está habilitado por versão/canal, mas erro de consulta libera UI; comentário antigo fala em desligado | Decidido em DEC-08: adesão antes do convite e aceite obrigatório por versão, bloqueando falha; falta prova técnica | [FLOW-01](flows/ACCESS_ACCOUNTS.md) |
| REF-03 | Migration limita quatro convites ativos, docs antigos dizem acesso único; escrita Equipe ainda exige is_primary | Decidido em DEC-05: até quatro equivalentes, sem principal; reconciliar legado e preservar revogações individuais | [FLOW-02](flows/ACCESS_ACCOUNTS.md), [FLOW-08](flows/WORKSPACE_HOURS_TEAM.md) |
| REF-04 | 29 nomes literais de RPC sem corpo CREATE FUNCTION localizado; há comentários de aplicação pelo painel | Obter definições versionadas/inspeção autorizada antes de afirmar autorização, idempotência e transições | [Fontes/lacunas](flows/SOURCES.md) |
| REF-05 | Conta, anexos, avisos, decisão de material e integrações usam múltiplas chamadas | Qual estado parcial é admissível e como reconciliar falha/retry sem duplicar ou perder dado? | Fichas dos domínios afetados e [Dados](DATA_CONTRACTS.md) |
| REF-06 | Gestão Portal no schema public e portal-send-proposal não têm contratos completos neste repo | Permissões, aceite externo, proteção de preço/versão e consistência de envio | [FLOW-03](flows/ACCESS_ACCOUNTS.md) |
| REF-07 | UI de ajuste é mais restritiva que request_deliverable_adjustment; Admin tem UPDATE amplo; runtime usa ajuste v39 sem corpo | Correção decidida em DEC-06/11/12: reabrir mesmo item, indisponível até liberação e nova aprovação da entrega; faltam contrato v39 e guards efetivos | [FLOW-05/06](flows/PROJECTS.md) |
| REF-08 | pause_work_timer fecha sessão em stopped/discarded; UI também chama start_work_timer/resume_work_timer não versionados | Qual é o contrato de pausa/retomada e de timer global? Reconciliar índices e caminhos legados | [FLOW-07](flows/WORKSPACE_HOURS_TEAM.md) |
| REF-09 | Capacidade atual usa marcos 75/100 e regras próprias, além de estruturas antigas de hour_alerts | Quais mecanismos permanecem ativos? Pausa de capacidade bloqueia quais operações de trabalho? | [FLOW-07](flows/WORKSPACE_HOURS_TEAM.md) |
| REF-10 | Principal envia privados por RPC sem poder lê-los; métrica mensal tem escrita SQL mais ampla que UI Admin de consulta | DEC-09/10: Cliente/Admin informam e consultam privados; Cliente lança métricas e somente Admin corrige depois. Reconciliar policies/DTOs e trilha | [FLOW-08](flows/WORKSPACE_HOURS_TEAM.md) |
| REF-11 | UI de Equipe não reproduz todas as restrições is_primary; People Analytics tem gate visual/plano | DEC-05 elimina hierarquia de Cliente principal; falta remover dependência de privilégio e comprovar limite comercial sem redefinir escopo por analogia | [FLOW-08](flows/WORKSPACE_HOURS_TEAM.md) |
| REF-12 | Scheduling normal v1/v2/política/outcome não têm corpo completo; extras têm regras próprias | Recuperar contratos; distinguir horas úteis/corridas, ciência, slot, conflito e cancelamento | [FLOW-09](flows/CALENDAR.md) |
| REF-13 | Cliente UI comenta target=file, mas INSERT policy localizada aceita deliverable/task/project; policies completas de document_acknowledgements ausentes | Comprovar ciência/comentário reais e contrato de visibilidade por versão | [FLOW-11](flows/DOCUMENTS_REPORTS.md) |
| REF-14 | Storage de documentos/capas usa path, sem todas as guardas de publicação/target da metadata | Definir acesso efetivo de arquivo oculto/retirado e revogação; URL temporária não substitui autorização | [FLOW-11/13](flows/DOCUMENTS_REPORTS.md), [avisos](flows/ADMIN_LIFECYCLE.md) |
| REF-15 | Relatório tem travas de UI mais fortes que policy; published_at/estado sent têm fontes diferentes; reabrir v63 sem corpo | DEC-06/11/12 permite reabrir o mesmo item, ocultar até liberação e exigir nova ciência só a pedido Admin; falta reconciliar contratos/timestamps/histórico | [FLOW-12](flows/DOCUMENTS_REPORTS.md) |
| REF-16 | RPC/EDGE pode gravar estado antes/depois de envio; mensagens têm supressão de e-mail posterior | Qual status comprova enqueue/aceitação/entrega? Como idempotência e retry funcionam por integração? | Fichas e [controle de e-mail](flows/SOURCES.md#email-control) |
| REF-17 | UI não permite ciência Admin, SQL não veda explicitamente esse ator; reações têm guards diferentes por operação | Confirmar significado de desfazer ciência, público/comentários e condições de update/delete | [FLOW-13](flows/ADMIN_LIFECYCLE.md) |
| REF-18 | Auditoria UI promete imutabilidade; policy activity_admin_all permite ALL; algumas RPCs de mensagem autorizam Admin por role, não autor individual | Confirmar invariantes de autoria e append-only exigidas, com proteção real correspondente | [FLOW-10](flows/RECORDS.md), [FLOW-16](flows/ADMIN_LIFECYCLE.md) |
| REF-19 | Admin pode editar respostas de Forms, inclusive anexos, contato, nota, stage e owner | Que histórico da resposta original e autoria precisa ser preservado? Qual recorte público é permitido? | [FLOW-17](flows/FORMS_PEOPLE_PROFILE.md) |
| REF-20 | Policy/rota permite individual client_visible e token público; alvo atual separa três relatórios DISC | DEC-13 substitui DEC-07: avaliador interno, respondente só PDF/e-mail, Cliente só gestão; falta reconciliar projeção/rotas/storage/tokens legados e comprovar negações | [FLOW-17](flows/FORMS_PEOPLE_PROFILE.md) |
| REF-21 | Mapa tem UI/bridge public e grants authenticated, sem definições das quatro RPCs | Comprovar guardas Admin, projeção, transições e integrações antes de portar | [FLOW-17](flows/FORMS_PEOPLE_PROFILE.md) |
| REF-22 | Exportação/eliminação usa listas explícitas e storage antes de banco; novos módulos/public/externos podem ficar fora | Reconciliar cobertura, retenções, cópias externas e recuperação de falha parcial; não executar exclusão | [FLOW-18](flows/ADMIN_LIFECYCLE.md) |
| REF-23 | Há patches dinâmicos, migrations que só comentam aplicação pelo painel e prefixo temporal duplicado | Versionar baseline efetiva e ordem aplicada em ambiente autorizado antes de reproduzir schema | [Método/fontes](flows/SOURCES.md) |
| REF-24 | Leitura estática não prova UX, SLA uniforme, preservação de rascunho/URL ou teclado/responsividade | Validar essas hipóteses por fluxo; aceitar política explícita sem alegar teste executado | [Contrato comum](flows/README.md), [UX/UI](UX_UI.md) |

Responsáveis funcionais/técnicos/legais continuam a nomear conforme o assunto. Esta etapa não pede resolver todas as dúvidas agora: registra o que bloqueia reprodução fiel, distinguindo decisão de produto de informação técnica ausente.

## Como fechar uma decisão

Registrar questão, alternativas relevantes, decisão, motivo, evidência, responsável pela decisão, data e documentos/fluxos afetados. Atualizar a fonte canônica e marcar a pendência resolvida. Se houver mudança de decisão, preservar a anterior como substituída e apontar para a nova.

Uma ADR própria só é necessária quando a escolha tiver impacto durável e alternativas/tradeoffs que não caibam neste registro. Não criar coleção de ADRs vazias. O registro não substitui contrato, teste de permissão ou evidência de aprovação funcional.
