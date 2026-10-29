# Plano de padronização por fluxos completos

Atualização: 29/10/2026. **Fase 1 em andamento localmente; demais entregas planejadas.** V2 é a base; oficial somente leitura. Referência: aplicativo funcionando em 26/10, testado pela Patrícia, [publicação 83](BASELINE_REFERENCE_2026-10-26.md). [Regras de produto](PRODUCT_RULES.md) e [decisões](DECISIONS.md) definem o alvo e as diferenças aprovadas.

Objetivo: padronizar todos os fluxos Cliente/Admin sem passar várias fases construindo camadas antes da primeira jornada utilizável. Cada entrega fecha uma tarefa com interface, dados, regra, autorização, histórico, falhas e comunicação quando aplicável. “Fluxo completo” é unidade de construção; não cria fluxo novo nem significa que toda tela dispara e-mail. Chat não gera e-mail. Produção, migrations e canais externos exigem escopo próprio.

## Estado e cobertura

Já existem levantamento, 18 fichas, matriz estática, DS/UX/arquitetura propostos e decisões. Não repetir inventário como se estivesse vazio. Código segue demonstrativo. Router, Query/Form, API modular de empresas, tokens e Button/Field existem; lint, testes, formatação, links e build compõem `npm run verify`. Workflow definido ainda não executado no GitHub. SDK e sessão no frontend permanecem pendentes; RLS/persistência de adesão foram testados no laboratório, sem cobrir os demais domínios. Bibliotecas foram escolhidas pelo usuário em DEC-20.

O SHA `f3d3f14043a6abc38636f0340fe831e621d8b357` das fontes já corresponde à publicação 83. Os links continuam válidos; código/migrations não comprovam configuração ou aplicação no banco ativo. As 29 chamadas sem corpo localizado permanecem lacunas técnicas por operação, não motivo para inventar contrato.

Todos os IDs FLOW-01 a FLOW-18 permanecem rastreados. A rotina Admin/Cliente vem primeiro; depois DISC, demais fluxos Admin/Cliente e, por último, Partner. FLOW-17 inclui DISC como produto oficial, além de Forms e Mapa; sua implementação é separada por subfluxo. FLOW-15 cobre gestão Admin da equipe CALI e efeitos sobre acessos; área Partner completa permanece etapa posterior com recorte próprio.

## Fases e dependências

| Fase | Entrada | Entrega/saída | Estado |
| --- | --- | --- | --- |
| 0 — Base documental e contrato de produto | Levantamento e revisão Patrícia/Felipe | Fontes, regras, decisões e cobertura rastreadas; sem comprovação operacional | Entregue documentalmente; resumo Admin definido em DEC-19 |
| 1 — Fundação mínima para o primeiro fluxo | 0 e execução local autorizada em 27/10 | Execução reproduzível, isolamento de teste, acesso e shell/DS estritamente necessários à primeira entrega | Em andamento; base demo local, sem sessão real |
| 2 — Rotina Admin/Cliente | 1 e contratos de cada entrega | Empresas/acessos, Equipe e dados mensais, cada um utilizável de ponta a ponta | Planejada |
| 3 — Perfil comportamental DISC | Acesso/empresa e peças compartilhadas necessárias de 1/2 | Convite/resposta, avaliador interno e gestão/aprovação/entrega | Planejada |
| 4 — Demais fluxos Cliente/Admin | Contratos e vínculos necessários por tarefa | Projetos, horas, agenda, ocorrências, documentos, relatórios, avisos e módulos adicionais | Planejada |
| 5 — Partner posterior | Prioridade Cliente/Admin atendida e recorte próprio autorizado | Área Partner se incluída em escopo futuro; gestão Admin já rastreada nas fases anteriores | Postergada; não bloqueia aceite do recorte Cliente/Admin |
| 6 — Homologação global do recorte | Entregas aplicáveis de 2–4; 5 somente se autorizada no recorte | Regressão entre fluxos, evidência de permissões, UX e aceite de produto | Planejada |
| 7 — Preparação de release | 6 e aceites exigidos | Configuração de destino, observabilidade, corte, backup/restauração e rollback revisáveis | Planejada; sem publicação implícita |

