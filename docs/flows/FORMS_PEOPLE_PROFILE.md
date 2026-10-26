# FLOW-17 — Mapa de People, formulários e perfil comportamental

Ficha de paridade de módulos adicionais encontrados no oficial. Cliente/Admin são o recorte; destinatário público é um ator distinto. Presença do código não autoriza expandir produto ou implementar avaliação nova. [Contrato comum](README.md); [matriz](../PERMISSIONS.md).

**Alvo confirmado em 26/10/2026 — DEC-07:** Cliente pode consultar relatório individual e agregado, ambos mediante liberação da CALI e dentro do escopo da própria empresa. A divergência do comentário antigo foi decidida nesse sentido. Condições de token, projeção, revogação e guards efetivos continuam trabalho técnico; não foram alteradas nesta etapa.

## Objetivo, fontes e composição

- **Mapa de People:** Admin acompanha jornadas, revisa registros e abre relatório. Fontes: [UI](SOURCES.md#mapa-ui), [bridge de schema](SOURCES.md#mapa), [grants posteriores](SOURCES.md#response-hours). Corpos das quatro RPCs `workspace_mapa_people_*`/`workspace_update_mapa_people_record` não foram localizados; comentário afirma guarda Admin, sem corpo para comprová-la.
- **Forms:** Admin cria/abre/encerra formulário, acompanha/edita respostas e exporta. Público responde por slug em `/f/:slug`. Fontes: [tabelas/RLS](SOURCES.md#forms), [validação/upload](SOURCES.md#forms-submit), [projeção pública](SOURCES.md#forms-public), [pipeline](SOURCES.md#forms-pipeline), [Admin UI](SOURCES.md#forms-ui).
- **Perfil comportamental:** Admin gerencia links/convites/resultados e relatório de gestão; respondente usa slug/token; Cliente acessa o que foi liberado à empresa. Fontes: [tabelas/RLS/submissão](SOURCES.md#profile), [convites](SOURCES.md#profile-invites), [gestão/entrega](SOURCES.md#profile-gestao), [campanha UI](SOURCES.md#profile-campaign), [avaliador individual](SOURCES.md#profile-evaluator).

Anatomia: listas Admin, editor de perguntas/configurações, respostas/triagem, relatório técnico e relatório agregado separados. Não misturar conteúdo público, respostas individuais e leitura de gestão no mesmo DTO.

## Transições e guardas observadas

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

Em perfil, há policy `profile_results_client_visible` para SELECT de resultado individual com `client_visible=true` e própria empresa, além da rota Cliente do avaliador. Entretanto comentário do próprio avaliador afirma que cliente deve receber gestão, não relatório técnico. Registrar a divergência; não assumir nem remover a capacidade existente sem decisão. Gestão via RPC exige liberação e retorna agregados, com limiar de cinco; é outra operação.

## Continuidade, falhas e aceite

Retorno Admin por link/campanha/resposta; resposta pública deve distinguir fechado, inválido, prazo encerrado e já enviado. Não presumir persistência/reabertura de respostas no navegador além do que a fonte implementa. Bloqueio de link e token de resultado são mecanismos diferentes.

Aceite proposto: Cliente não lista todas as respostas; slug fechado; campos obrigatórios condicionais, tipos e arquivo fora do path; edição Admin sem apagar evidência por engano; token errado/convite expirado/recusado; limites de resposta; gestão com quatro/cinco pessoas, sem parecer, não liberada e outra empresa; acesso individual e agregado somente quando liberados pela CALI e no escopo da empresa; falha de e-mail/PDF. Não validar cientificamente método de avaliação nesta tarefa documental.

**Dúvidas:** `REF-19` (edição/histórico e exposição de respostas), `REF-20` (individual x agregado/token), `REF-21` (Mapa sem corpo SQL), `REF-16` (envio), `REF-22` (retenção/exportação dos módulos novos). Escopo de migração de cada módulo continua uma decisão de paridade; a ficha não o elimina por omissão.
