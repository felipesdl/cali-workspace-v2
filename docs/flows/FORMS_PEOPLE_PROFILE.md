# FLOW-17 — Mapa de People, formulários e perfil comportamental

Ficha de paridade de Mapa, Forms e perfil comportamental. **DISC é linha oficial do produto e integra a V2**, com três relatórios de públicos distintos; não é avaliação de desempenho. Cliente/Admin são o recorte; destinatário público é outro ator. [Contrato comum](README.md); [matriz](../PERMISSIONS.md).

**Alvo vigente em 26/10/2026 — DEC-13, substitui DEC-07:** Cliente consulta somente gestão após liberação CALI; avaliador é interno e não tem opção de liberação; respondente recebe somente PDF próprio por e-mail, com tela final de agradecimento. Metodologia/cálculos não são expostos ao respondente. Contrato: [Regras de produto](../PRODUCT_RULES.md). Fonte funcional: [publicação 83](../BASELINE_REFERENCE_2026-10-26.md). Leitura individual/token das tabelas abaixo é evidência legada a reconciliar, não alvo a reproduzir.

## Transições alvo DISC

| Etapa | Ação/condição | Resultado exigido |
| --- | --- | --- |
| Convite enviado | Sete dias, fim do dia em Brasília | Expiração/fuso controlados; até três lembretes, segunda a sexta, 8h–18h; pessoa focal avisada na véspera/no encerramento |
| Resposta concluída | Geração/envio conforme contrato | Agradecimento e PDF próprio por e-mail; sem relatório/metodologia/cálculo na tela ou endpoint público de resultado |
| Resultado técnico | Operação interna CALI | Avaliador restrito; sem alternador de liberação ao Cliente/respondente |
| Gestão em rascunho | Cinco respostas, resultado buscado e parecer Patrícia | Pode aprovar; cinco a 14 sem números/gráficos; nenhum nome de respondente |
| Gestão aprovada | Assinatura/foto/protocolo e liberação da revisão | Com conta: app e aviso por e-mail; sem conta: PDF ao gestor; geração/aprovação/liberação/envio auditados |
| Conteúdo alterado | Voltar a rascunho, preservando histórico | Nova aprovação interna/liberação; ciência Cliente só se solicitada pelo Admin, conforme DEC-12 |

## Objetivo, fontes e composição

