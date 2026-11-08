# Plano de padronização por fluxos completos

Atualização: 05/11/2026. **Fases 2A, 2B e 2C funcionalmente fechadas no piloto A/B do CALI MAPA. Fase 1 segue em andamento no seu escopo global.** A V2 é a base do primeiro lançamento operacional. Patrícia confirmou que ainda não usa nenhuma versão e que os dados são de teste. A V1 publicada serve como referência em leitura e o backend usa fixtures conforme DEC-27. A [publicação 83](BASELINE_REFERENCE_2026-10-26.md) é a referência funcional. As [regras de produto](PRODUCT_RULES.md) e [decisões](DECISIONS.md) definem o alvo e as diferenças aprovadas.

Objetivo: padronizar todos os fluxos Cliente/Admin sem passar várias fases construindo camadas antes da primeira jornada utilizável. Cada entrega fecha uma tarefa com interface, dados, regra, autorização, histórico, falhas e comunicação quando aplicável. “Fluxo completo” é unidade de construção; não cria fluxo novo nem significa que toda tela dispara e-mail. Chat não gera e-mail. Produção, migrations e canais externos exigem escopo próprio.

## Estado e cobertura

Já existem levantamento, 18 fichas, matriz estática, DS/UX/arquitetura propostos e decisões. Não repetir inventário como se estivesse vazio. Composição demonstrativa preservada junto da integração hospedada. Router, Query/Form, API modular de empresas, tokens e Button/Field existem; lint, testes, formatação, links e build compõem `npm run verify`. Workflow definido ainda não executado no GitHub. SDK, sessão e telas de acesso foram conectados em 01/11; jornada Admin em validação, demais atores/cenários ainda pendentes; RLS/persistência de adesão foram testados no laboratório, sem cobrir os demais domínios. Bibliotecas foram escolhidas pelo usuário em DEC-20.

O SHA `f3d3f14043a6abc38636f0340fe831e621d8b357` das fontes já corresponde à publicação 83. Os links continuam válidos; código/migrations não comprovam configuração ou aplicação no banco ativo. As 29 chamadas sem corpo localizado permanecem lacunas técnicas por operação, não motivo para inventar contrato.

Todos os IDs FLOW-01 a FLOW-18 permanecem rastreados. A rotina Admin/Cliente vem primeiro; depois DISC, demais fluxos Admin/Cliente e, por último, Partner. FLOW-17 inclui DISC como produto oficial, além de Forms e Mapa; sua implementação é separada por subfluxo. FLOW-15 cobre gestão Admin da equipe CALI e efeitos sobre acessos; área Partner completa permanece etapa posterior com recorte próprio.

## Recuperação e separação de ambientes — prioridade atual