Não há estimativas em dias nem responsáveis individuais inventados. Nomear responsável técnico e validador funcional/UX/dados/operação antes do aceite aplicável. Resumo Admin tem contrato fechado em DEC-19/RESUMO-01 e precisa de prova técnica; a versão Partner será definida em sua fase, sem bloquear Cliente/Admin.

## Fase 1 — Fundação mínima para a primeira entrega

**Dependência:** fase 0; execução local autorizada pelo Felipe em 27/10, sem conexão ao Supabase oficial nem publicação. A prioridade é viabilizar 2A, não criar todas as pastas, componentes ou integrações antes de entregar uso.

**Trabalho necessário:**

- Conferir checkout, runtime/gerenciador, versões e scripts; escolher baseline suportada, lockfile e instalação reproduzível. Runtime utilizado no diagnóstico não vira suporte oficial automaticamente.
- Introduzir formatação, lint e CI reais para os gates implantados, além de typecheck/build. Testes devem verificar regras e riscos do recorte; não espelhar markup nem simular verificação com script vazio.
- Definir ambiente local/não produtivo autorizado, contas/atores sintéticos e outbound bloqueado antes da primeira conexão. Sem fallback para produção; preview de hosting não isola banco.
- Reconciliar somente os contratos de acesso e empresa necessários ao início. Preparar contas/adesões sintéticas para testar sessão sem depender do cadastro completo de 2A.
- Implementar bootstrap, shell/layout e rotas mínimas; identidade e contexto isolados; tokens e primitivas com consumidores reais. DS/rotas/hooks/cache crescem com as entregas seguintes.
- Adesão antes do convite; termos obrigatórios no primeiro acesso/nova versão; falha de comprovação bloqueia. Integrar informação de privacidade e versionamento conforme [Dados pessoais](DATA_PRIVACY.md).

**Progresso local de 27/10:** main sincronizada em `c9baea7`; runtime/lockfile e gates definidos; navegação Cliente/Admin por URL preservando composições legadas; empresas com filtros/seleção na URL, hooks Query, formulário Form/Zod e adapter Axios em memória. Tokens e duas primitivas têm consumidor real. Isso prepara 2A, sem declarar cadastro, convite, revogação ou limite de acessos comprovados no servidor.

### Acompanhamento da fase 1 — pacote para revisão