- **Mapa de People:** Admin acompanha jornadas, revisa registros e abre relatório. Fontes: [UI](SOURCES.md#mapa-ui), [bridge de schema](SOURCES.md#mapa), [grants posteriores](SOURCES.md#response-hours). Corpos das quatro RPCs `workspace_mapa_people_*`/`workspace_update_mapa_people_record` não foram localizados; comentário afirma guarda Admin, sem corpo para comprová-la.
- **Forms:** Admin cria/abre/encerra formulário, acompanha/edita respostas e exporta. Público responde por slug em `/f/:slug`. Fontes: [tabelas/RLS](SOURCES.md#forms), [validação/upload](SOURCES.md#forms-submit), [projeção pública](SOURCES.md#forms-public), [pipeline](SOURCES.md#forms-pipeline), [Admin UI](SOURCES.md#forms-ui).
- **Perfil comportamental:** Admin gerencia links/convites/resultados e relatório de gestão; respondente usa slug/token; Cliente acessa o que foi liberado à empresa. Fontes: [tabelas/RLS/submissão](SOURCES.md#profile), [convites](SOURCES.md#profile-invites), [gestão/entrega](SOURCES.md#profile-gestao), [campanha UI](SOURCES.md#profile-campaign), [avaliador individual](SOURCES.md#profile-evaluator).

Anatomia: listas Admin, editor de perguntas/configurações, respostas/triagem, relatório técnico e relatório agregado separados. Não misturar conteúdo público, respostas individuais e leitura de gestão no mesmo DTO.

## Transições e guardas observadas na fonte estática

| Objeto/anterior | Ação/ator | Guarda/camada | Seguinte/efeito |
| --- | --- | --- | --- |
| Jornada Mapa | Consultar/atualizar Admin UI | Sessão e grant authenticated nas RPCs; corpo ausente | Status e efeitos de atualização não comprováveis neste repo |
| Form draft/closed | Abrir Admin | Policy forms_admin_all | Open, disponível por slug |
| Form open | Encerrar Admin | Mesma policy | Closed; projeção pública devolve sem perguntas |
| Form open | Responder público ou Cliente como destinatário | RPC pública valida JSON/tamanho, tipos/obrigatórias e campos conhecidos; limite 30 respostas/minuto por form | Cria resposta; pode solicitar confirmação por e-mail |
| Form open com pergunta file | Anexar público | Helper de formulário aberto/arquivo e path vinculado | Upload permitido no caminho correspondente; não concede SELECT geral de respostas |
| Resposta existente | Editar/triagem/excluir Admin | RLS Admin; grants por coluna e políticas posteriores de acompanhamento | Atualiza resposta/nota/contato/stage/owner ou exclui; histórico da resposta editada precisa de política própria |
| Link perfil open/closed | Administrar Admin | Policy Admin | Abre/fecha recebimento; vínculo a empresa opcional |
| Link perfil open | Responder público | Nome/e-mail/consentimento; 18 blocos naturais e seis de pressão, validação de escolhas | Resultado com token; método de cálculo versionado, com patch posterior de critério |
| Convite criado | Enviar Admin | Admin; link open; convite ainda elegível | Define sent_at/deadline; dispara e-mail |
| Convite enviado | Abrir/iniciar/recusar destinatário | Token e estados conforme RPC | Estados derivados created/sent/opened/started/declined/expired/completed |
| Convite elegível | Concluir destinatário | Não completed/declined, enviado, dentro do prazo, submissão válida | Resultado ligado ao convite/pessoa e completed_at |
| Resultado individual | Ler destinatário por token | RPC pública resolve access_token | Projeção do próprio resultado identificado pelo token; não é conta Cliente |
| Gestão ainda não aprovada | Aprovar Admin | Admin; pelo menos cinco e-mails distintos com resposta, objetivo >=3, parecer >=20 | Protocolo e assinatura congelados |
| Gestão aprovada | Liberar Admin | Admin, aprovada e empresa vinculada | gestao_released_at e comunicação; Cliente pode consultar agregado da própria empresa |
| Gestão aprovada | Enviar PDF Admin | Admin, e-mail válido e path gestao/link | Log e solicitação de envio externo |
| Gestão aprovada/liberada | Reabrir/retirar Admin | RPC Admin | Limpa aprovação/liberação conforme ação; não inventar irreversibilidade |

## Permissões e divergência de resultado individual

Forms não têm policy de gestão/leitura geral de respostas para Cliente: ser destinatário de um slug público não transforma usuário em administrador do formulário.

Em perfil, a fonte estática contém policy `profile_results_client_visible`, rota Cliente do avaliador e leitura pública por token. **DEC-13 resolve o produto em sentido mais restrito:** avaliador interno, respondente só PDF/e-mail e Cliente só gestão liberada. Na implementação, reconciliar rotas, projeções, RPC, arquivos e tokens legados; esconder botão não garante negação. Gestão via RPC é operação distinta, com critérios de aprovação/liberação. Nenhuma policy foi alterada nesta documentação.

## Continuidade, falhas e aceite

Retorno Admin por link/campanha/resposta; resposta pública deve distinguir fechado, inválido, prazo encerrado e já enviado. Não presumir persistência/reabertura de respostas no navegador além do que a fonte implementa. Bloqueio de link e token de resultado são mecanismos diferentes.

Aceite proposto: Cliente não lista respostas gerais Forms; slug fechado; tipos/campos/arquivo fora do path; edição Admin preserva evidência; token inválido/convite expirado/recusado; três lembretes/janela/fuso; gestão com 4/5/14/15 respostas, sem resultado/parecer, não liberada e outra empresa; sem nomes; assinatura/foto/protocolo e revisão coerentes; avaliador negado ao Cliente/respondente inclusive por API/arquivo/token; agradecimento e PDF por e-mail sem metodologia/cálculos; falha/repetição de envio e retorno a rascunho após alteração. Não validar cientificamente o método nesta tarefa documental.

**Pendências técnicas:** `REF-19` (edição/histórico Forms), `REF-20` (efetivar públicos/token de DEC-13), `REF-21` (Mapa sem corpo SQL), `REF-16` (envio), `REF-22` (retenção/exportação). DISC já é produto oficial, sem nova decisão de inclusão. Forms/Mapa continuam rastreados separadamente; não eliminar módulos por omissão.
