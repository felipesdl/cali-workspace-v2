# Plano de padronização de todos os fluxos

Atualização: 26/10/2026. **Planejamento revisado; implementação não iniciada.** A V2 é a base; `patricia258/app.cali` permanece referência somente em leitura. Este plano não autoriza conexão ao banco, migrations, comunicações, publicação ou execução de fases.

Objetivo: padronizar identidade, UX/UI, componentes, layouts, rotas, hooks, contextos justificados e fronteiras de dados em **todos os fluxos de Cliente e Admin**, preservando contratos, histórico e diferenças de jornada. Os 18 IDs do [catálogo](FLOW_CATALOG.md) rastreiam a cobertura. FLOW-15 abrange administração CALI e seus efeitos sobre Cliente/Admin; não aprova construir a área Partner completa. Subfluxos públicos e adicionais de FLOW-17/18 não podem desaparecer por omissão nem virar funcionalidades novas por analogia.

## Ponto de partida e decisões incorporadas

Já existem diagnóstico, arquitetura/DS/UX propostos, 18 fichas de levantamento e matriz estática. Não refazer o inventário como se estivesse vazio. Faltam contratos executáveis, implementação e comprovação. Código/configuração continuam demonstrativos: somente `typecheck` e `build` são verificações existentes; lint, testes, CI, router, SDK Supabase e DS compartilhado ainda não estão implementados.

A referência estática do oficial continua fixada em `f3d3f14043a6abc38636f0340fe831e621d8b357`. As [fontes](flows/SOURCES.md) registram 29 nomes literais de RPC sem corpo de função localizado nas migrations examinadas. Isso é lacuna de reprodução, não prova de inexistência no banco. Atualizar a referência exige registrar nova revisão e diferenças, mantendo o histórico.

As oito decisões priorizadas foram respondidas. Não reabrir perguntas resolvidas. O [registro](DECISIONS.md), as [fichas](flows/README.md) e a seção de contrato alvo da [matriz](PERMISSIONS.md) são os donos das regras; este quadro vincula implementação e aceite.

| Decisão confirmada | Aplicação | Prova antes de operar com dados reais |
| --- | --- | --- |
| DEC-05 — até quatro acessos Cliente equivalentes, sem principal; todos mantêm Equipe | Contas, acesso, Equipe e revogação | Quatro acessos equivalentes; tentativa excedente rejeitada; revogar um preserva direitos dos demais; manutenção não depende de `is_primary` |
| DEC-06 — Admin reabre o mesmo entregável/relatório, com motivo e histórico | Projetos e relatórios | Identidade preservada, motivo registrado, histórico recuperável e chamada não autorizada recusada |
| DEC-07 — perfil individual e agregado liberados pela CALI | Perfil comportamental | Ambos disponíveis somente quando liberados e dentro da própria empresa; negação em outra empresa e sem liberação |
| DEC-08 — adesão antes do convite e termos obrigatórios por versão | Conta, convite, sessão e legal | Convite sem adesão recusado; primeira entrada/nova versão exigem aceite; falha de comprovação bloqueia com possibilidade de tentar novamente |
| DEC-09 — Cliente informa e consulta privados de Equipe; Admin também | DTOs, formulários e leitura/escrita privada | Ambos consultam/informam campos autorizados; Cliente de outra empresa não recebe dados, inclusive por acesso direto |
| DEC-10 — Cliente lança métricas; só Admin corrige depois | Equipe, períodos e indicadores | Lançamento inicial permitido ao Cliente; alteração posterior negada ao Cliente e permitida ao Admin com rastreabilidade; fórmulas preservadas |
| DEC-11 — item reaberto indisponível ao Cliente até liberação | Listagem, detalhe, arquivo/PDF e cache aplicáveis | Conteúdo em correção não é recuperável pelos caminhos Cliente; cache da aplicação invalidado; não prometer revogar arquivos já baixados |
| DEC-12 — nova aprovação de entrega; ciência de relatório só a pedido Admin | Revisões, liberação e validação | Aprovação antiga não aprova conteúdo corrigido; nova ciência pendente somente se solicitada; registros antigos ligados ao conteúdo histórico |

A documentação não define por si só schema, enum, payload ou migration dessas decisões. Projetar compatibilidade antes de alterar contratos, preservando a fonte oficial como evidência histórica.

## Sequência e dependências