Esta lista registra execução e evidência. O [PR #2](https://github.com/patricia258/cali-workspace-v2/pull/2) acompanha o mesmo recorte em rascunho; atualizar sua descrição a cada lote de commits junto das fontes canônicas. Fase 1 continua em andamento até cumprir os gates de acesso real abaixo.

**Concluído localmente:**

- [x] Sincronizar a base documental da main `c9baea7` e trabalhar na branch `codex/fase-1-base`.
- [x] Fixar runtime, dependências e lockfile; comprovar instalação limpa sem scripts de dependências.
- [x] Configurar formatação, lint, typecheck, testes, checagem documental e build em `npm run verify`.
- [x] Implantar bootstrap, Router/Query providers, URLs Cliente/Admin e retorno para erro/rota inexistente; shells legados permanecem ponte de migração.
- [x] Preparar módulo de empresas com schemas Zod, services, hooks Query, keys `as const`, filtros/seleção na URL e dados em memória. Isso não entrega cadastro/convite/revogação reais.
- [x] Implantar tokens, Button/Field e tipo compartilhado de variantes, com strings tipadas no JSX.
- [x] Separar mocks da aplicação de fixtures/adapters exclusivos dos testes; proteger fronteiras com lint.
- [x] Documentar tipos, regras de lint/exceções, decisões de stack, operação e rollback.
- [x] Validar o consumidor demonstrativo em 1440/1280/1024/390 px e teclado; verificação inicial passou com 50 testes; o recorte de 28/10 acrescenta contratos/precondições do ambiente, sem prova de Auth/RLS.

**Avanço de 28/10 — contratos e definição do ambiente:**

- [x] Reconciliar superfícies mínimas e versionar schemas de request/response e records planejados de perfil/aceite/empresa/convite; [contrato detalhado](contracts/ACCESS_COMPANIES.md).
- [x] Investigar cadastro/primeiro acesso e criar contrato mínimo próprio de adesão, sem confundir com aceite de termos — DEC-23; persistência concluída no laboratório em 29/10, comprovação/fluxo ainda pendentes.
- [x] Fechar regra de MFA com Felipe: Admin só entra após os dois passos, inclusive primeiro uso, com bloqueio em falha — DEC-21.
- [x] Definir Supabase local dedicado, CLI/portas/rede e configuração versionada com migrations/seeds desligados — DEC-22; [ambiente](LOCAL_ENVIRONMENT.md).
- [x] Implementar checagem estática da configuração e preflight somente de leitura. Docker/portas conferidos; preflight não passou porque CLI e rede dedicada ainda não existem.

**Avanço de 28/10 — padronização de estilos (DEC-24):**

- [x] Integrar Tailwind/Vite/Prettier, mapear tokens CALI e migrar Button, Field e empresas; remover os três CSS substituídos.
- [x] Registrar coexistência sem Preflight, prefixo `tw:` e inventário dos oito CSS legados no [DS](DESIGN_SYSTEM.md#inventário-da-migração-de-estilos).
- [ ] Migrar os demais consumidores junto dos respectivos fluxos; retirar regras/imports substituídos a cada recorte e concluir limpeza global após todos migrarem. Trabalho transversal das fases, sem bloquear a primeira entrega por catálogo visual completo.

**Avanço de 29/10 — baseline e adesão no laboratório (DEC-25):**

- [x] Instalar CLI fixado temporariamente, conferir checksum, criar redes exclusivas e executar bootstrap revisado, sem conexão remota.
- [x] Preservar serviços de negócio em rede internal; publicar somente proxy TCP dedicado em loopback, com destinos fixos e restrições verificadas.
- [x] Aplicar baseline nova de empresa/perfil/adesão, com journal/digest, autoria/instante do servidor, histórico imutável, RLS e autoridade Admin unificada no recorte.
- [x] Testar SQL permitidos/negados e API com Auth/TOTP reais: 30 verificações; provar captura SMTP local e negativas de IP externo/canário do host nos cinco serviços.
- [ ] Integrar esses contratos à sessão/guardas/frontend e completar comprovação da referência/gate de convite no fluxo respectivo. Persistência local não encerra a jornada.

**Avanço de 29/10 — códigos/termos e preparação de sessão (DEC-26):**

- [x] Implementar DDL novo V2, Edge local, captura Mailpit, locks/uso único/limites e troca de token pelo Auth; sem provisioning por convite ou envio externo.
- [x] Implementar versões/conteúdo/digest imutáveis, aceite corrente idempotente por servidor e bloqueio por ausência/versão antiga. Testes usam textos sintéticos; conteúdo CALI ainda não foi aprovado/publicado.
- [x] Implementar estado de sessão/empresa e corte no servidor; inativação/bloqueio/encerramento/arquivamento revogam sessões/códigos sem reativação automática das credenciais antigas.
- [x] Preparar controller de sessão, contrato validado, cache/cancelamento/gerações, beforeLoad Cliente/Admin e invalidação de rota no logout, com fonte injetada nos testes.
- [ ] Conectar fonte/eventos/refresh Auth e telas de código/MFA/termos à SPA; bootstrap permanece demo, sem SDK/URL real.

**Falta para fechar a fase 1:**

- [ ] Completar lacunas de contrato e baseline por operação: autorização dos próximos contratos e integração da SPA; DDL novo de códigos/termos já implementado/testado localmente; persistência da adesão e predicado unificado já testados no recorte local, sem equivaler à cobertura de todos os domínios; create_client_account segue ausente para 2A, sem impedir preparação sintética. MFA decidido em DEC-21 e testado no servidor da adesão; UI/sessão e demais superfícies pendentes. TEC-01/02 não foram declarados resolvidos globalmente.
- [ ] Ampliar os consumidores reais do laboratório já testado para código/termos/estado/revogação: conectar sessão e UI da SPA. CLI/rede/bindings/negativas de rede/captura e RLS de adesão foram testados em 29/10; OPEN-10 continua parcial para o fluxo completo. Nenhuma conexão ao oficial está autorizada.
- [ ] Conectar autenticação/sessão/eventos e login/callback no frontend; controller/guardas já preparados por injeção. Integrar MFA e retorno seguro sem tratar mock-admin como identidade.
- [ ] Completar comprovação/gate de adesão antes do convite e apresentar/validar conteúdo de uso/privacidade no frontend; aceite obrigatório por versão já testado no servidor. Usar contas/adesões preparadas para teste, sem antecipar o cadastro completo da fase 2A.
- [ ] Provar isolamento no servidor para Cliente A/B/Admin, perfil inativo, empresa bloqueada, expiração/revogação, logout e cancelamento/limpeza de cache/contexto.
- [ ] Validar URL direta/retorno após login e teclado/mobile dos estados de acesso reais; fixtures não encerram esse aceite.
- [ ] Executar/revisar CI no GitHub para a revisão enviada e concluir a revisão técnica do recorte; workflow definido não é execução comprovada.

Cadastro/contrato, convite e manutenção dos quatro acessos equivalentes de ponta a ponta são a entrega 2A. O DS e as demais extrações crescem junto dos fluxos; não são um catálogo completo a terminar antes de 2A. Fontes de evidência: [arquitetura](ARCHITECTURE.md), [runbook](RUNBOOK.md), [changelog](CHANGELOG.md) e [ficha de acesso/contas](flows/ACCESS_ACCOUNTS.md).

**Próximo passo técnico:** conectar adapter/eventos/refresh de sessão e telas de código/MFA/termos ao laboratório já testado; completar comprovação documental e gate de convite no recorte de empresas/acessos. OPEN-10 continua parcial para jornada integrada; sessão/MFA/termos no navegador e RLS dos demais domínios continuam pendentes. Estado/expiração/revogação/logout e RLS de empresa foram exercitados no servidor local. Não tratar demonstração Admin como autenticação.

**Bloqueios:** TEC-01 para contrato de acesso ausente; TEC-02 para sessão, papel, empresa, MFA e superfícies reais; OPEN-10 para ambiente. Corpos ausentes de agenda ou relatórios não bloqueiam o primeiro fluxo se independentes.

**Aceite:** instalação limpa e comandos implantados passam na revisão registrada; configuração inválida não toca produção; sessão ativa/inativa/expirada e atores A/B/Admin exercitados no ambiente autorizado; URL direta/retorno/logout e limpeza de contexto funcionam; UI básica legível/mobile/teclado. Fundação isolada não é declarada fluxo de produto completo; o primeiro resultado de uso fecha em 2A.

## Fase 2 — Rotina Admin/Cliente completa

Cada linha é uma entrega independente, incluindo contrato/adaptador real de teste, interface, validação e documentação. Não esperar toda a fase 2 para revisar 2A.

| Entrega | Dependências | Conteúdo e aceite observável |
| --- | --- | --- |
| 2A — Empresa e acessos | 1; conta, adesão, convite e ciclo | Admin cadastra/acompanha empresa e acessos; Cliente entra no contexto correto; até quatro acessos equivalentes; sem principal; revogar um preserva demais; conta bloqueada não mantém acesso; aceite/privacidade versionados; perfil e retorno contextual necessários |
| 2B — Equipe | 2A; contratos de pessoas, privados e histórico | Cadastro/consulta/alteração/arquivamento e importação com prévia; todos os Clientes mantêm Equipe; Cliente/Admin informam/consultam privados permitidos; sem dados de outra empresa; ausentes no CSV não são desligados; datas efetivas, histórico e leitores coerentes |
| 2C — Dados mensais e confirmação | 2B e períodos/métricas/revisão mensal | Pedido de dados aparece só ao Cliente; Cliente lança; correção posterior só Admin; confirmação e resumos consistentes; cenários vazios/retroativos e falhas; fórmulas oficiais preservadas; comunicação apenas conforme contrato definido |

DS, tabelas, campos, overlays, modelos/hooks e cache necessários são entregues junto dos consumidores. Declarar quem possui cada estado: URL para contexto compartilhável, local para transitório, cache para respostas remotas e context somente para responsabilidades realmente transversais. Views não importam SDK ou fixtures.

**Privacidade:** inventariar finalidade, leitores e guarda dos campos do recorte e refletir a informação nos textos de acesso/coleta; registrar validação de conteúdo sem inventar prazos. DEC-09 não publica dados privados em logs, notificações ou PDFs por consequência.

**Aceite comum:** Cliente A, outro acesso equivalente A, Cliente B e Admin; quatro acessos e tentativa excedente; revogação; API direta permitida/negada; reload/Back/Forward e filtros; loading/vazio/erro/parcial/negação; retry/duplo submit; foco/mobile. Não declarar sucesso de gravação/envio sem confirmação do resultado.

## Fase 3 — Perfil comportamental DISC completo

**Dependência:** identidade/empresa, infraestrutura estritamente necessária e contratos públicos/privados reconciliados. A prioridade é posterior à rotina inicial; não depende de concluir todos os módulos de 4.

| Entrega | Conteúdo | Aceite observável |
| --- | --- | --- |
| 3A — Convite, resposta e PDF do respondente | Campanha, prazo, resposta, agradecimento, PDF e comunicações de teste | Sete dias/fim do dia em Brasília; máximo de três lembretes em dias/horas definidos; pessoa focal avisada; token inválido/expirado/recusado; conclusão não mostra resultado/metodologia/cálculos; PDF do próprio respondente por e-mail, sem duplicar envio |
| 3B — Avaliador interno | Leitura e operação CALI sobre resultado técnico | Sem opção de liberação ao Cliente ou respondente; testar rota, API, arquivo e token legado; separar projeções, não apenas ocultar botão |
| 3C — Gestão e entrega | Respostas elegíveis, resultado buscado, parecer Patrícia, aprovação, protocolo/assinatura, liberação e destinatário | Testar 4/5/14/15 respostas; cinco a 14 sem números/gráficos; nenhum nome; sem parecer/resultado não aprova; conteúdo alterado retorna a rascunho; empresa com conta recebe no app/aviso e sem conta recebe PDF ao gestor; histórico/auditoria preservados |

DEC-13 substitui DEC-07. Reaprovação interna não se confunde com nova ciência Cliente: DEC-12 continua vigente. Todo envio real externo usa apenas destino de teste autorizado; cenário simulado não certifica entrega. Canais não usados pela operação não são acrescentados para preencher checklist.

**Bloqueios:** contratos de projeção/token, liberação, assinatura/protocolo e envio; TEC-01/02/03; retenção/exportação aplicáveis. Método de cálculo existente é preservado, sem novo algoritmo de avaliação. Não certificar validade científica nesta padronização.

## Fase 4 — Demais fluxos Cliente/Admin

Conduzir cada domínio por entrega completa; dependências são de dados/operação, não barreiras artificiais de lote. A primeira entrega não elimina as demais do escopo.

| Entrega | Conteúdo | Dependências e saída |
| --- | --- | --- |
| 4A — Projetos e entregáveis | Frentes, planejamento, cronograma, revisão, execução, aprovação, ajustes e conversas | Empresa e contratos de projeto; regras de prazo/capacidade reconciliadas; reabertura com motivo/histórico, indisponível até liberação e nova aprovação; frentes contratadas não se confundem com workstreams |
| 4B — Horas e agenda | Timer/manual, extrato/ciclo, capacidade e solicitações/reuniões | Projeto/vínculo quando exigidos; pausa/retomada sem dupla contagem; Cliente consulta sem justificativa interna; agenda sem duplicidade; preço aceito preservado e status externo verdadeiro |
| 4C — Interações, documentos e avisos | Ocorrências/conversas, anexos, versões/ciência, mural/agenda/notificações | Público, autoria e storage; nota interna não vaza; mesma origem dos leitores de Avisos; chat sem e-mail; resumo Admin diário conforme RESUMO-01/DEC-19; testar corte, volume, exclusões e dias sem atividade; versão Partner posterior |
| 4D — Relatórios executivos e satisfação | Fatos/período, curadoria, aprovação, PDF, publicação, ciência e tratamento de avaliação | Fontes integradas, autoria/assinatura/protocolo e auditoria; tela/PDF correspondem à revisão; reabertura oculta até liberar; nova ciência só a pedido Admin; feedback original preservado |
| 4E — Comercial, módulos adicionais e ciclo de dados | Propostas, Forms, Mapa, frentes/ajuda, auditoria, direitos, exportação/encerramento e administração equipe CALI | Contratos próprios, públicos e permissões por operação; proposta aceita não vira pré-requisito novo de cadastro; Forms/Mapa não são DISC; staff Admin não equivale a construir área Partner; cobertura e falha parcial do ciclo de dados comprovadas |

Início, localizador, notificações e auditoria recebem leitores reais a cada entrega. Seu aceite global exige todas as fontes aplicáveis, sem métricas fictícias e sem apresentar período/empresa anteriores como atuais.

## Matriz de cobertura e aceite por fluxo

As [fichas](flows/README.md) continuam donas das transições e fronteiras. A matriz organiza a entrega e seus bloqueios. Nenhum ID foi marcado implementado pela revisão documental.

| ID e ficha | Entrega e dependências | Aceite específico | Bloqueios técnicos principais |
| --- | --- | --- | --- |
| FLOW-01 — [Acesso](flows/ACCESS_ACCOUNTS.md) | 1 e 2A; adesão, identidade e legal | Papel/vínculo/aceite corretos; erro bloqueia; expiração, retorno, logout e revogação; informação de privacidade acessível | TEC-01/02; REF-01/02/03; OPEN-10 |
| FLOW-02 — [Conta](flows/ACCESS_ACCOUNTS.md) | 2A; ciclo/encerramento em 4E | Quatro acessos equivalentes; adesão antes do convite; remover um preserva demais; bloquear/encerrar distinto de eliminar | REF-03/04/05; compatibilidade DEC-05/08 |
| FLOW-03 — [Propostas](flows/ACCESS_ACCOUNTS.md) | 4E; Portal e destinatário | Gestão Admin negada ao Cliente; aprovação interna distinta de aceite externo; valor/versão preservados; sem envio duplicado | TEC-01/03; REF-06/16 |
| FLOW-04 — [Prioridades](flows/WORKSPACE_HOURS_TEAM.md) | 2A–2C, completado pelas fontes de 3/4 | Totais/contexto corretos; atalho autorizado; dado parcial declarado; nenhuma métrica fictícia | REF-04/24; OPEN-05/11 |
| FLOW-05 — [Planejamento](flows/PROJECTS.md) | 4A; conta/frentes/projeto | Compartilhar/revisar/ajustar/aprovar com prazo e guardas verificados; ações explícitas em React | REF-04/07; OPEN-03 |
| FLOW-06 — [Entregáveis](flows/PROJECTS.md) | 4A; projeto e revisões | Reabrir mesmo item com motivo; indisponível até liberar; nova aprovação; conversa/avaliação e histórico autorizados | TEC-02/03; REF-07/14/16 |
| FLOW-07 — [Horas](flows/WORKSPACE_HOURS_TEAM.md) | 4B; conta/ciclo e vínculos exigidos | Timer/manual sem duplicar; pausa/retomada; extrato Cliente sem justificativa interna; total da autoridade oficial | REF-04/08/09; OPEN-04 |
| FLOW-08 — [Equipe](flows/WORKSPACE_HOURS_TEAM.md) | 2B/2C; empresa/acessos/períodos | Clientes equivalentes mantêm Equipe; privados no escopo; Cliente lança e só Admin corrige; importação/efetividade/snapshots coerentes; informação sobre dados validada | REF-10/11; TEC-02/03; OPEN-05/11/14 |
| FLOW-09 — [Agenda](flows/CALENDAR.md) | 4B; solicitação/capacidade aplicáveis | Solicitar/confirmar/remarcar/cancelar sem duplicar; conflito/timezone/prazo/preço aceito; Google/Meet com estado verdadeiro | REF-05/12/16 |
| FLOW-10 — [Ocorrências](flows/RECORDS.md) | 4C; protocolo/conversa/anexos | Abertura/resposta/fechamento/avaliação/reabertura; interno protegido; autoria; falha sem duplicar; chat sem e-mail | REF-16/18/24 |
| FLOW-11 — [Documentos](flows/DOCUMENTS_REPORTS.md) | 4C; empresa e vínculos existentes | Versão/publicação/ciência e comentário autorizados; arquivo privado negado; Drive distingue sincronização/entrega | REF-13/14/16 |
| FLOW-12 — [Relatórios](flows/DOCUMENTS_REPORTS.md) | 4D; fatos/período/revisão | Tela/PDF/fonte/assinatura/foto/protocolo concordam; auditoria; reabertura oculta; ciência só se solicitada; NPS/headcount preservados | REF-04/15/16; OPEN-05 |
| FLOW-13 — [Avisos](flows/ADMIN_LIFECYCLE.md) | 4C; público/ciência | Mural/agenda/notificação com mesma origem; destinatário correto; comentário/reação/ciência/desfazer conforme contrato | REF-05/14/16/17 |
| FLOW-14 — [Perfil/notificações](flows/WORKSPACE_HOURS_TEAM.md) | 1/2A para sessão/perfil; 2C/4C para comunicações | Navegação e retorno; perfil não muda papel; notificação abre objeto autorizado; logout limpa; resumo Admin corresponde a RESUMO-01/DEC-19, sem destinatários Cliente/staff; digest de chat das 08h não retorna | REF-01/04/16/24; OPEN-13 |
| FLOW-15 — [Equipe CALI](flows/ADMIN_LIFECYCLE.md) | Administração em 4E; decisões após horas/material; área Partner posterior em 5 | Admin convida/desativa/atribui; revogação retira acesso; decisão concorrente não duplica efeito; Cliente sem gestão staff | REF-01/04/05; escopo Partner separado |
| FLOW-16 — [Auditoria/satisfação](flows/ADMIN_LIFECYCLE.md) | Eventos a cada entrega; fechamento em 4D/4E | Ator/empresa/objeto e versão corretos; geração/aprovação/liberação/envio rastreados; feedback original preservado | REF-04/18 |
| FLOW-17 — [DISC/Forms/Mapa](flows/FORMS_PEOPLE_PROFILE.md) | DISC em 3A–3C; Forms/Mapa em 4E | Três relatórios DISC com públicos distintos; gestão com limiares/parecer; respondente só PDF; avaliador interno; Forms sem leitura geral Cliente; tokens/arquivos autorizados | REF-19/20/21/22; DEC-13/16 |
| FLOW-18 — [Frentes/legal/ciclo](flows/ADMIN_LIFECYCLE.md) | Legal/acesso em 1/2A; demais operações em 4A/4E | Consulta não contrata frente; pedir direito não elimina conta; exportação/retenção/recuperação testadas; textos acessíveis e versão registrada | REF-02/04/16/22; OPEN-14 |

## Bloqueios e critérios de desbloqueio

| Bloqueio | Quando bloqueia | Evidência de desbloqueio | O que pode avançar |
| --- | --- | --- | --- |
| TEC-01 — contrato/baseline efetiva ausentes | Primeira operação real que depende da definição | Corpo/ordem/projeção versionados, origem e contrato reconciliados; reprodução autorizada | Fundação/UI/fluxos independentes; cenário demo declarado provisório |
| TEC-02 — identidade/autorização divergentes | Habilitar acesso real a dado/arquivo/operação | Permitido/negado por superfície, API direta, revogação e cache; alvo vigente atendido | Composição local, sem alegar autorização comprovada |
| TEC-03 — consistência/efeitos | Escrita composta, timer, anexo e comunicação | Fronteiras, corrida, repetição, falha parcial e reconciliação testadas | Leituras independentes e cenários sintéticos |
| OPEN-10 — ambiente | Qualquer conexão real ou teste com efeito | Destino autorizado, atores sintéticos, baseline de teste e outbound bloqueado; sem fallback produtivo | Trabalho local com fixtures |
| OPEN-03/04/05 — prazo/capacidade/cálculo | Regra dependente do resultado | Fonte efetiva, fronteiras e retroatividade; fórmulas/valores preservados | Operações independentes do cálculo pendente |
| OPEN-13 / RESUMO-01 | Produto Admin resolvido em DEC-19; prova técnica antes de operar; conteúdo Partner posterior | Testar destinatários, filtros, corte temporal, volume/totais e retry no ambiente autorizado; definir versão Partner apenas na fase dele | Entregas Cliente/Admin não dependem da definição Partner |
| OPEN-14 — informação sobre dados | Coleta/migração dos campos do recorte | Finalidades/consumidores/guarda identificados, texto validado e apresentado no acesso/coleta | Estrutura sem coleta real; validação documental sem inventar prazo |
| REF-17/18/19 e REF-24 | Operação divergente ou aceite de experiência | Contrato pontual, autoria/histórico e QA de tarefa/responsividade/continuidade | Recortes sem dependência; não bloquear globalmente DS/rotas |

Engenharia investiga fontes autorizadas antes de repassar qualquer dúvida ao produto. Perguntar somente escolha funcional remanescente com contexto/alternativas; não pedir SQL, nome de RPC, cache ou retry. Código parcial não fecha bloqueio. Não remover fluxo silenciosamente para declarar a fase concluída.

## Checklist obrigatório de cada entrega

1. Identificar fluxo/subfluxo, tarefa, ator, empresa/período/objeto e responsável pelo aceite.
2. Conferir funcionamento da publicação 83 e regra alvo; registrar diferença aprovada e fontes, sem copiar bug/guarda contrária ao contrato confirmado.
3. Implementar interface, DS/layout necessário, URL, modelo/hook e operação real de teste com fronteiras explícitas. Demo é apoio à experiência, não entrega operacional completa.
4. Conferir tabelas/RPC/storage/funções aplicáveis: permitido/negado, outra empresa, inativo/expirado, resposta atrasada e revogação; mock não prova RLS.
5. Testar escrita/transição, histórico, invalidação de leitores, corrida/repetição/falha parcial proporcionais ao risco. Correlacionar arquivo/PDF/assinatura com a revisão correta.
6. Conferir comunicação aplicável: público, canal, conteúdo e resultado; sem e-mail de chat, efeito externo implícito ou confusão entre fila e entrega. Destino de teste precisa de autorização.
7. Executar tarefa em desktop/mobile, teclado/foco, vazio/erro/negação; formulários preservam dados conforme política de retorno. Remover CSS/fixtures substituídos no recorte.
8. Registrar revisão/ambiente/atores, resultados, documentação, aceite humano, limitações e rollback. Nenhum status de validado é concedido por build verde isolado.

## Fases 5–7 — Prioridade posterior e fechamento

**5 — Partner:** adiar a área completa; antes de incluí-la, fechar público, atribuições, matriz e paridade próprios. Não conflitar com a gestão Admin de equipe CALI já prevista. O recorte Cliente/Admin pode ser homologado sem essa expansão.

**6 — Homologação:** os 18 IDs/subfluxos aplicáveis têm evidência real ou adiamento explicitamente aprovado. Executar regressão entre módulos, isolamento e decisões vigentes; mídia/PDF/e-mail e tela concordam; sem operação obrigatória apenas simulada, bloqueio crítico oculto ou dados fictícios tratados como reais. UX/mobile/teclado são conferidos em cada entrega e novamente nos percursos cruzados. Resumo Admin segue RESUMO-01/DEC-19 e exige evidência de operação; conteúdo Partner não faz parte do aceite Admin/Cliente.

**7 — Preparação de release:** conferir hosting de teste, URLs diretas/callbacks, observabilidade sem dados privados, baseline/limites de bundle/carregamento, compatibilidade, backup/restauração e corte. Rollback distingue UI, contrato/migration e dados escritos; testar restauração no ambiente isolado. Registrar aceites funcional, UX, acesso/dados e operação. Merge/deploy/produção exigem escopo e autorização próprios; preparar não significa publicar.

## Referências anteriores e tarefa para IA

O plano anterior 0–7 organizava camadas: fundação, DS, shell, demo, acesso, integração e homologação. Nesta revisão, DS/shell/hooks/adaptadores/testes passam a acompanhar cada entrega; acesso/isolamento essenciais são antecipados para 1. As antigas ondas 6A–6D são substituídas pela matriz acima. Referências de fases em entradas históricas do changelog descrevem o plano daquela data, não uma obrigação de concluir todos os módulos demo antes de integrar o primeiro.

```text
Fase/entrega; FLOW e subfluxo; tarefa e resultado observável:
Responsável técnico e responsável pelo aceite:
Publicação 83: fonte e comportamento; regra vigente/diferença aprovada:
Dependências concretas, contratos e bloqueios com evidência:
Arquivos/consumidores; DS/UX; URL e dono de cada estado:
Modelo/hook/adaptador/context somente se justificado:
Operações reais de teste, atores/dados sintéticos e canais bloqueados:
Permitido/negado, fronteira, erro, continuidade e efeito externo:
Comandos reais/resultados; QA, evidências e aceite de produto:
Documentação canônica, compatibilidade, rollback e próxima ação:
```

Registrar execução no [changelog](CHANGELOG.md), conforme [Política de mudança](CHANGE_POLICY.md). Distinguir planejado, bloqueado, implementado e validado. Fase 1 tem execução local parcial; as entregas de produto das fases 2–7 permanecem planejadas. Não encerrar fase 1 com base apenas em mocks, lint e build.
