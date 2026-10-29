# Matriz de permissões — Cliente e Admin

Data: 25/10/2026. Oficial consultado em `f3d3f14043a6abc38636f0340fe831e621d8b357`, somente leitura. **Matriz de evidência estática, não certificação de permissões em produção.** Fontes: [índice imutável](flows/SOURCES.md). Fluxos: [fichas](flows/README.md).

## Contrato alvo confirmado pelo usuário — atualizado em 28/10/2026

Esta seção prevalece para o desenho futuro da V2. As tabelas posteriores preservam o que foi observado no oficial; não representam implementação dessas decisões.

Revisão vigente: [regras de produto](PRODUCT_RULES.md), [referência funcional publicação 83](BASELINE_REFERENCE_2026-10-26.md) e DEC-13 a DEC-18. DEC-07 foi substituída; leitura individual encontrada no SQL histórico não autoriza o alvo atual.

| Operação/tema | Admin na V2 | Cliente na V2 | Decisão |
| --- | --- | --- | --- |
| Entrar e exercer poderes Admin | Sessão/perfil autorizados e segundo fator cadastrado/confirmado; ausência de fator ou falha não libera acesso | Não atribui MFA novo ao fluxo Cliente | DEC-21, 28/10; ainda sem prova operacional |
| Acessos Cliente da empresa | Gestão de até quatro acessos equivalentes; remover um não depende de principal | Sem hierarquia de cadastro principal | DEC-05 |
| Cadastrar/importar/arquivar pessoas e confirmar revisão mensal | Mantém operações administrativas autorizadas | Todos os acessos Cliente da própria empresa podem manter Equipe | DEC-05 |
| Informar/consultar remuneração, revisão salarial, gênero e filhos | Informa e consulta no escopo administrativo | Informa e consulta somente da própria empresa | DEC-09 |
| Lançar métricas mensais pela primeira vez | Decisão não atribui lançamento inicial ao Admin | Cliente lança | DEC-10 |
| Corrigir métricas já lançadas | Exclusivo do Admin, com rastreabilidade | Não corrige após lançamento | DEC-10 |
| Corrigir entregável aprovado/relatório disponibilizado | Pode reabrir o mesmo item, com motivo e histórico | Não recebe poder administrativo de reabertura | DEC-06 |
| Consultar item enquanto reaberto | Trabalha na correção com histórico preservado | Item indisponível até nova liberação | DEC-11 |
| Validar entregável após correção liberada | Libera para nova aprovação; não reutiliza aprovação antiga | Nova aprovação obrigatória do entregável corrigido | DEC-12 |
| Ciência de relatório após correção liberada | Decide se solicita nova ciência | Nova ciência exigida somente se solicitada pelo Admin | DEC-12 |
| Consultar relatório do avaliador DISC | Uso interno CALI; sem opção de liberação externa | Negado, inclusive após liberar gestão | DEC-13 |
| Consultar relatório de gestão DISC | Aprova/libera com critérios de respostas, resultado buscado e parecer | Somente gestão liberada da própria empresa | DEC-13/16 |
| Receber relatório do respondente DISC | Conduz geração/envio conforme operação | Papel Cliente não concede acesso ao relatório de outra pessoa; próprio respondente recebe PDF por e-mail, sem resultado na tela | DEC-13 |
| Receber pedido de dados do mês | Acompanha administrativamente os dados | Solicitação de preenchimento aparece somente para Cliente | DEC-16 |
| Receber resumo diário das 19h | Admin ativo com e-mail; ações elegíveis/horas por empresa | Não recebe; staff também não; versão Partner posterior, sem público/projeção definidos ainda | DEC-19 |
| Ativar acesso Cliente | Adesão registrada antes de emitir convite | Aceite de uso no primeiro acesso e a cada nova versão; sem entrada se verificação falhar | DEC-08 |