A numeração anterior foi preservada. Fase 0 identifica o levantamento documental entregue; fases 1–7 continuam planejadas. Não há estimativas em dias nem responsáveis individuais nomeados. Antes da execução de cada recorte, registrar responsável técnico e quem valida produto, UX, dados e operação conforme o risco.

| Fase | Dependência de entrada | Resultado | Estado atual |
| --- | --- | --- | --- |
| 0 — Levantamento e decisões | Fontes V2/oficial e respostas do usuário | Baseline, fichas, matriz e contrato alvo | Entregue documentalmente; sem validação operacional |
| 1 — Fundação reproduzível e contratos rastreáveis | 0 e autorização futura para implementar | Baseline de execução, gates reais e diferenças por operação | Planejada |
| 2 — DS e padrões de UX/UI | Fundação de 1 e fichas dos consumidores | Tokens, primitivas e composições em consumidores reais | Planejada |
| 3 — Shell, rotas e contexto navegável | Fundação de 1 e primitivas necessárias de 2 | URLs, layouts persistentes e continuidade | Planejada |
| 4 — Todos os domínios com hooks e demo | Shell de 3 e componentes necessários de 2, por recorte | Jornadas completas e estados coerentes para cada fluxo | Planejada |
| 5 — Ambiente isolado, identidade e autorização | Contratos de acesso reconciliados em 1; shell de 3 e fronteiras compartilhadas de 4 | Acesso real de teste e matriz de isolamento comprovada | Planejada |
| 6 — Integração de todos os fluxos | 5; demo, contrato e bloqueios resolvidos por operação | Jornadas reais de teste, transições e falhas comprovadas | Planejada |
| 7 — Homologação e preparação de release | Todos os recortes aplicáveis de 6 encerrados | Evidência global, aceite e plano de corte/rollback | Planejada; não inclui publicar |

Há duas frentes de trabalho, sem necessidade de agentes paralelos: **estrutura/experiência (1–4)** e **reconciliação de contratos (1, 5 e 6)**. Uma RPC ausente de agenda não bloqueia tokenização ou navegação de Equipe. Contrato incerto pode ser representado por cenário demo explicitamente provisório; a operação real permanece bloqueada.

Fases 2 e 3 avançam em recortes coordenados após a fundação mínima de 1. Fase 4 consome esses recortes. A fase 5 pode começar quando suas dependências específicas estiverem atendidas, sem esperar todos os componentes de todos os módulos. Fechar uma fase exige seus critérios completos; primeiro consumidor pronto não encerra a cobertura global. A integração é liberada por operação/domínio, não por existir demo.

## Fase 0 — Levantamento e decisões

**Entregue:** [baseline](BASELINE_2026-10-25.md), [contexto](PRODUCT_CONTEXT.md), [UX/UI](UX_UI.md), [DS](DESIGN_SYSTEM.md), [arquitetura](ARCHITECTURE.md), catálogo/fichas, fontes, permissões e DEC-01 a DEC-12.

**Limites:** fichas preenchidas não significam paridade validada. TEC-01/02/03 e questões específicas continuam registradas; somente PROD-01 a PROD-08 desta rodada estão resolvidas.

**Saída documental:** fonte/revisão identificadas; observado, alvo, proposta e lacuna distintos; links íntegros; nenhuma refatoração ou conexão implícita.

## Fase 1 — Fundação reproduzível e contratos rastreáveis

**Dependência:** fase 0 e autorização de execução. Recuperar todas as definições do banco não é pré-requisito para iniciar a fundação local.

**Entregas:**

1. Conferir checkout, scripts e dependências; escolher e registrar runtime suportado, gerenciador, versões e lockfile. Runtime usado no diagnóstico não vira suporte oficial automaticamente. Inventariar assets/fontes externas, fallback e carregamento.
2. Introduzir formatação, lint e verificação de fronteiras reais, além de CI de instalação, typecheck e build. Preparar testes proporcionais aos contratos críticos seguintes; sem scripts vazios ou testes que apenas reproduzem componentes triviais.
3. Acrescentar às fichas existentes diferenças V2/oficial/alvo, URLs, leitores afetados, composição UX e ações instaladas por runtimes DOM. Confirmar operações aplicáveis Cliente/Admin e todos os subfluxos de FLOW-15/17/18 sem expandir escopo silenciosamente.
4. Detalhar em [Dados e contratos](DATA_CONTRACTS.md), por operação: entrada/saída, autorização, transição, cálculo, efeitos, falha, consistência e leitores/cache. Separar conhecido, provisório e bloqueado. Rastrear cada chamada sem corpo, patches e ordem aplicada; não declarar baseline do banco reproduzível antes da prova.
5. Projetar compatibilidade das decisões novas: principal legado; privados Cliente; lançamento/correção; adesão/termos; reabertura e vínculo das validações a revisões. Não mudar backend/payload para compensar lacuna de UI.