DEC-28 foi revisada em 07/11/2026. CALI MAPA é staging de testes. Os lotes autorizados seguem com preflight, rollback e prova sintética, com backup e restauração dispensados. Recuperação e separação de ambientes integram a preparação da produção. [Cobertura, ordem e aceite](RUNBOOK.md#backup-restauração-e-ambientes--dec-28).

- [ ] Definir a captura do ambiente de produção, incluindo banco, arquivos do Storage, versões dos serviços e configurações, com cobertura e guarda protegida.
- [ ] Restaurar em destino isolado, bloquear comunicações externas e conferir integridade/permissões/arquivos; registrar prova de recuperação.
- [ ] Consolidar baseline efetiva e migrations ordenadas, com criação limpa e atualização reproduzíveis.
- [ ] Formalizar CALI MAPA como staging e preparar projeto de produção separado, sem fixtures, com configuração, Auth, Storage, funções, segredos e canais próprios; conferir recursos/custos antes de provisionar.
- [ ] Definir promoção staging/produção por commit e migration, backups, rollback e autorização de lançamento.

O ensaio de recuperação com fixtures passou localmente. A separação dos projetos de staging e produção segue planejada.

## Fases e dependências

| Fase | Entrada | Entrega/saída | Estado |
| --- | --- | --- | --- |
| 0 — Base documental e contrato de produto | Levantamento e revisão Patrícia/Felipe | Fontes, regras, decisões e cobertura rastreadas; sem comprovação operacional | Entregue documentalmente; resumo Admin definido em DEC-19 |
| 1 — Fundação mínima para o primeiro fluxo | 0 e execução local autorizada em 27/10 | Execução reproduzível, isolamento de teste, acesso e shell/DS estritamente necessários à primeira entrega | Em andamento; sessão/telas hospedadas e leitura real de empresas, aceite global pendente |
| 2 — Rotina Admin/Cliente | 1 e contratos de cada entrega | Empresas/acessos, Equipe e dados mensais, cada um utilizável de ponta a ponta | 2A, 2B e 2C homologadas funcionalmente no piloto A/B; frontend final pendente |
| 3 — Perfil comportamental DISC | Acesso/empresa e peças compartilhadas necessárias de 1/2 | Convite/resposta, avaliador interno e gestão/aprovação/entrega | Implementada no piloto; ativação final pendente |
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
- [x] Conectar fonte/eventos/refresh Auth e telas de código/MFA/termos à SPA hospedada em DEC-27; não equivale a portar a baseline local.

**Avanço de 01/11 — integração hospedada e comparação (DEC-27):**

- [x] Registrar autorização para o mesmo backend ainda não lançado, preservando dados existentes e sem migrations/deploy implícitos.
- [x] Conectar SDK 2.118.0 com namespace próprio, adapter Auth/Edge e agregação bloqueante por perfil/empresa/MFA/aceite.
- [x] Implementar telas de código, MFA, aceite e callback PKCE; corrigir payload de aceite (somente versão/hash) com teste de transição e falha. Callback bem-sucedido ainda não testado.
- [x] Conectar lista/detalhe/acessos de empresas, paginação, projeções Zod e keys por ator/vínculo; preservar composição demo e impedir métricas fictícias no modo conectado.
- [x] Preparar duas empresas e vínculos de teste identificados; POST 201, ativação aprovada PATCH 200 e GET de confirmação; sem alterar vínculos existentes. Primeira solicitação de código retornou 200 para os dois destinatários e perfis Cliente foram confirmados no vínculo correto; verificação/primeiro login Cliente ainda pendentes.
- [x] Usuário concluiu jornada Admin e aceite pela V2; lista real mostrou quatro empresas, busca de teste mostrou duas, detalhe de A mostrou somente seu vínculo e limpeza restaurou quatro. Comparação online leu as mesmas quatro empresas; não é cobertura de todos os fluxos.
- [ ] Completar comparação de estados/teclado/mobile, logout/expiração/revogação e Clientes A/B no hospedado; conferir diferenças de termos/MFA/RLS da baseline local.

**Rodada A/B — 01/11, em execução:**

- [x] Corrigir desmontagem do formulário por foco/intervalo e comprovar regressão com leitura assíncrona antes/depois; 120 testes no gate.
- [x] Preparar ferramenta manual de consultas/replay com credenciais somente em memória e restrição às fixtures, sem alterar TTL/schema/policies.
- [x] Registrar login/aceite A/B; próprio perfil/empresa acessíveis, perfil/empresa/convites alheios com zero linhas e rota Admin redirecionada para ambos. Não equivale à cobertura dos demais domínios.
- [x] Registrar inativação/restauração de A e logout real de A/B: Auth recusou JWT/refresh antigos, mas PostgREST ainda leu dados próprios com JWT não vencido. A foi restaurado e B preservado; ambos estão deslogados.
- [ ] Fechar lacuna de corte no servidor: logout ainda permite leitura pelo JWT até vencer e reativação do perfil recupera a mesma sessão. Nenhuma policy/schema alterada; ver [evidência e limites](LOCAL_ENVIRONMENT.md#rodada-cliente-ab--0111).
- [x] Observar expiração natural dos JWTs retidos A/B: 62 segundos além do prazo, Auth 403 e seis projeções do banco 401/PGRST303. Sem login, mudança de relógio/TTL ou código novo. Não prova refresh/expiração da SPA ativa.
- [x] Preparar candidata de corte no servidor, inventário somente leitura e suíte SQL em `supabase/proposals/session-cut`, fora de migrations/runners; nada executado em banco.
- [x] Obter metadados de acesso e revisar a fonte ativa da Edge. Registrar diferenças de códigos, provisionamento, escritores e abrangência das policies no [contrato](contracts/ACCESS_COMPANIES.md#reconciliação-com-o-catálogo-ativo--0411).

**Continuidade de 02/11 — correção local, sem repetir runtime:**

- [x] Recuperar resultado da cópia sintética anterior: 40 verificações, SQL/Auth/PostgREST reais, RPC/convite e janela adicional de hash pendente; sem equivalência com o catálogo hospedado.
- [x] Corrigir o código da troca no Edge V2: hash permanece no servidor; sessão só retorna após admissão vinculada à autorização do código; SPA aceita sessão admitida e mantém contrato legado hospedado explícito.
- [x] Preparar complemento SQL de admissão e adapter exclusivo do schema local conhecido; preservar runner experimental como texto ignorado e suspender drivers de runtime até reconciliação.
- [ ] Implementar e validar o adapter hospedado de admissão e o corte no recorte autorizado. Os SQLs candidatos foram exercitados em cópia descartável. A bateria anterior segue suspensa e a fase 1 continua aberta.

**Falta para fechar a fase 1:**

- [ ] Completar lacunas de contrato e baseline por operação: autorização dos próximos contratos e integração da SPA; DDL novo de códigos/termos já implementado/testado localmente; persistência da adesão e predicado unificado já testados no recorte local, sem equivaler à cobertura de todos os domínios; create_client_account segue ausente para 2A, sem impedir preparação sintética. MFA decidido em DEC-21 e testado no servidor da adesão; UI/sessão e demais superfícies pendentes. TEC-01/02 não foram declarados resolvidos globalmente.
- [ ] Ampliar os consumidores reais do laboratório já testado para código/termos/estado/revogação: conectar sessão e UI da SPA. CLI/rede/bindings/negativas de rede/captura e RLS de adesão foram testados em 29/10; OPEN-10 continua parcial para o fluxo completo. DEC-27 autoriza o hospedado para este recorte; a baseline local não foi aplicada nele.
- [x] Conectar autenticação/sessão/eventos, telas e callback no frontend; MFA e retorno seguro usam identidade real. Permanecem pendentes os cenários completos e a prova de callback.
- [ ] Completar comprovação/gate de adesão antes do convite e apresentar/validar conteúdo de uso/privacidade no frontend; aceite obrigatório por versão já testado no servidor. Usar contas/adesões preparadas para teste, sem antecipar o cadastro completo da fase 2A.
- [ ] Provar isolamento no servidor para Cliente A/B/Admin, perfil inativo, empresa bloqueada, expiração/revogação, logout e cancelamento/limpeza de cache/contexto.
- [ ] Validar URL direta/retorno após login e teclado/mobile dos estados de acesso reais; fixtures não encerram esse aceite.
- [ ] Executar/revisar CI no GitHub para a revisão enviada e concluir a revisão técnica do recorte; workflow definido não é execução comprovada.

Cadastro/contrato, convite e manutenção dos quatro acessos equivalentes de ponta a ponta são a entrega 2A. O DS e as demais extrações crescem junto dos fluxos; não são um catálogo completo a terminar antes de 2A. Fontes de evidência: [arquitetura](ARCHITECTURE.md), [runbook](RUNBOOK.md), [changelog](CHANGELOG.md) e [ficha de acesso/contas](flows/ACCESS_ACCOUNTS.md).

**Próximo passo técnico de integração:** reconciliar as guardas de RPC e Storage para o opt-in hospedado. O [contrato](contracts/ACCESS_COMPANIES.md#provisionamento-no-primeiro-acesso-v2--0411) registra a candidata de provisionamento e admissão isolada. O CALI MAPA tem evidência de cadastro/comprovação pelo Admin e isolamento de leitura A/B no recorte histórico. Corte hospedado, callback e regressão nas demais superfícies seguem pendentes.

**Bloqueios:** TEC-01 para contrato de acesso ausente; TEC-02 para sessão, papel, empresa, MFA e superfícies reais; OPEN-10 para ambiente. Corpos ausentes de agenda ou relatórios não bloqueiam o primeiro fluxo se independentes.

**Aceite:** instalação limpa e comandos implantados passam na revisão registrada; configuração inválida não toca produção; sessão ativa/inativa/expirada e atores A/B/Admin exercitados no ambiente autorizado; URL direta/retorno/logout e limpeza de contexto funcionam; UI básica legível/mobile/teclado. Fundação isolada não é declarada fluxo de produto completo; o primeiro resultado de uso fecha em 2A.

## Fase 2 — Rotina Admin/Cliente completa

**Acompanhamento 2A — iniciado em 02/11, sem encerramento da fase 1:**

- [x] Implementar detalhe com razão social e formulário inline de edição básica; Admin pronto na composição conectada, validação, cancelamento, estado pendente/erro/confirmado e manutenção do rascunho.
- [x] Implementar PATCH dos dois nomes com comparação atômica de preimagem, confirmação de linha e invalidação por ator; mocks isolados por instância e regressões de transporte/UI.
- [x] Implementar identidade mínima, referências de adesão e autorizações equivalentes no transporte demonstrativo, sem efeitos Auth/e-mail; composição hospedada declara capacidade indisponível, sem fallback.
- [x] Implementar gate demonstrativo de comprovação vigente por empresa (referência isolada não libera), limite de quatro na fronteira mock, bloqueio de duplicados, preimagem, reautorização explícita, histórico e proteção de repetição de comandos virtuais.
- [x] Implementar formulários/estados/cancelamento/confirmar revogação e continuidade por URL; testes do modelo/UI sem executar a bateria suspensa.
- [x] Consolidar composição técnica de acesso/empresas: coordenação em hooks, etapas e tarefas separadas, mapas tipados e primitivas de checkbox/feedback. Não encerra migração global do frontend nem homologa backend.
- [x] Homologar escrita e persistência da ficha, adesão e ciclo no piloto CALI MAPA. Isolamento e gestão por convite exercitados no navegador e na cópia descartável, conforme evidências abaixo.
- [x] Conferir GRANTs, RPC de cadastro e código de login implantado. Preparar [candidata de rascunho e comprovação](contracts/ACCESS_COMPANIES.md#fase-2a--candidata-de-cadastro-e-comprovação), fora dos runners.
- [x] Aplicar a migration de rascunho/comprovação no CALI MAPA autorizado para testes. Conferir catálogo, GRANTs e recusas SQL sintéticas.
- [x] Validar Admin pela Data API e conectar listagem paginada, cadastro em rascunho, comprovação e retirada à UI. Reabrir o rascunho após recarregar e conferir o histórico no CALI MAPA.
- [x] Criar empresa definitiva pela tela Admin e persistir o vínculo com o rascunho. Validar reabertura pela Data API e repetição concorrente em banco descartável.
- [x] Vincular a comprovação ao contrato ou aditivo da empresa no Storage. Validar a seleção e o histórico após recarga no CALI MAPA e a rejeição de versão incorreta em PostgreSQL descartável.
- [x] Preparar a pré-condição privada de adesão vigente para convite e reautorização. Testar empresa pausada e bloqueada, versão substituída e retirada em PostgreSQL descartável.
- [x] Integrar a candidata de convite, reserva e revogação aos SQLs de corte e admissão. Provar quatro vagas com cinco solicitações simultâneas, corte da sessão antiga e preservação de outro Cliente em PostgreSQL descartável.
- [x] Homologar entrega local de convites, login por código, refresh e revogação com GoTrue, PostgREST e Mailpit em cópia descartável. Provar que o hash anterior ao corte não libera leitura após reativação.
- [x] Conferir a Edge publicada e o catálogo do CALI MAPA. No navegador, reabrir a ficha sintética, ler histórico e versão do Storage e verificar o estado da gestão de convites.
- [x] Exigir admissão desde a primeira sessão Cliente de empresa gerenciada na candidata isolada. Preservar sessão legada sem corte fora da gestão no controle SQL.
- [x] Implementar a candidata isolada de provisionamento e admissão V2. Criar a identidade pelo Auth, vincular ao convite gerenciado e recuperar uma criação parcial sem adotar conta de outro fluxo.
- [x] Exercitar o primeiro acesso no Chrome, confirmar aceite e consulta da empresa e verificar o bloqueio após revogação pela RPC e recarga. Consultar a navegação do Admin na V1 publicada como referência com sessão de teste existente.
- [x] Reconciliar provisionamento, admissão e revogação por convite no piloto hospedado. A2 entrou e foi revogado individualmente. A limpeza do legado e a ampliação do piloto têm gates próprios. O corte de arquivos segue separado abaixo.

- [x] Implementar ficha administrativa demonstrativa de contrato/financeiro/referências documentais, com revisão, histórico, rascunhos e confirmação; nenhuma cobrança, arquivo real ou ciclo é executado.
- [x] Implementar dados cadastrais complementares demonstrativos: serviço/plano/horas, segmento, endereço/filiais, contato comercial e logo local, com revisão/histórico e frontend separado por tarefa; sem Auth, upload ou automações.
- [x] Implementar arquivos contratuais demonstrativos: anexo, versões imutáveis, download explícito, retirada com motivo/histórico e integridade dos bytes, sem storage hospedado.
- [x] Implementar comprovação administrativa demonstrativa: referência/observação, versão documental opcional, confirmação explícita, retirada preservando histórico e gate de novas autorizações/reativações; sem upload obrigatório nem revogação implícita.
- [x] Implementar ponta Cliente de consulta: Minha empresa com GET mínimo do vínculo autenticado, navegação/retorno, termos correntes somente leitura e estados/falhas sem fallback para mocks; teste sintético não homologa leitura autenticada da tela.

- [x] Conectar a leitura de serviço e plano e editar segmento, horas, endereço e filiais no recorte A/B. Conferir persistência e auditoria após recarga em B.
- [x] Preparar banco e interface da reserva por convite. Instalar o banco sem destinatários aprovados. Provar provisionamento e cancelamento na cópia descartável.
- [x] Homologar o primeiro acesso de A2 no CALI MAPA, com dois vínculos na mesma empresa. Revogar A2, confirmar continuidade de A1 e B e retirar o destinatário temporário.
- [x] Homologar o corte de arquivos no piloto A/B. B recebeu o próprio PDF com `200` e SHA-256 confirmado. Após revogação, a mesma sessão recebeu `403` e zero bytes. A continuou com `200` e o PDF correto. Os dois caminhos antigos recusaram novas requisições. [Contrato e evidência](contracts/ACCESS_COMPANIES.md#download-de-homologação-revogável--0411).
- [x] Conectar contato comercial, logo privada, troca de plano e condições contratuais na ficha A/B. O Admin gravou os campos sintéticos de B e o banco confirmou os registros. Configuração de cobrança integra a ficha. Emissão, pagamento e automação exigem fluxo financeiro próprio.

**Evidência consolidada do piloto.** A [publicação vigente e o aceite com hash](RUNBOOK.md#aceite-vigente-e-arquivos-da-fase-2a) estão no CALI MAPA, com quatro recibos legados preservados. A [admissão A/B](RUNBOOK.md#piloto-de-admissão-ab) permitiu login, aceite e consulta. O piloto passou à chave por convite, validou um segundo Cliente A2 e revogou seu acesso mantendo A1 e B. A2 e a autorização temporária foram removidos. A flag de provisionamento voltou a ficar desligada. A [cópia descartável](RUNBOOK.md#pré-condições-para-quatro-vagas-hospedadas) confirmou o limite sob concorrência.

A [variante com Storage](LOCAL_ENVIRONMENT.md#variante-com-storage) comprovou que a revogação na origem não invalida uma resposta já armazenada. O CALI MAPA arquivou os dois PDFs sintéticos e homologou a nova rota sem cache para A/B. A entrega de documentos do Cliente na 4C exige seu próprio contrato e validação para arquivos reais e links anteriores.

O catálogo hospedado confirmou `service_cycles` com unicidade por `(company_id, reference_month)`, estados `planned`, `open`, `review` e `closed`, e leitura Cliente por `current_company_id()`. A ficha Admin consulta os 12 ciclos mais recentes. A [abertura do mês](../supabase/proposals/company-onboarding/open-current-cycle.sql) abriu novembro de 2026 para A/B. As [transições do piloto](RUNBOOK.md#ciclo-de-serviço-ab) estão instaladas; A passou por revisão e foi encerrada pelo Admin, com horas e trilha preservadas. B ficou aberta. Abertura de planejado passou na cópia isolada.

Cada linha é uma entrega independente, incluindo contrato/adaptador real de teste, interface, validação e documentação. Não esperar toda a fase 2 para revisar 2A.

| Entrega | Dependências | Conteúdo e aceite observável |
| --- | --- | --- |
| 2A — Empresa e acessos | 1; conta, adesão, convite e ciclo | Admin cadastra/acompanha empresa e acessos; Cliente entra no contexto correto; até quatro acessos equivalentes; sem principal; revogar um preserva demais; conta bloqueada não mantém acesso; aceite/privacidade versionados; perfil e retorno contextual necessários |
| [2B — Equipe](contracts/TEAM_2B.md) | 2A; contratos de pessoas, privados e histórico | Cadastro/consulta/alteração/arquivamento e importação com prévia; todos os Clientes mantêm Equipe; Cliente/Admin informam/consultam privados permitidos; sem dados de outra empresa; ausentes no CSV não são desligados; datas efetivas, histórico e leitores coerentes |
| [2C — Dados mensais e confirmação](contracts/TEAM_MONTHLY_2C.md) | 2B e períodos/métricas/revisão mensal | Pedido de dados aparece só ao Cliente; Cliente lança; correção posterior só Admin; confirmação e resumos consistentes; cenários vazios/retroativos e falhas; fórmulas oficiais preservadas; comunicação apenas conforme contrato definido |

**Acompanhamento 2B — Equipe**

- [x] Inventariar referência 83 e catálogo ativo. Separar Equipe da confirmação mensal.
- [x] Conectar diretório, estrutura, cadastro, edição, arquivamento, privados, prévia de importação e histórico no piloto A/B. Registrar SQL, rollback e testes focados na [ficha 2B](contracts/TEAM_2B.md).
- [x] Exercitar o fluxo autenticado de Cliente B no navegador integrado. Confirmar persistência, dados privados, importação, ausentes e arquivamento. Validar equivalência e corte individual na cópia descartável.
- [x] Validar Admin com MFA no navegador integrado. Confirmar seleção A/B, filtro de arquivados, abertura por teclado, recarga e restauração da seção ao voltar e avançar.
- [x] Conferir Equipe com Cliente A autenticado no navegador integrado. Reativação, alteração, privados, recarga, estrutura, recusa de ficha B e arquivamento com trilha passaram no CALI MAPA.
**Coleta real antes do lançamento.** Validar a informação de finalidade, necessidade e guarda antes de abrir a coleta de dados reais.

**Acompanhamento 2C — Dados e confirmação mensais**

- [x] Conferir catálogo ativo e referência 83. Registrar fronteiras, janela e DEC-05/10 no [contrato 2C](contracts/TEAM_MONTHLY_2C.md).
- [x] Implementar leitura e primeiro lançamento Cliente, correção Admin, auditoria e proteção da escrita direta no piloto. SQL descartável e primeira rodada autenticada A/Admin passaram.
- [x] Implementar confirmação, snapshots e vagas com versão e transação. Preimagem, replay, token obsoleto e falha atômica passaram na cópia descartável.
- [x] Conectar pendência Cliente, métricas e indicadores essenciais preservando fórmulas. Aviso do Início desaparece após confirmar; nulos e denominador zero permanecem explícitos.
- [x] Homologar A/B/Admin no navegador integrado e registrar testes focados, limites e rollback. Confirmação/reconfirmação, vaga/cancelamento, correção Admin, mês anterior vazio, recarga, contexto e mobile passaram. Complemento de leitura direta aplicado somente A/B.

**Frontend antes do lançamento.** A paridade visual do layout, navegação e Equipe por perfil com a publicação 83 permanece pendente. Felipe autorizou em 05/11 a continuidade da homologação funcional na composição simplificada. A substituição visual fica para a implementação do frontend final.

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

**Gates de operação real:** ativação de agenda autenticada, textos/finalidade/guarda e frontend final. A revisão do worker PDF foi publicada por autorização específica em 05/11. Contratos de projeção/token, liberação e assinatura/protocolo estão implementados e testados no piloto. Método de cálculo existente é preservado, sem novo algoritmo de avaliação. Não certificar validade científica nesta padronização.

**Execução de 05/11:** Felipe autorizou 3A, 3B e 3C em conjunto. [Plano, inventário e contrato](contracts/DISC_3.md). Investigações e interfaces independentes seguem em paralelo; banco, aprovação e entrega seguem suas dependências.

- [x] Inventariar contratos ativos e referência 83 em leitura; separar públicos conforme DEC-13.
- [x] Implementar e provar fundação privada, versões e fila de entrega no piloto.
- [x] Conectar 3A no piloto manual: convite, resposta, agradecimento, PDF e comunicação de teste.
- [x] Conectar 3B: avaliador interno sem acesso Cliente/público.
- [x] Conectar 3C no piloto: gestão, aprovação/liberação, assinatura/protocolo e entrega.
- [x] Homologar recorte sintético de limites, permissões, falhas/replay, navegador e artefatos; registrar rollback e PR.

### Estado da entrega DISC em 05/11

3A/3B/3C têm código, contratos e provas sintéticas. Questionário completo, PDF individual aceito pelo provedor, avaliador Admin, gestão liberada somente a A e PDF privado foram exercitados. Limiar 4/5/14/15, rejeições, replay e histórico têm prova SQL descartável. [Evidências e limites](contracts/DISC_3.md).

- [x] Publicar revisão do worker de PDF após autorização explícita: versão 4 publicada com JWT obrigatório, código publicado conferido e catálogo inalterado.
- [x] Implementar e testar localmente agenda autenticada, janela de envio/retentativa, concorrência, desligamento e rollback, sem alterar o hospedado.
- [x] Conferir em leitura worker, extensões, fila e preimagem do rollback no CALI MAPA. Em 05/11, agenda desligada, segredo Vault ausente e recuperação DEC-28 sem evidência.
- [x] Aplicar incremento privado da agenda, publicar worker v5 e configurar Vault no CALI MAPA, com dispensa de backup para o lote e rollback conferido.
- [x] Homologar a chamada autenticada do cron DISC no CALI MAPA com fila vazia e desligamento confirmado.
- [ ] Preparar o ambiente de homologação e concluir a validação interna do DISC. Incluir envio pelo cron somente se previsto na janela de teste. Patrícia valida o DISC no aceite final da V2.
- [ ] Validar textos/finalidade/guarda para coleta real e paridade visual antes do lançamento.

Esses itens impedem declarar a fase 3 pronta para operação real. Não reabrem a bateria suspensa nem exigem repetir a homologação completa.

## Fase 4 — Demais fluxos Cliente/Admin

Conduzir cada domínio por entrega completa; dependências são de dados/operação, não barreiras artificiais de lote. A primeira entrega não elimina as demais do escopo.

**Em andamento (07/11):** [consultas da fase 4](contracts/PHASE_4_READ.md) implementadas nos cinco recortes, com SQL validado em PostgreSQL descartável. Os incrementos operacionais cobrem cronograma, execução e revisão de entregáveis com PDF privado no piloto, horas com extrato e capacidade mensal, agenda ordinária com remarcação e cancelamento, ocorrências com avaliação e reabertura, mural, PDFs privados por revisão, aprovação, PDF executivo, publicação no app, correção e ciência de relatório por revisão, criação e edição de rascunhos de Forms com perguntas de texto, abertura, encerramento e triagem de Forms, pedidos de privacidade, leitura, edição de condições e aprovação interna de propostas inscritas, auditoria operacional selecionada com eventos de Forms e acompanhamento de notas baixas. Em 07/11, o [lote de Projetos](contracts/PHASE_4_READ.md#lote-de-projetos-e-entregáveis-no-cali-mapa) homologou cronograma, ajuste por item, aprovação, PDF, reabertura e nova aprovação com Admin e Cliente A; B ficou sem acesso ao projeto. Subtarefas, conversa, dependências, prazo e pausa/retomada por entregável também foram homologados no projeto inscrito. Paridade visual e migração de arquivos legados permanecem fora da prova funcional do piloto. O [lote de Horas](contracts/PHASE_4_READ.md#lote-de-lançamento-e-timer-no-cali-mapa) homologou lançamento, pausa, retomada, conclusão e privacidade do extrato. A [agenda ordinária](contracts/PHASE_4_READ.md#lote-de-agenda-ordinária-no-cali-mapa) passou da solicitação ao cancelamento com remarcação no mesmo evento, sem cobrança nem sincronização externa. O [lote de ocorrências, avisos e satisfação](contracts/PHASE_4_READ.md#lote-de-ocorrências-avisos-e-satisfação-no-cali-mapa) comprovou reabertura com nota preservada, aviso dirigido com ciência e acompanhamento Admin, com isolamento A/B. A [biblioteca de PDFs](contracts/PHASE_4_READ.md#lote-da-biblioteca-de-pdfs-no-cali-mapa) comprovou publicação, ciência por revisão, recusa de download antigo e retirada. O [relatório mensal interno](contracts/PHASE_4_READ.md#lote-de-aprovação-interna-de-relatório-no-cali-mapa) passou por duas aprovações do mesmo protocolo; O [PDF executivo](contracts/PHASE_4_READ.md#lote-de-pdf-executivo-no-cali-mapa) foi gerado, liberado, baixado, aceito por ciência e retirado no piloto; a função temporária foi desligada. O [pedido de privacidade](contracts/PHASE_4_READ.md#lote-de-pedido-de-privacidade-no-cali-mapa) passou da abertura à resposta com trilha e sem notificações. A [consulta do ciclo de dados](contracts/PHASE_4_READ.md#consulta-do-ciclo-de-dados-no-cali-mapa) foi homologada em A/B sem exportação ou eliminação. Os [PDFs de ocorrências](contracts/PHASE_4_READ.md#anexos-pdf-de-ocorrências-no-cali-mapa) passaram por postagem, download e retirada com isolamento A/B. As [interações de avisos](contracts/PHASE_4_READ.md#interações-de-avisos-no-cali-mapa) passaram com comentário, resposta, troca e retirada de reação. A [prévia do resumo diário Admin](contracts/PHASE_4_READ.md#prévia-do-resumo-diário-admin-no-cali-mapa) foi homologada sem cron nem envio. A matriz do contrato detalha o que ainda falta em cada recorte. O [lote de Forms](contracts/PHASE_4_READ.md#lote-de-homologação-de-forms-no-cali-mapa) foi aplicado no CALI MAPA. Criação, edição, persistência e isolamento A/B do rascunho foram verificados com Admin no navegador. Triagem com resposta sintética foi verificada com etapa e responsável persistidos, auditoria e isolamento A/B. O [lote de leitura A/B](contracts/PHASE_4_READ.md#lote-de-leitura-para-homologação-ab) foi aplicado e homologado no CALI MAPA. Admin e Cliente validaram consultas, detalhe de projeto, mês visível e oculto de Horas, fronteira A/B e estados de catálogo. A Auditoria foi homologada com os eventos de Forms em A, lista vazia em B e bloqueio da rota para Cliente. Coleta segue fechada. A [guarda V2 de abertura pública](contracts/PHASE_4_READ.md#confirmação-de-coleta-pública-em-forms) exige confirmação e foi instalada; o leitor legado continua público por slug. Homologação dos demais lotes e paridade visual continuam pendentes.

| Entrega | Conteúdo | Dependências e saída |
| --- | --- | --- |
| 4A — Projetos e entregáveis | Frentes, planejamento, cronograma, revisão, execução, aprovação, ajustes e conversas | Empresa e contratos de projeto; regras de prazo/capacidade reconciliadas; reabertura com motivo/histórico, indisponível até liberação e nova aprovação; frentes contratadas não se confundem com workstreams |
| 4B — Horas e agenda | Timer/manual, extrato/ciclo, capacidade e solicitações/reuniões | Projeto/vínculo quando exigidos; pausa/retomada sem dupla contagem; Cliente consulta sem justificativa interna; agenda sem duplicidade; preço aceito preservado e status externo verdadeiro |
| 4C — Interações, documentos e avisos | Ocorrências/conversas, anexos, versões/ciência, mural/agenda/notificações | Público, autoria e storage; nota interna não vaza; mesma origem dos leitores de Avisos; chat sem e-mail; resumo Admin diário conforme RESUMO-01/DEC-19; testar corte, volume, exclusões e dias sem atividade; versão Partner posterior |
| 4D — Relatórios executivos e satisfação | Fatos/período, curadoria, aprovação, PDF, publicação, ciência e tratamento de avaliação | Fontes integradas, autoria/assinatura/protocolo e auditoria; tela/PDF correspondem à revisão; reabertura oculta até liberar; nova ciência só a pedido Admin; feedback original preservado |
| 4E — Comercial, módulos adicionais e ciclo de dados | Propostas, Forms, Mapa, frentes/ajuda, auditoria, direitos, exportação/encerramento e administração equipe CALI | Contratos próprios, públicos e permissões por operação; proposta aceita não vira pré-requisito novo de cadastro; Forms/Mapa não são DISC; staff Admin não equivale a construir área Partner; cobertura e falha parcial do ciclo de dados comprovadas |

### Pendências para fechar a fase 4

| Recorte | Trabalho restante | Dependência específica |
| --- | --- | --- |
| 4A — Projetos | [Aviso de revisão vencida homologado no staging](contracts/PHASE_4_READ.md#prazo-de-revisão-vencido-no-cali-mapa). [Cópia sintética ensaiada no CALI MAPA com rollback](contracts/PHASE_4_READ.md#acervo-legado-de-entregáveis). Falta paridade do fluxo | Os três arquivos inventariados ficam para o rollout, junto do corte dos leitores legados e da liberação controlada da reabertura |
| 4B — Horas e agenda | Fechada funcionalmente no staging. [Google Calendar/Meet fica para revisão pré-rollout](flows/CALENDAR.md#revisão-pré-rollout) | [Realização, comprovantes e reuso de horário cancelado](contracts/PHASE_4_READ.md#conclusão-da-visita-extra-e-comprovantes-no-cali-mapa) homologados no navegador. [Abertura, orçamento, despesas, recusa e taxa](contracts/PHASE_4_READ.md#abertura-de-extras-revisão-de-orçamento-e-despesas) já homologados |
| 4C — Interações | Formatos adicionais e fontes restantes do resumo. [Envio ao simulador do Resend](contracts/PHASE_4_READ.md#envio-sintético-do-resumo-admin-pelo-resend) validado com um único recibo e remoção dos recursos temporários. Agendamento e destinatários autorizados ficam para o rollout. Acervo legado fica para o rollout. [Relatórios liberados entram na prévia](contracts/PHASE_4_READ.md#prévia-do-resumo-diário-admin-no-cali-mapa). [Capa de avisos homologada](contracts/PHASE_4_READ.md#capas-privadas-no-mural) | [Moderação](contracts/PHASE_4_READ.md#moderação-de-comentários-no-staging) homologada. [Cron legado pausado no staging](contracts/PHASE_4_READ.md#contenção-do-resumo-legado-no-staging) até separar dados e destinatários do teste |
| 4D — Relatórios | [Contagens visíveis ao Cliente homologadas na tela e no PDF](contracts/PHASE_4_READ.md#contagens-visíveis-ao-cliente-na-tela-e-no-pdf). Paridade visual completa fica no aceite final | Contagens congeladas por revisão e fórmulas vigentes preservadas. [Curadoria e republicação já homologadas](contracts/PHASE_4_READ.md#republicação-com-curadoria-no-cali-mapa) |
| 4E — Comercial e administração | Ativação comercial e parâmetros de priorização do Portal, formatos adicionais e acervo de Forms, envio do relatório do Mapa, convite e gestão de acesso da Equipe CALI e execução da eliminação. [Rascunhos](contracts/PHASE_4_READ.md#rascunhos-administrativos-da-equipe-cali) e [ativação sintética](contracts/PHASE_4_READ.md#ativação-sintética-da-equipe-cali) homologados. [Coleta pública de texto](contracts/PHASE_4_READ.md#coleta-pública-de-texto-na-v2) e [Excel do texto](contracts/PHASE_4_READ.md#exportação-excel-de-forms) homologados. [Número e data](contracts/PHASE_4_READ.md#tipos-numérico-e-data-em-forms) e [alternativas](contracts/PHASE_4_READ.md#alternativas-em-forms) ensaiados no CALI MAPA. [Guarda de abertura](contracts/PHASE_4_READ.md#compatibilidade-da-abertura-de-forms) homologada no Admin. [Caminhos condicionais e PDF](contracts/PHASE_4_READ.md#caminhos-condicionais-e-pdf-de-resposta-em-forms) ensaiados no CALI MAPA. [Calculadora dos demais serviços](contracts/PHASE_4_READ.md#calculadora-do-portfólio-no-cali-mapa) verificada com referência do Portal e uma proposta sintética no navegador. [Triagem](contracts/PHASE_4_READ.md#triagem-do-mapa-de-people) e [jornada e relatório](contracts/PHASE_4_READ.md#jornada-e-relatório-detalhado-do-mapa) no CALI MAPA. Jornada homologada em A/B e PDF renderizado localmente. Modalidades de [Frentes](contracts/PHASE_4_READ.md#gestão-administrativa-de-frentes-no-cali-mapa) homologadas | [Calculadora CALI Build, PDF no simulador e aceite por link local](contracts/PHASE_4_READ.md#calculadora-cali-build-e-e-mail-sintético), [envio no Workspace](contracts/PHASE_4_READ.md#criação-envio-no-workspace-e-aceite-no-staging) e [consulta de Equipe CALI](contracts/PHASE_4_READ.md#equipe-cali-por-empresa) homologados no staging. [Exportação estruturada e prévia](contracts/PHASE_4_READ.md#exportação-estruturada-e-prévia-de-eliminação) instaladas. Execução da eliminação exige cobertura completa e prova de retomada após falha parcial |

As instalações autorizadas no CALI MAPA seguem com preflight e rollback por lote. A validação da Patrícia permanece no aceite final, após os testes internos. [Evidência e sequência](RUNBOOK.md#backup-restauração-e-ambientes--dec-28).

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
| FLOW-09 — [Agenda](flows/CALENDAR.md) | 4B; solicitação/capacidade aplicáveis | Solicitar/confirmar/remarcar/cancelar sem duplicar; conflito/timezone/prazo/preço aceito; Google Calendar/Meet em revisão pré-rollout | REF-05/12/16 |
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

**Aceite com Patrícia:** compartilhar o acesso quando todo o escopo combinado da V2 estiver concluído, a validação interna tiver passado e o ambiente de homologação estiver pronto. Completar o [roteiro de aceite](HOMOLOGACAO_PATRICIA.md) com os fluxos entregues até lá.

**Preparação 6:** [roteiro interno de regressão](HOMOLOGACAO_PATRICIA.md#roteiro-de-regressão-interna-da-fase-4) consolidado com percursos e provas existentes. A rodada integral e o aceite seguem pendentes.

**7 — Preparação de release:** conferir hosting de teste, URLs diretas/callbacks, observabilidade sem dados privados, baseline/limites de bundle/carregamento, compatibilidade, backup/restauração e corte. DEC-28 mantém a recuperação no preparo de produção. No release, comprovar a restauração e confirmar os projetos separados. Rollback distingue UI, contrato/migration e dados escritos; testar restauração no ambiente isolado. Registrar aceites funcional, UX, acesso/dados e operação. Merge/deploy/produção exigem escopo e autorização próprios; preparar não significa publicar.

**Preparação 7:** [preview local](RUNBOOK.md#prova-local-do-build-e-das-urls) conferiu URLs diretas, callback como rota HTTP e ativos. O build carrega os módulos de demonstração sob demanda. Hosting de teste e callback autenticado seguem pendentes.

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

Registrar execução no [changelog](CHANGELOG.md), conforme [Política de mudança](CHANGE_POLICY.md). Distinguir planejado, bloqueado, implementado e validado. A fase 1 tem integração parcial. A 2A, a 2B e a 2C têm homologação funcional no piloto A/B do CALI MAPA, com os limites registrados nos contratos donos. A fase 3 está implementada no piloto, com ativação final pendente. A separação de ambientes permanece registrada na DEC-28. Backup foi dispensado para os lotes autorizados no staging. A evolução das demais entregas está na [tabela de fases](#fases-e-dependências).