Decisões anteriores continuam vigentes, exceto DEC-07 substituída por DEC-13. Fonte: [registro](DECISIONS.md). Resumo diário Admin segue DEC-19/RESUMO-01: Cliente e staff não recebem; conteúdo Partner ainda será definido na fase dele. Esta matriz estática não autoriza alteração de produção; o recorte local de 29/10 abaixo registra somente a implementação autorizada/testada. Histórico de aprovação/ciência não é atribuído automaticamente ao conteúdo corrigido; pessoa focal não cria privilégio principal. Finalidades/guarda e informação de acesso estão em [Dados pessoais](DATA_PRIVACY.md).

## Legenda e limites

- **C:** operação condicionada encontrada em SQL/EDGE; condições da linha e contexto se aplicam.
- **N:** caminho citado recusa o ator ou policies localizadas reservam a operação a outro papel; não prova inexistência de caminho fora do repositório.
- **UI:** capacidade/guarda encontrada na interface, sem contrato completo de backend localizado.
- **D:** UI, documento ou outro caminho difere da restrição observada; requer decisão/reconciliação.
- **?:** não comprovado; não converter em permitido nem proibido.

Cada célula vale para a **operação e superfície indicadas**. Permitir SELECT não permite publicação; permitir RPC não garante que UPDATE direto tenha a mesma guarda. `authenticated` em grant não significa autorização funcional irrestrita. Nenhum teste A/B ou chamada de API foi executado.

## Identidade e escopo