**Bloqueios:** TEC-01 impede fechar os contratos afetados e reproduzir suas integrações. Fonte que dependa de inspeção não autorizada permanece bloqueada; pedir somente acesso/exportação estritamente necessários em etapa própria. Nomear responsáveis antes do respectivo aceite.

**Critérios de aceite:**

- Instalação limpa reproduz a baseline documentada; comandos implantados passam no ambiente/revisão registrados; CI executa os gates declarados. Arquivo de configuração não equivale a execução bem-sucedida.
- Os 18 IDs têm subfluxos aplicáveis, dono técnico, consumidores, estado de paridade, dependências e aceite. Adiamento exige decisão explícita com impacto; todos continuam no plano até essa decisão.
- Operações do próximo recorte têm contrato suficiente. Cada lacuna restante possui fonte, impacto, responsável por investigar e gate de bloqueio; não precisa ser fingida como resolvida para encerrar fundação local.
- Arquitetura registra escolhas/versões efetivas após implementação; nenhuma árvore vazia é contada como entrega.

## Fase 2 — Design system e padrões de experiência

**Dependência:** fundação de 1 e fichas dos consumidores. Usar fixtures, sem depender do banco.

**Entregas:** tokens primitivos/semânticos/de componente; bordô/marfim/dourado; tipografia/densidade; estados textuais, contraste, camadas, scroll e movimento. Implementar ações, campos, abas, tabelas/listas, menus, overlays e feedback segundo o [DS](DESIGN_SYSTEM.md).

Aplicar as famílias de [UX/UI](UX_UI.md): diretório, extrato, execução/cronograma, conversa, catálogo, relatório e cadastro. Cada consumidor preserva tarefa, conteúdo, hierarquia e continuidade próprios. Migrar consumidores concretos Cliente/Admin por lote e remover CSS substituído. DS não conhece feature, empresa ou SDK; composição de negócio fica no domínio. Avaliar biblioteca de primitivas e estratégia de CSS na execução conforme as necessidades CALI.

**Bloqueios:** OPEN-06/07 e REF-24 exigem QA visual/interação, não decisão de negócio sobre pixels. Sem consumidor e estados verificáveis, peça permanece incompleta; contrato de banco ausente não impede QA sintético.

**Critérios de aceite:**

- Código consome tokens; variantes não se multiplicam por módulo; sem nova camada de overrides para esconder regras antigas.
- Consumidores reais Cliente/Admin cobrem leitura, formulário e overlay; propriedades/estados/acessibilidade documentados. Não criar componentes sem demanda concreta.
- Evidência por revisão em 1440/1280/1024/390 px, larguras intermediárias relevantes, zoom, teclado/foco/retorno, Escape, scroll, contraste e movimento reduzido. Ação essencial não depende de hover.
- Inventário mostra consumidores migrados e pendentes de 3/4. O núcleo DS pode fechar antes da migração global; padronização completa só fecha com cobertura em 4/7.

## Fase 3 — Shell, rotas, layouts e contexto

**Dependência:** fundação de 1, peças necessárias de 2 e mapa de rotas/continuidade. Autenticação real pertence a 5.

**Entregas:** bootstrap fino; shell compartilhado; layouts Cliente/Admin persistentes; catálogo único de navegação/títulos; rotas finas; parse/serialização tipados; detalhe por URL; 404 e falha localizada. Preservar caminhos confirmados no [mapa de arquitetura](ARCHITECTURE.md); verificar caminhos adicionais antes de defini-los. Não inventar URL para encerrar checklist.

Declarar dono de estado: URL para contexto compartilhável; hook local para busca/rascunho transitório; cache para resposta assíncrona; context transversal somente com fonte, consumidores e ciclo de vida. Sessão real nasce em 5; alternador demo permanece explícito e não autoriza acesso. Workspace não guarda listas remotas nem espelha empresa em vários estados.

**Bloqueios:** caminho/parâmetro desconhecido impede declarar compatibilidade do subfluxo afetado. TEC-02 bloqueia acesso real, não os layouts; guardas demo são simulação.

**Critérios de aceite:**

- Todas as entradas demonstrativas existentes têm destino navegável; entradas adicionais confirmadas estão rastreadas até o recorte que as implementará. Página vazia não conta como fluxo pronto.
- URL direta, reload, Back/Forward, parâmetro inválido, retorno e troca de empresa/período obedecem à política documentada. Menu/título/localização concordam; shell persiste entre rotas filhas.
- Conteúdo/rascunho de outro contexto não aparece como atual. Descarte/preservação de alterações é explícito e verificável.
- Layout suporta teclado/mobile. Fallback de SPA fica documentado e deve ser validado no hosting de teste antes do release; sem alegar produção verificada.

## Fase 4 — Features, hooks e adaptadores demo de todos os fluxos

**Dependência:** rota/layout e peças DS exigidos pelo recorte. Os 18 fluxos devem ser cobertos ao encerrar a fase.

**Entregas:** domínios com consumidores reais; modelos/hooks de apresentação; regras puras no dono; adaptadores demo tipados; cenários sintéticos consistentes entre listas, resumos, histórico e períodos. Views não importam SDK nem fixtures. Calendário/mural consomem o domínio Avisos, sem importar arrays de outra view.

Para operações assíncronas, definir dono de consulta/mutação, chaves e leitores invalidados; adicionar cache quando houver consumidor e necessidade. Hooks reutilizáveis nascem de responsabilidade repetida, sem meta de quantidade. Contexts não substituem URL/cache. Aplicar decisões de produto nas simulações; contrato ausente mantém cenário explicitamente provisório, sem ser descrito como regra oficial ou prova de segurança.

**Bloqueios:** contrato incerto impede paridade funcional definitiva, mas permite exercitar composição/estados propostos. OPEN-11 impede homologar experiência sem fixtures coerentes.

**Critérios de aceite:**

- Cada ID tem percurso demo aplicável e estados inicial/loading/vazio/parcial/erro/negado/expirado/sucesso conforme operação. Estado não aplicável exige justificativa, sem tela artificial.
- Cliente/Admin recebem ações compatíveis com alvo; tentativa inválida tem resultado coerente no demo. Isso não comprova RLS.
- Empresas/períodos não se misturam; Equipe cobre série sintética necessária, inclusive vazios/retroatividade; listas/resumos concordam. Fórmula oficial não é recriada por aproximação.
- Duplo submit, falha e resultado desconhecido têm tratamento observável; toast não afirma envio real. Limites de persistência do demo são explícitos.
- Adaptador pode ser substituído sem refazer a view; DS não importa domínio; CSS/fixtures/dependências substituídos são removidos. Runtime baseado em seletor DOM não vira arquitetura permanente.

## Fase 5 — Ambiente isolado, identidade e autorização

**Dependência:** contratos de acesso reconciliados em 1, shell de 3 e fronteira de dados comum de 4. Exige autorização específica do ambiente/operações de teste; este plano não a concede.

**Entregas:** ambiente local ou não produtivo com isolamento demonstrado; baseline/ordem de migrations reconciliadas; tipos gerados desse ambiente; seleção explícita demo/integração sem fallback produtivo; outbound e callbacks/gatilhos externos bloqueados antes do primeiro teste. Preview de hosting não isola banco.

Implementar sessão/callback/expiração/logout; identidade ativa, vínculo/papel e MFA reconciliados entre superfícies; adesão/aceite versionado; limite/equivalência dos acessos. Testar tabelas, RPC, storage e funções conforme [Dados e contratos](DATA_CONTRACTS.md). Provider de sessão possui consumidores e limpeza de ciclo de vida explícitos.

Contas, adesões e convites sintéticos mínimos podem ser preparados como fixtures do ambiente autorizado para provar acesso. Isso evita dependência circular com a gestão completa de contas de 6A; não equivale a homologar o cadastro, contrato ou ciclo da conta.

**Bloqueios:** TEC-01 para definições/baseline de acesso; TEC-02 para predicados, MFA, grants e escopo; OPEN-10 para ambiente. Autorização frontend não substitui contrato. Divergência funcional de MFA remanescente exige decisão pontual antes de habilitar a operação, após investigar fontes.

**Critérios de aceite:**