1. **Guarda UI:** usuário, `profiles.active` e role exato; Cliente/Admin com papel diferente são redirecionados. [Fonte](flows/SOURCES.md#route-guard).
2. **Acesso Admin por `is_admin`:** definição posterior usa allowlist de e-mail do JWT e `session_meets_mfa`; não é simplesmente `profiles.role='admin'`, nem verifica profile.active nesse corpo. MFA aceita AAL2 **ou ausência de fator verificado**. [Predicado](flows/SOURCES.md#admin-predicate), [MFA](flows/SOURCES.md#mfa).
3. **Acesso Admin por perfil:** outras RPCs/EDGE usam role admin e active; não demonstram a mesma exigência de allowlist/MFA. A matriz não uniformiza esses caminhos.
4. **Vínculo de empresa:** `current_company_id` lê perfil ativo; `can_access_company` é is_admin ou mesma empresa. Esses helpers não testam explicitamente role client. [Fonte](flows/SOURCES.md#schema).
5. **Cliente principal:** manutenção de pessoas/revisão mensal exige `role=client`, active, is_primary e própria empresa; adicional não herda essa escrita. Até quatro convites ativos são previstos em migration posterior, não quatro acessos com permissões idênticas em todas as operações. [Limite](flows/SOURCES.md#access-limit), [Equipe](flows/SOURCES.md#team-save).

Não transportar divergências como nova política aprovada da V2. Ver [dúvidas REF](DECISIONS.md).

## Recorte local implementado — 29/10

Adesão: Admin de perfil persistido ativo + JWT AAL2 + fator TOTP verificado pode registrar/ler; Cliente A/B, Partner, perfil ausente/inativo, anônimo e service role não registram. Cliente não recebe evidências; INSERT direto/UPDATE/DELETE são negados. SQL com rollback e API/Auth local verificaram esse recorte; [contrato](contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910). Não é prova de permissão dos demais domínios, convites, termos ou do frontend. Leitura do próprio perfil não libera entrada no workspace.

## Códigos/termos e sessão local — 29/10

RPCs de issue/delivery/consume são exclusivas de serviço; papéis do navegador não consultam hashes privados. Conteúdo legal corrente pode ser consultado antes do login; aceite exige sessão/perfil elegíveis e, para Admin, MFA concluído, sem autoria/instante informados pelo cliente. Negócio exige aceite corrente e sessão vigente. Cliente consulta somente própria empresa active/paused com adesão; blocked/closed/archived cortam sessões/códigos. Logout/inativação também bloqueiam JWT antigo. [Contrato e limites](contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910). Isso não comprova os demais domínios nem sessão completa na SPA; tabelas seguintes continuam estáticas do oficial.

## Acesso, conta e proposta — FLOW-01/02/03

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Solicitar/verificar código | C | C | Perfil/convite elegível, expiração/tentativas/rate limit; [EDGE](flows/SOURCES.md#login) |
| Abrir rota Admin/Cliente | C no próprio papel | N em Admin; C em Cliente | Guarda UI de perfil/role/active; [rotas](flows/SOURCES.md#route-guard) |
| Registrar próprio aceite de uso | SQL C; UI não passa no mesmo gate Admin | C na UI/SQL | Próprio user/version; consulta de termo em erro libera UI; [termos](flows/SOURCES.md#terms), [policy](flows/SOURCES.md#terms-sql) |
| Ler empresas/convites/perfis pela tabela | C com policy Admin | C empresa e próprio perfil; N listagem de convites por policy inicial | [RLS inicial](flows/SOURCES.md#schema) |
| Criar conta via `create_client_account` | UI; ? corpo da RPC | ? corpo; UI não expõe | Registro de correção sem implementação; [cadastro](flows/SOURCES.md#accounts), [lacuna](flows/SOURCES.md#account-missing) |
| Alterar cadastro/status da empresa via tabela | C | N nas policies localizadas | Policy companies_admin_all; [schema](flows/SOURCES.md#schema), [bloqueio](flows/SOURCES.md#access-close) |
| Gerir contatos/convites/ativar perfis | C, com guards do contato principal | N nos caminhos de gestão | Até quatro invites ativos; alteração em etapas; [UI](flows/SOURCES.md#accounts), [contato](flows/SOURCES.md#contact) |
| Alterar livremente role/empresa do próprio perfil | C pela policy administrativa, fora do formulário pessoal | N pelo update pessoal | RPC pessoal só campos determinados; [perfil](flows/SOURCES.md#contact), [schema](flows/SOURCES.md#schema) |
| Gerir propostas no schema public | UI; ? RLS/EDGE completas | N na rota; ? contrato do destinatário público | [Portal](flows/SOURCES.md#portal); não há corpo de portal-send-proposal neste repo |
| Aceite comercial de proposta | ? ator/caminho | ? não presumir usuário Cliente | Enum aceita/recusada não prova transição autorizada; [contrato cliente](flows/SOURCES.md#portal) |

## Workspace, projetos e entregas — FLOW-04/05/06

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Consultar home | C/UI conforme fontes | C por vínculo/agregados | Não altera entidade; [home](flows/SOURCES.md#home-sql) |
| Ler projeto/entrega | C via policy Admin | C empresa, planning permitido e entrega visível/não cancelada | [policy/predicados](flows/SOURCES.md#schedule), [posterior](flows/SOURCES.md#lifecycle-view) |
| Criar/editar projeto ou entrega via tabela | C | N nas policies localizadas | RLS Admin; guardas de fluxo não são impostas por essa policy; [schema](flows/SOURCES.md#schema) |
| Compartilhar cronograma | C no caminho Admin | N escrita administrativa | Trigger valida mudança draft/client_review; [schedule](flows/SOURCES.md#schedule) |
| Aprovar cronograma | Não é papel da ação Cliente; só se satisfizer vínculo da RPC | C própria empresa, client_review e revisão pending | RPC não usa is_primary; [schedule](flows/SOURCES.md#schedule) |
| Pedir ajuste de cronograma | Mesma ressalva de vínculo | C, revisão pending e request_number <=2, motivo/alvo | [schedule](flows/SOURCES.md#schedule) |
| Pedir ajuste de cronograma pelo caminho v39 | UI; ? contrato distinto | UI; ? corpo v39 | Não herdar guardas v38 automaticamente; [consumidor](flows/SOURCES.md#schedule-v39) |
| Decidir ajuste/mudar frente draft | C por is_admin | N pela RPC Admin | Justificativa/estado e alvo; [schedule](flows/SOURCES.md#schedule) |
| Pausar/suspender/cancelar/retomar execução | C por is_admin | N pela RPC | Alvo/justificativa e recálculo; [lifecycle](flows/SOURCES.md#lifecycle) |
| Mudar status de entregável por RPC Admin | C | N | Destinos enumerados; saída de approved negada nesse caminho; [status](flows/SOURCES.md#deliverable) |
| Aprovar entrega com avaliação | Não é aprovação interna Admin | C, visível/mesma empresa/client_review; nota 1–5 | Fecha timers/trabalho e registra avaliação; [aprovação](flows/SOURCES.md#approval) |
| Pedir ajuste de entregável | C can_access_company | C can_access_company e motivo | D: RPC não reproduz guardas de status/visibilidade da UI; [ajuste](flows/SOURCES.md#adjust) |
| Aprovar subtarefa | Não é a operação Cliente | C própria empresa e visibilidade herdada, client_review | Não aprova entrega inteira; [subtarefa](flows/SOURCES.md#tasks) |
| Pedir ajuste de subtarefa | Não é a operação Cliente | C, até dois ajustes; texto >=10 | Volta doing; [limite](flows/SOURCES.md#task-adjust) |
| Mensagem em subtarefa | C pelas operações administrativas pertinentes | C, visível e não approved/done/cancelled | Nota interna não é mensagem Cliente; [tasks](flows/SOURCES.md#tasks) |
| Alterar entrega aprovada por caminho direto | D: policy UPDATE ampla | D: ajuste RPC não verifica trava equivalente | Não certificar imutabilidade global; [schema](flows/SOURCES.md#schema), [ajuste](flows/SOURCES.md#adjust) |

## Horas e Equipe — FLOW-07/08

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Iniciar/manual por RPC de horas Admin | C is_admin e contexto operacional | N nesse caminho | Conta/projeto/vínculos e validações; [guarda](flows/SOURCES.md#hour-scope), [operações](flows/SOURCES.md#hour-ops) |
| Pausar/finalizar timer Admin | C próprio timer ativo | N nesse caminho | Efeito sobre sessão/trabalho; [operações](flows/SOURCES.md#hour-ops) |
| Retomar timer pela chamada UI legada | UI; ? corpo | UI não expõe; ? corpo | resume_work_timer não versionada; [Admin UI](flows/SOURCES.md#hours-ui) |
| Editar/excluir lançamento com auditoria | C is_admin + motivo | N nas RPCs | [auditoria de horas](flows/SOURCES.md#hour-audit) |
| Configurar visibilidade de horas | C | N policy de escrita Admin | Política por período; [visibilidade](flows/SOURCES.md#hour-visibility) |
| Ler resumo/breakdown Cliente | Não é resumo de carteira Admin | C vínculo e mês visível | Totais incluem internos; breakdown redige em Outras; [SQL](flows/SOURCES.md#hour-read) |
| Ler detalhes de hour_entries via tabela | C | C client_visible e visibilidade mensal/projeto nas policies | Não equivale ao total do resumo; [schema](flows/SOURCES.md#schema), [horas](flows/SOURCES.md#hour-visibility) |
| Ver/revisar capacidade e registrar pausa | C/UI conforme função/tabela | Só status próprio por RPC; N gestão Admin | [capacidade](flows/SOURCES.md#hour-capacity) |
| Ler diretório/movimentos/snapshots/vagas | C | C própria empresa | can_access_company; [policies](flows/SOURCES.md#team-private), [revisão](flows/SOURCES.md#team-review) |
| Ler salário/gênero/filhos em team_member_private | C is_admin | N policy de leitura privada | Mesmo principal não recebe SELECT; [privados](flows/SOURCES.md#team-private) |
| Salvar pessoa/importar/revisar mês | C role Admin ativo | C só principal ativo da empresa; adicional N | Empresa active, mês atual/anterior, limites e validações; [salvar](flows/SOURCES.md#team-save), [revisão](flows/SOURCES.md#team-review) |
| Enviar campos privados pelo save_team_month | C | C principal, com optional_data_declared | Escrita não implica leitura posterior; [RPC](flows/SOURCES.md#team-save) |
| Arquivar ficha | C role Admin ativo | C principal da empresa | Histórico preservado; [arquivo](flows/SOURCES.md#team-archive) |
| Lançar/editar métricas do mês | D: UI só consulta, SQL C | C por vínculo; policy não exige is_primary | [métricas SQL](flows/SOURCES.md#team-metrics), [UI](flows/SOURCES.md#team-ui) |
| Abrir People Analytics | UI C | UI Full ou frente ativa; dados têm policies próprias | Gate comercial visual não prova isolamento adicional; [UI](flows/SOURCES.md#team-ui) |

## Agenda e ocorrências — FLOW-09/10

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Ler evento | C | C empresa e visibility client | [RLS](flows/SOURCES.md#schema) |
| Criar/editar/cancelar evento direto | C policy Admin | N escrita direta localizada | Solicitação Cliente é outra operação; [schema](flows/SOURCES.md#schema) |
| Solicitação normal/proposta/aceite v1/v2 | UI; ? contratos completos | UI; ? contratos completos | Várias RPCs não versionadas; [runtime](flows/SOURCES.md#agenda-runtime), [v2](flows/SOURCES.md#agenda-policy) |
| Pedir mudança de reunião | Não é ação de cliente | C client ativo/empresa/evento futuro; motivo/opções | [mudança](flows/SOURCES.md#agenda-change) |
| Decidir mudança de reunião | C is_admin, nota/pending/evento ativo | N pela RPC Admin | Atualiza evento apenas se aprovada; [mudança](flows/SOURCES.md#agenda-change) |
| Pedir/aceitar/contrapropor extra | C ações Admin específicas | C pelas RPCs específicas, vínculo/slot/ciência | Valores e regras distintos por online/presencial; [visita](flows/SOURCES.md#extra-visit), [online](flows/SOURCES.md#extra-online) |
| Sobrescrever quote fixo já aceito | N nessa RPC | Não é ação Cliente | [proteção](flows/SOURCES.md#price-lock) |
| Abrir solicitação/ocorrência Cliente | Não é mesmo caminho de abertura Cliente | C client ativo/empresa/texto | [abertura](flows/SOURCES.md#records-open) |
| Ler conversa Cliente | C Admin | C empresa/visibility e mensagens públicas | [ocorrências](flows/SOURCES.md#records-post) |
| Responder público | C perfil Admin ativo; não concluída/cancelada | C vínculo/visibility; não standby/completed/cancelled | Muda status de acompanhamento; [post](flows/SOURCES.md#records-post) |
| Criar nota interna | C role Admin | N pelo p_internal | [post](flows/SOURCES.md#records-post) |
| Mudar status/concluir/cancelar | C is_admin | N nessa RPC | [status](flows/SOURCES.md#records-post) |
| Excluir solicitação não aberta | Não é caminho excepcional Cliente | C próprio autor, open e sem abertura/resposta Admin | [exceção](flows/SOURCES.md#records-delete) |
| Editar/excluir mensagem | C somente mensagem de author_role admin | N pelas RPCs | Não exige explicitamente mesmo usuário Admin autor; [controles](flows/SOURCES.md#records-message) |
| Avaliar ocorrência concluída | N pela RPC client-only | C, completed/empresa/nota/comentário | [feedback](flows/SOURCES.md#records-reopen) |
| Solicitar reabertura | N pela RPC client-only; Admin tem status direto | C standby/completed/cancelled; completed exige própria avaliação | [reabertura](flows/SOURCES.md#records-reopen) |
| Aprovar/recusar reabertura | C is_admin; pending; rejeição com motivo | N pela RPC | [decisão](flows/SOURCES.md#records-reopen) |

## Documentos, relatórios e avisos — FLOW-11/12/13

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Criar/versionar/publicar/arquivar file | C policy Admin | N em escrita de metadata localizada | UI tem guardas próprias; [UI](flows/SOURCES.md#documents-admin), [schema](flows/SOURCES.md#schema) |
| Ler metadata file | C | C empresa/client_visible e predicado de entrega | Policy não exige status published como a UI; [policy](flows/SOURCES.md#files-policy) |
| Ler objeto de storage | ? conjunto Admin completo não versionado aqui | C em caminhos permitidos; vínculo não equivale a published | [storage](flows/SOURCES.md#file-storage); URLs temporárias não corrigem policy de conteúdo |
| Upload anexo de conversa Cliente | C conforme caminhos Admin | C policy de path/contexto | [chat storage](flows/SOURCES.md#chat-storage); não concede gestão de file |
| Registrar visualização/ciência de documento | UI; ? contrato completo | UI; ? policies próprias completas | Tabela existe em referências/triggers, criação/policies completas não localizadas; [Cliente UI](flows/SOURCES.md#documents-client) |
| Comentar file | C Admin | D: UI insere target=file; policy localizada só deliverable/task/project | [UI](flows/SOURCES.md#documents-client), [policy](flows/SOURCES.md#file-comments) |
| Conectar/salvar cópia Drive | EDGE/UI condicionadas | EDGE/UI condicionadas | Conferir ator/ação/callback/arquivo; não certificar sync; [EDGE](flows/SOURCES.md#drive) |
| Criar/revisar/aprovar relatório | C pela policy Admin; travas extras UI | N edição pela policy Cliente | [UI](flows/SOURCES.md#reports-admin), [schema](flows/SOURCES.md#schema) |
| Enviar relatório | C EDGE role Admin ativo/approved/base elegível | N EDGE | Não aplica mesmo predicado is_admin/MFA; [envio](flows/SOURCES.md#report-send) |
| Ler relatório/PDF | C | C empresa, sent/published | [policy posterior](flows/SOURCES.md#report-policy), [eventos](flows/SOURCES.md#report-events) |
| Registrar ciência de relatório | N nessa RPC client-only | C role client ativo/empresa/sent ou published | Idempotente no objeto; [ciência](flows/SOURCES.md#report-ack) |
| Enviar dúvida de relatório | N nessa RPC client-only | C aberto, período de três dias úteis/texto | [dúvida](flows/SOURCES.md#report-question) |
| Retirar relatório já enviado | C role Admin ativo, sem leitura/evento/ciência | N nessa RPC | Archiva e registra retirada; [retirada](flows/SOURCES.md#report-withdraw) |
| Reabrir relatório retirado pelo caminho v63 | UI; ? corpo RPC | UI não expõe; ? contrato RPC | Não substituir por UPDATE livre; [consumidor](flows/SOURCES.md#report-reopen) |
| Editar aprovado/excluir fora do draft | D: UI bloqueia, policy ampla | N escrita de relatório | Não afirmar trava SQL global de versão; [UI](flows/SOURCES.md#reports-admin), [schema](flows/SOURCES.md#schema) |
| Publicar/editar/arquivar/restaurar aviso | C policy Admin | N escrita notices/targets localizada | Partner é superfície distinta fora desta matriz; [avisos](flows/SOURCES.md#notice) |
| Ler aviso | C | C published + audience all ou empresa alvo | [can_read_notice](flows/SOURCES.md#notice) |
| Confirmar/desfazer ciência de aviso | D: UI não permite; SQL próprio registro não veda role Admin | C próprio user/company e aviso legível; delete próprio | [SQL](flows/SOURCES.md#notice), [UI](flows/SOURCES.md#notice-ui) |
| Comentar aviso | C com empresa de resposta válida na UI | C próprio autor/empresa e aviso legível | [policies](flows/SOURCES.md#notice) |
| Excluir comentário de aviso | C policy Admin | N policy localizada | [avisos](flows/SOURCES.md#notice) |
| Reagir/trocar/remover reação | C próprio registro | C próprio registro; INSERT exige legível | UPDATE/DELETE não repetem todas as guardas do INSERT; [reações](flows/SOURCES.md#notice-reaction) |

## Perfil, equipe CALI, módulos adicionais e fim de contrato — FLOW-14/15/16/17/18

| Operação/superfície | Admin | Cliente | Condições e fonte |
| --- | --- | --- | --- |
| Editar perfil próprio | C via RPC pessoal | C via RPC pessoal | Campos limitados; sincronização principal; [perfil](flows/SOURCES.md#contact) |
| Ler notificação/marcar lida | C policy Admin; UI chama RPC | C SELECT próprio; ? corpo das RPCs de marcação | [schema](flows/SOURCES.md#schema), [chrome](flows/SOURCES.md#chrome) |
| Gerir staff/atribuições/convidar | C policy Admin e EDGE is_admin | N nas policies/rotas localizadas | [staff](flows/SOURCES.md#staff), [EDGE](flows/SOURCES.md#staff-invite) |
| Decidir hora/material submetido | C conforme fila/operação | N na gestão | Pending e motivo na recusa; [fila](flows/SOURCES.md#staff-review), [UI](flows/SOURCES.md#staff-ui) |
| Ler painel auditoria | UI Admin e SELECTs condicionados | N rota; acesso a alguns eventos próprios não é painel Admin | [auditoria](flows/SOURCES.md#audit) |
| Alterar activity_log diretamente | D: UI só leitura, policy Admin ALL | N na policy inicial | Não certificar histórico imutável; [schema](flows/SOURCES.md#schema) |
| Tratar satisfação | C policy Admin | N nessa tabela | Não muda avaliação original; [follow-up](flows/SOURCES.md#satisfaction) |
| Gerir Forms e todas as respostas | C policies Admin, inclusive UPDATE posterior | N na gestão/leitura geral | [Forms](flows/SOURCES.md#forms), [atualização](flows/SOURCES.md#forms-followup) |
| Responder formulário aberto | C como destinatário público, não privilégio Admin | C como destinatário público, não privilégio Cliente | Slug/validação; anon também previsto; [submit](flows/SOURCES.md#forms-submit) |
| Gerir campanha/resultados individuais de perfil | C policy Admin | N na gestão | [RLS perfil](flows/SOURCES.md#profile) |
| Ler resultado individual cliente | C Admin | C SQL se client_visible e empresa; D comentário de produto contraditório | [policy](flows/SOURCES.md#profile), [avaliador](flows/SOURCES.md#profile-evaluator) |
| Aprovar/liberar/enviar gestão | C is_admin, mínimo/parecer e aprovação conforme ação | N RPC de escrita; C leitura agregado liberado da empresa | [gestão](flows/SOURCES.md#profile-gestao) |
| Consultar relatório público de perfil por token | C como portador de token | C como portador; não por papel | Superfície pública separada; [RPC pública](flows/SOURCES.md#profile-gestao) |
| Operar Mapa de People | UI Admin; ? corpos das RPCs | N rota Admin; ? corpo SQL | Grant authenticated não prova role; [UI](flows/SOURCES.md#mapa-ui), [grants](flows/SOURCES.md#response-hours) |
| Ler catálogo/frentes da empresa | C | C catálogo e próprias frentes | [frentes](flows/SOURCES.md#fronts) |
| Ativar/encerrar frente contratada | C policy/trigger Admin | N nas policies de escrita | Plano/modo/limites; [frentes](flows/SOURCES.md#fronts) |
| Exportar dados completos da empresa | C is_admin, destinatário e empresa | N pela RPC administrativa | Dados restritos separados; [export](flows/SOURCES.md#export) |
| Exportar meus dados/pedir direito | UI; ? corpo RPC | UI; ? corpo RPC | Não equivale a exportação da empresa; [direitos](flows/SOURCES.md#privacy), [perfil](flows/SOURCES.md#profile-ui) |
| Responder direito solicitado | UI Admin; ? corpo RPC | N UI de resposta; C leitura do próprio pedido na policy | [policies](flows/SOURCES.md#privacy), [painel](flows/SOURCES.md#privacy-ui) |
| Eliminar dados da empresa | C is_admin, closed há 45 dias, nome e não eliminada | N pela RPC Admin | Storage antes de banco; cobertura/atomicidade pendentes; [eliminação](flows/SOURCES.md#elimination) |

## O que falta provar antes de implementar acesso real

Obter definições ausentes e schema/policies efetivos, reconciliar guards diferentes, transições amplas e efeitos compostos. Depois, em ambiente isolado, executar por ator: sem sessão, Admin com/sem condição de MFA, Cliente principal A, adicional A, Cliente B, inativo e sessão existente de conta encerrada. Provar leitura, escrita, RPC, storage e URL direta conforme cada superfície. Essa etapa é futura e exige ambiente identificado; não foi simulada como concluída.