- Ambiente/destino identificados; configuração ausente/errada não toca produção. Atores/dados sintéticos; outbound bloqueado com evidência dos canais/gatilhos abrangidos.
- Matriz executada com sem sessão, inativo, Cliente A e outro acesso da mesma empresa, Cliente B de outra empresa, Admin e Partner atribuído/não atribuído quando afetar a operação. Cobrir quatro acessos, revogação individual e tentativa excedente.
- DEC-05/08 comprovadas no caminho real de teste, inclusive negação por API direta. Alterar URL/payload não concede papel/empresa.
- Expiração/logout/troca de empresa isolam requisições e limpam cache/detalhes incompatíveis; resposta atrasada não reaparece no novo contexto.
- Evidência registra operação, ator, superfície, entrada, esperado/obtido, ambiente e revisão. Resultado de uma RPC não certifica todas as policies; só superfícies testadas ficam liberadas.

## Fase 6 — Integração de todos os fluxos por dependência

**Dependência:** 5 e, por operação, contrato reconciliado, experiência demo correspondente e bloqueios técnicos resolvidos. Trocar o adaptador sem redefinir jornada para acomodar transporte.

### Ondas de integração

| Onda | Escopo | Dependências e limites |
| --- | --- | --- |
| 6A — Conta e administração base | FLOW-02/03; cadastro e vínculos de FLOW-15; partes de FLOW-18 relativas a frentes/legal | Acesso de 5; contratos comerciais/staff/públicos. Ordem técnica não torna proposta aceita requisito novo de cadastro, adesão ou convite |
| 6B — Estrutura de trabalho e pessoas | FLOW-05/06/08; perfil de FLOW-14 | Empresa/acesso e vínculos necessários de 6A. Projetos/Equipe avançam independentemente quando não houver dependência de dados comprovada |
| 6C — Operação e comunicação | FLOW-07/09/10/11/13; notificações de FLOW-14; decisões de submissão de FLOW-15 | Projeto/entrega/ciclo somente quando exigidos pela operação; decisões staff após os contratos de horas/material correspondentes. Comunicação/anexos compartilham infraestrutura, sem fundir máquinas de estado |
| 6D — Consolidação e ciclo de dados | FLOW-04/12/16/17; direitos/exportação/encerramento de FLOW-18 | Fontes de resumo/relatório e contratos públicos/privados. Subfluxos independentes de Forms/Mapa/perfil podem antecipar quando seus próprios gates estiverem atendidos |

Ondas são coordenação, não regras de negócio ou barreiras artificiais de lote. Dependência de dado aponta para contrato concreto. Início/notificações/auditoria recebem fontes progressivamente e só fecham cobertura global após os domínios necessários. FLOW-01 fecha o núcleo em 5 e participa da regressão de todas as ondas.

### Entregas e critérios comuns de aceite

- Operações reais de teste preservam identidade, projeção, nulabilidade, unidade, período e autoridade de cálculo. Backend/payload só mudam com compatibilidade e escopo explicitamente tratados.
- Executar permitido/negado por superfície, transições válidas/inválidas, expiração, concorrência, repetição e falha parcial conforme risco. Simulação de falha tem identificação própria; não comprova entrega externa.
- Preservar histórico/autoria e invalidar listas, detalhes, resumos e demais leitores. Não transferir aprovação/ciência silenciosamente entre revisões.
- Arquivos/PDF/links seguem visibilidade do objeto. Reabertura bloqueia conteúdo em correção até liberação; cache não mantém acesso indevido da aplicação. Revogação de URLs existentes exige estratégia comprovada, sem prometer remover cópia já baixada.
- Timer, decisão composta e envio têm consistência/idempotência/reconciliação demonstradas. Fila, aceitação de provedor e entrega são estados distintos. Outbound continua bloqueado; prova real de integração externa só em destino de teste expressamente autorizado.
- Cada linha da matriz tem ficha/contrato/QA atualizados e evidência por revisão. Sem contrato/prova, operação permanece bloqueada e domínio não é declarado concluído; sucesso local ou permissão visual não contornam gate.

## Matriz de cobertura e aceite por fluxo

Fases 1–4 tratam transversalmente todos os IDs. A coluna de integração indica quando fechar o percurso real. O aceite complementa as [fichas](flows/README.md), sem substituir seus casos de fronteira. Bloqueios estão no [registro](DECISIONS.md).

| ID e ficha | Integração e dependências | Aceite específico Cliente/Admin | Bloqueios antes da operação real |
| --- | --- | --- | --- |
| FLOW-01 — [Acesso](flows/ACCESS_ACCOUNTS.md) | 5; adesão, convite, identidade e legal | Papel/vínculo corretos; expiração/retorno/logout; aceite por versão e bloqueio em erro; revogação efetiva | TEC-01/02; REF-01/02/03; OPEN-10 |
| FLOW-02 — [Conta/contrato](flows/ACCESS_ACCOUNTS.md) | 5 acessos; 6A ciclo da conta | Quatro Clientes equivalentes; adesão antes do convite; revogar um preserva demais; bloquear/encerrar distinto de eliminar | REF-03/04/05; compatibilidade DEC-05/08 |
| FLOW-03 — [Propostas](flows/ACCESS_ACCOUNTS.md) | 6A; destinatário e Portal | Gestão Admin negada ao Cliente; aprovação interna distinta de aceite externo; valor/versão aceitos preservados; sem envio duplicado | TEC-01/03; REF-06/16; contratos públicos/comerciais |
| FLOW-04 — [Prioridades](flows/WORKSPACE_HOURS_TEAM.md) | 6D; leitores dos domínios necessários | Total/período/empresa coerentes com detalhe; atalho autorizado; dado parcial declarado, sem métrica fictícia | Agregações; REF-04/24; OPEN-05/11 |
| FLOW-05 — [Planejamento](flows/PROJECTS.md) | 6B; conta, frentes e dependências | Compartilhar/revisar/ajustar/aprovar com guardas/prazos verificados e transições explícitas, sem seletor DOM | REF-04/07; OPEN-03; v39/ordem efetiva |
| FLOW-06 — [Entregáveis](flows/PROJECTS.md) | 6B; projeto, revisão e histórico | Mesmo item reaberto com motivo; indisponível até liberar; nova aprovação; histórico preservado; ajuste/conversa/avaliação autorizados | TEC-02/03; REF-07/14/16; DEC-06/11/12 |
| FLOW-07 — [Horas](flows/WORKSPACE_HOURS_TEAM.md) | 6C; conta/ciclo e vínculos exigidos | Timer/manual sem dupla contagem; pausa/retomada; Cliente consulta sem justificativa interna; total da autoridade oficial | REF-04/08/09; OPEN-04; timer/capacidade/concorrência |
| FLOW-08 — [Equipe](flows/WORKSPACE_HOURS_TEAM.md) | 6B; empresa, acessos e períodos | Todos os Clientes mantêm Equipe e informam/consultam privados; Admin também; Cliente lança e só Admin corrige métricas; importar com prévia sem desligar ausentes; datas/snapshots coerentes | REF-10/11; TEC-02/03; OPEN-05/11; DEC-05/09/10 |
| FLOW-09 — [Agenda](flows/CALENDAR.md) | 6C; acesso e solicitação/capacidade aplicáveis | Solicitar/confirmar/remarcar/cancelar sem duplicar; conflitos/timezone/prazos; preço aceito preservado; Google/Meet com estado verdadeiro | REF-05/12/16; scheduling ausente; integração externa de teste |
| FLOW-10 — [Ocorrências](flows/RECORDS.md) | 6C; protocolo, conversa e anexos | Abertura/resposta/fechamento/avaliação/reabertura permitidos; nota interna protegida; autoria/histórico; falha não duplica mensagem | REF-16/18/24; autoria/SLA e consistência de anexos |
| FLOW-11 — [Documentos](flows/DOCUMENTS_REPORTS.md) | 6C; empresa e vínculos existentes | Versão/publicação/ciência; comentário e arquivo autorizados; draft/privado negado; Drive distingue sincronização/entrega | REF-13/14/16; comentários/ciência e storage efetivo |
| FLOW-12 — [Relatórios](flows/DOCUMENTS_REPORTS.md) | 6D; fatos, período e revisão | Tela/PDF/fonte concordam; mesmo item reaberto com motivo/histórico; indisponível até liberar; ciência só se solicitada; NPS/headcount preservados | REF-04/15/16; OPEN-05; v63 e DEC-06/11/12 |
| FLOW-13 — [Avisos](flows/ADMIN_LIFECYCLE.md) | 6C; público, ciência e comunicação | Mural/agenda/notificação com mesma origem; público correto; comentário/reação/ciência/desfazer conforme operação; oculto não vaza | REF-05/14/16/17; storage, autoria e ciência |
| FLOW-14 — [Perfil/notificações](flows/WORKSPACE_HOURS_TEAM.md) | 3/4 navegação demo; 5 sessão; 6B perfil; 6C notificações | Menu/localizador/retorno; perfil não muda papel; notificação abre objeto autorizado; logout limpa; leitura sem falso sucesso | REF-01/04/16/24; contratos de perfil/notificação |
| FLOW-15 — [Equipe CALI](flows/ADMIN_LIFECYCLE.md) | 6A cadastro/vínculos; 6C decisões após contratos de horas/material | Admin convida/desativa/atribui; revogação retira acesso; decisão concorrente não duplica horas/material; Cliente sem gestão staff | REF-01/04/05; recorte Admin e efeitos de atribuições; área Partner completa fora do escopo |
| FLOW-16 — [Auditoria/satisfação](flows/ADMIN_LIFECYCLE.md) | 6D; eventos/avaliações | Filtro/empresa/ator corretos; tratamento não altera feedback original; autoria/imutabilidade do contrato reconciliado comprovadas | REF-04/18; satisfação/privacidade e permissões amplas |
| FLOW-17 — [Mapa/Forms/perfil](flows/FORMS_PEOPLE_PROFILE.md) | 6D ou recorte independente após 5; contratos de cada subfluxo | Três subfluxos rastreados; Cliente sem leitura geral de respostas Forms; token/arquivo/fechamento corretos; perfil individual/agregado liberados pela CALI e própria empresa | REF-19/20/21/22; RPCs Mapa, histórico de resposta, tokens/liberação; DEC-07 |
| FLOW-18 — [Frentes/legal/ciclo de dados](flows/ADMIN_LIFECYCLE.md) | 5 legal de acesso; 6A frentes; 6D direitos/exportação/encerramento | Consultar não contrata frente; pedir direito não concede eliminação; bloquear/encerrar/exportar/eliminar distintos; cobertura/retenção/recuperação testadas com dados sintéticos | REF-02/04/16/22; cobertura, retenções e falha storage/banco; sem produção |

## Bloqueios técnicos e critérios de desbloqueio

“Produto decidido” não significa “integração liberada”. Engenharia deve investigar fontes autorizadas; não repassar ao usuário escolhas de SQL, nomes de RPC, cache ou retry. Eventual conflito de negócio remanescente exige pergunta específica, sem reabrir DEC-05 a DEC-12.

| Bloqueio | Impacto/fases | Evidência para desbloquear | O que pode avançar antes |
| --- | --- | --- | --- |
| TEC-01 — definições/baseline ausentes | Contratos, policies, patches e ordem aplicada; REF-04/06/12/13/21/23; 1/5 e operação afetada em 6 | Definições versionadas com origem/revisão, ordem reconciliada e reprodução em ambiente autorizado; contrato conferido | Fundação local, DS, UX, rotas conhecidas e demo provisória |
| TEC-02 — autorização divergente | Sessão ativa, papel, empresa, MFA, privados, publicação e storage; 5/6 | Permitido/negado por superfície, API direta, revogação e cache; alvo atendido | Experiência demo e guardas identificadas como simulação |
| TEC-03 — consistência/efeitos | Timer/capacidade, múltiplas gravações, concorrência, repetição, anexos e canais externos; 6 | Fronteiras, corrida, repetição e falha parcial; reconciliação/compensação e estado externo no destino de teste autorizado | Leitura independente e cenários sintéticos; não habilitar efeito pendente |
| OPEN-10 — ambiente isolado | Primeira conexão real e teste com efeito; 5/6 | Ambiente/destino, atores sintéticos, migrations de teste e outbound bloqueado; sem fallback produtivo | Toda a frente local com fixtures |
| OPEN-03/04/05 — prazo/capacidade/indicadores | Planejamento, horas, Equipe e relatórios dependentes | Fonte efetiva e fronteiras/retroatividade; preservar fórmulas/valores, sem inventar regra | Estrutura visual e leitores independentes do resultado pendente |
| REF-17/18/19 — divergências por operação | Ciência/desfazer, reações, autoria/imutabilidade e edição de Forms | Contrato reconciliado; decisão funcional pontual se persistir conflito; provas de teste | Fluxos independentes; não bloqueia globalmente DS/rotas |
| OPEN-06/07/08/11/12 e REF-24 — experiência/QA | Saída de DS/demo/homologação; 2/3/4/7 | Capturas e tarefas com estados/fixtures coerentes, responsividade e continuidade; validação humana aplicável | Recortes com pendência explícita, sem declarar experiência homologada |

Bloqueio permanece aberto até existir evidência, mesmo com código parcial. Nenhuma exclusão/adiamento silencioso pode transformar fase em concluída. Definição indisponível deve apontar operação afetada e próxima fonte/ação necessária.

## Fase 7 — Homologação global e preparação de release

**Dependência:** cobertura operacional aplicável de 6 e fechamento dos bloqueios dos percursos a homologar. Redução de escopo depende de decisão explícita; não é assumida neste plano.

**Entregas:** regressão por tarefa Cliente/Admin e entre módulos; revisão visual/acessibilidade; evidência das decisões; baseline/limites de bundle, assets e carregamento; observabilidade sem dados sensíveis; hosting de teste e URLs diretas; backup/restauração, compatibilidade, corte e rollback. Nomear responsáveis pelos aceites funcional, UX, acesso/dados e operação.

**Critérios de aceite:**

- Os 18 IDs/subfluxos possuem estado e evidência de ambiente/revisão/ator; nenhuma operação obrigatória somente simulada ou bloqueio crítico aberto. Exceção exige decisão explícita, não marcação por aparência de UI.
- Empresa/período/objeto concordam entre módulos; prioridade/notificação levam ao detalhe; aprovação reflete no resumo; horas/Equipe alimentam relatório. Reabertura retira acesso até liberar e trata validação conforme DEC-12.
- Executar regressão proporcional: typecheck/build, lint/CI implantados, regras de fronteira, contratos/isolamento, transições críticas e falhas. Registrar comandos/resultados reais; mock não prova backend.
- QA das larguras especificadas, teclado/foco/zoom e estados completos por família, com evidência visual. Pesquisa/usabilidade só declaradas se executadas e documentadas com tarefa, perfil e resultado.
- Hosting de teste atende URLs diretas, retorno e callbacks aplicáveis; configuração/observabilidade conferidas. Definir limites de performance com baseline, sem orçamento numérico inventado neste plano.
- Rollback distingue UI/versão, compatibilidade de contratos/migrations e dados alterados. Testar restauração em ambiente isolado; deploy anterior não desfaz escrita de dados automaticamente.
- Aceite humano registrado; docs correspondem ao código; pendência não crítica tem impacto, responsável e encaminhamento. Produção/publicação exigem escopo e autorização próprios após resultado revisável.

## Unidade de trabalho e registro para IA

Cada tarefa entrega recorte vertical revisável: ação/consumidores, contrato, experiência, validação e documentação. Evitar “refatorar tudo”, “criar todos os hooks” ou camadas vazias. Primeiro recorte é unidade de execução, não redução do escopo a módulos iniciais.

```text
Fase/onda; ID do fluxo/subfluxo; objetivo observável:
Responsável técnico e responsável pelo aceite:
Ficha, decisão alvo e fonte/revisão:
Estado atual, arquivos e consumidores Cliente/Admin afetados:
Dependências concretas e bloqueios com evidência:
Recorte de código, contrato, compatibilidade e efeito externo:
Anatomia UX, peças DS, URL e dono de cada estado:
Hook/modelo/adaptador; contexts somente se justificados:
Aceite permitido, negado, fronteiras, falha e continuidade:
Ambiente, atores/dados sintéticos; canais externos bloqueados:
Validação, comandos reais e evidências esperadas:
Documentação canônica, rollback, pendências e próxima ação:
```

Registrar entregas no [changelog](CHANGELOG.md), conforme [Política de mudança](CHANGE_POLICY.md). Distinguir `planejado`, `em execução`, `bloqueado`, `implementado` e `validado`. Só marcar `validado` com resultado, ambiente/revisão e aceite exigido. Esta matriz de planejamento não atualiza esses estados automaticamente.

**Definição de concluído:** todos os fluxos aplicáveis padronizados e operacionais no ambiente autorizado, experiência/contratos coerentes, permissões/transições demonstradas, histórico preservado e docs correspondentes. Build verde isolado não encerra fluxo, fase ou release. Nenhuma fase de implementação foi iniciada por esta revisão.
