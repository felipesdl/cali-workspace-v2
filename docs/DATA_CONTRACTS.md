# Dados, contratos e integração Supabase

Estado: **plano de integração**, sem conexão ou migrations nesta V2. Fonte atual: código e migrations do oficial na revisão do [baseline](BASELINE_2026-10-25.md); não houve inspeção do banco ativo.

Referência funcional vigente: [publicação 83 de referência em 26/10](BASELINE_REFERENCE_2026-10-26.md), identificada pelo mesmo SHA das fontes. [Regras de produto](PRODUCT_RULES.md) definem resultado/público; [Dados pessoais](DATA_PRIVACY.md) registra finalidades, projeções, guarda e informação ao usuário.

Vocabulário: [Contexto de produto](PRODUCT_CONTEXT.md). Operações se vinculam aos IDs do [Catálogo de fluxos](FLOW_CATALOG.md), às [fichas reconciliadas](flows/README.md) e à [matriz Cliente/Admin](PERMISSIONS.md). Essa matriz é evidência estática; permissões efetivas e contratos ausentes continuam pendentes de prova. Decisões/conflitos estão no [registro](DECISIONS.md).

## Recorte de acesso/empresa — 28/10/2026

[Contrato mínimo reconciliado](contracts/ACCESS_COMPANIES.md): request/verify por código, troca de token, perfil, empresa, convite, termos, diferenças aprovadas e definições ausentes por operação. Há schemas de fronteira e records mínimos planejados, sem transporte Supabase conectado. DEC-21 exige MFA Admin antes de liberar acesso; DEC-22 define [ambiente local dedicado](LOCAL_ENVIRONMENT.md), ainda sem stack/baseline ativos. DEC-23 autoriza registro próprio de adesão após investigação: contrato mínimo criado, gravação/persistência pendentes, separado de aceite de termos. O DTO demo de empresas não substitui projeção real; archived foi incorporado ao catálogo de estados conhecido.

## Contrato alvo posterior ao levantamento

Em 26/10/2026, DEC-05 a DEC-12 fecharam acessos equivalentes sem principal, manutenção/leitura privada de Equipe, separação lançamento/correção de métricas, adesão/aceite e reabertura/liberação/validação de conteúdo. A seção de alvo confirmado da matriz e as fichas registram essas regras. Na futura integração, identificar diferenças do oficial e planejar compatibilidade/migração; não executar alterações nesta etapa.

Especialmente: não perpetuar guarda `is_primary` de manutenção; leitura privada Cliente é autorizada pelo novo alvo somente na própria empresa; correção de métrica já lançada é Admin-only; conteúdo reaberto deve ficar inacessível até liberação. Reabertura preserva identidade do item e histórico, distinguindo revisão corrigida de aprovação/ciência antigas. Nenhuma escolha de schema/enum ou alteração de payload foi implementada por esta decisão.

Revisão posterior DEC-13 a DEC-18: DEC-07 foi substituída. DISC tem projeções separadas: avaliador interno CALI, respondente somente PDF próprio por e-mail sem resultado/metodologia/cálculos na tela, Cliente somente gestão aprovada/liberada da empresa. Reconciliar leitura direta, arquivos e tokens públicos legados; flag `client_visible` não pode liberar avaliador contra essa regra. Aprovar/congelar conteúdo, gerar PDF, liberar e enviar têm contratos/eventos distintos.

Chat não gera e-mail; pedidos mensais são tarefas Cliente. DEC-19 fecha o resumo Admin em RESUMO-01: Admins ativos recebem às 19h de Brasília, Cliente/staff não recebem; conteúdo Partner é decisão posterior da fase dele. Rastrear canais/idempotência por operação; entrega completa não exige e-mail onde não previsto, e resumo de chat das 08h não retorna.

## Fronteira de dados — base local de 27/10

Cada domínio declara um contrato independente da UI em `src/api/modules/<dominio>`. No primeiro consumidor, `companies`, schemas Zod validam entradas/respostas; service recebe um cliente Axios; composição seleciona o adapter de `src/mocks/adapters/companies.ts`; hooks usam Query e factories de keys `as const` incluindo ator/empresa/filtros. Views não importam Axios, SDK ou fixtures. Form cuida do rascunho/validação; respostas permanecem no cache Query.

`GET /companies`, detalhe e acessos são caminhos virtuais atendidos em memória, sem servidor e sem promessa de contrato HTTP oficial. DTOs de demonstração não substituem tabelas/RPCs do oficial. `mock-admin` é namespace de cache sintético, sem autenticação ou autorização. Na integração, adaptar o transporte por operação reconciliada, evitando obrigar chamadas Supabase a um contrato REST inventado.

Fixtures usadas pela aplicação pertencem a `src/mocks/fixtures`; cenários exclusivos de teste pertencem a `tests/fixtures`, com adapters controlados em `tests/mocks`. Testes podem usar os mocks da aplicação para provar a composição local; a aplicação não importa testes. A seleção do mock fica em `api.ts`, não no hook/view/service. Ver [fronteiras](ARCHITECTURE.md#mocks-da-aplicação-e-suporte-exclusivo-de-testes).

Ainda não há SDK, cliente Supabase, escrita ou mutation. Criar hooks de mutation junto do consumidor real, com confirmação, erro, idempotência aplicável e invalidação dirigida. Definir limpeza/cancelamento na troca de identidade e provar acesso no servidor; keys isoladas não substituem RLS.

Evitar um repositório genérico `getAll(table)` que permita qualquer tabela/campo. Preferir operações do domínio, como consultar extrato do ciclo, confirmar revisão mensal ou solicitar ajuste. DTO de leitura não inclui dados internos que o consumidor não pode receber.

Separar tipos gerados do schema, contratos de operação e modelos de apresentação. Campos não verificados não devem ser inventados em um grande `Database` manual. Gerar tipos somente do ambiente autorizado, depois de conferir migrations, e validar respostas dinâmicas nas fronteiras pertinentes.

## Contrato mínimo por operação

```text
Domínio / caso de uso / responsável:
Origem oficial: revisão + arquivo + tabela/RPC/Edge Function
Consumidores: Cliente / Admin / Partner interno
Entrada: tipos, campos permitidos, empresa, período, paginação, ordenação
Saída: projeção, nulabilidade, unidade, origem e validade
Autorização: sessão, vínculo, papel, RLS/grants/policies/RPC/storage
Transição: estado anterior, estado seguinte e guardas
Efeitos: gravações, auditoria, arquivo, e-mail, calendário e notificação
Consistência: transação/idempotência/concorrência/compensação
Cache: chaves e todos os leitores afetados
Falhas: erro de negócio, acesso negado, sessão expirada, timeout
Evidência: fixture + teste de contrato + teste de isolamento
Estado: documentado / observado no código / verificado em ambiente
```

Não copiar texto de tela como contrato. Precisão de horas, timezone, mês efetivo e status precisam de semântica explícita.

## Inventário inicial de domínios

Nomes abaixo são orientação, não catálogo validado do banco atual. [SOURCES](flows/SOURCES.md) enumera fontes e 29 chamadas sem corpo localizado. Reconciliar acesso/empresa mínimos na fundação e demais contratos na entrega correspondente; não esperar fechar todas as RPCs para viabilizar o primeiro fluxo independente.

| Domínio | Fontes a reconciliar | Invariantes que a padronização deve preservar |
| --- | --- | --- |
| Sessão e acesso | `WorkspaceAuthProvider`, `ProtectedRoute`, `workspace-access`, `profiles`, MFA/TermsGate | Login por fluxo oficial, perfil ativo, vínculo de empresa, callback, expiração, MFA/termos conforme contrato |
| Contas/contratos/propostas | Páginas Admin, `portalAdminApi`, RPCs e tabelas correspondentes | Adesão não é consequência automática do contrato; preservar proposta/valor aceito e histórico |
| Projetos/entregáveis | `domain/projects`, páginas e runtimes de aprovação; projects/workstreams/deliverables/review requests | Revisão interna, ajuste contextual, aprovação, imutabilidade e pesquisa conforme regra vigente |
| Horas | `hour_entries`, `work_timers`, ciclos, visibilidade, RPCs `get_client_hours_summary`/`breakdown` | Cliente consulta; sem duplicar timer/manual ou expor justificativa interna; total vem da autoridade do backend |
| Equipe | `CompanyTeamPage`, wizard/analytics; team_members/private/changes/months/snapshots/reviews/vacancies | Colaborador não é login; separar privados; preservar data efetiva e fechamento confirmado |
| Agenda | Domínio calendar, páginas, runtime e Edge Functions Google | Criação/remarcação/cancelamento e convites com estado real, sem duplicações |
| Ocorrências/conversas | `WorkspaceRecordsPage` e runtimes | Protocolo, autoria, visibilidade interna/cliente, anexos, encerramento/reabertura e SLA vigente |
| Documentos | Páginas, arquivos/ciência e Drive | Storage privado, versão, vínculo de empresa, ciência e status de sincronização |
| Relatórios/NPS | Admin V17, Cliente V5, composição/governança, publicação e eventos | Mesmo significado entre tela/PDF/versão, rascunho restrito, período e fonte, publicação rastreável |
| Avisos/notificações | `NoticesBoard` oficial, módulos de notificação, funções de envio | Origem e público corretos; ciência/comentário/calendário não podem ser listas desconectadas |
| Partner e módulos adicionais | `StaffWorkspace`, equipe CALI, auditoria, Mapa de People, forms e profile | Não confundir `partner` interno com plano CALI Partner; inventariar permissões e relações antes de portar |

## Autorização e autoridade

- Filtro `company_id` na UI organiza consulta; não autoriza acesso. Banco deve verificar sessão/vínculo/papel com políticas e grants adequados.
- [Documentação oficial Supabase](https://supabase.com/docs/guides/database/secure-data): acesso do frontend pode usar Data API com publishable key e RLS configurada com privilégio mínimo. Chaves `secret`/`service_role` pertencem ao servidor e podem contornar RLS.
- Reconciliar o fluxo `workspace-access` e o contexto Supabase do oficial antes de implementar autenticação.
- Agregações oficiais, campos derivados e escrita composta pertencem a RPC/função/transação controlada. Não reconstruir horas/turnover no frontend como nova autoridade.
- Operações com múltiplas gravações exigem atomicidade e concorrência definidas no Postgres.
- Storage, RPC e Edge Function entram na mesma matriz de acesso das tabelas. RLS habilitada não comprova política correta.
- Funções privilegiadas exigem revisão de autorização, grants e `search_path`; resultado não pode ampliar acesso porque o chamador informou uma empresa.

## Isolamento de ambiente

O cliente oficial possui fallback de configuração para o projeto oficial. Não portá-lo literalmente. Na V2, configuração futura ausente deve resultar em demo explícita ou erro de configuração, sem contato implícito com produção.

`VITE_DATA_MODE`/`VITE_DEMO_MODE` já são validados pelo bootstrap e continuam permitindo apenas demonstração. A configuração local do laboratório não habilita SDK/cliente no frontend. A futura seleção de adaptador deve ser única e validar destino antes de criar cliente; ergonomia de ambiente não substitui autorização no servidor.

Ambiente escolhido em DEC-22: Supabase local dedicado. Configuração e preflight estão em [Ambiente isolado](LOCAL_ENVIRONMENT.md); ativação requer baseline revisada, atores sintéticos e prova de bloqueio de outbound. Mesmo projeto com empresas sandbox só pode ser considerado após isolamento e efeitos colaterais demonstrados; preview Vercel não isola banco.

E-mail, convites, Calendar/Meet, Drive e notificações externas precisam de inventário de gatilhos. `enqueued`, preview ou toast de sucesso não comprovam entrega externa.

## Conflitos que precisam de decisão/validação

| Tema | Divergência observada | Ação |
| --- | --- | --- |
| Partner | Handoff/PRODUCT_RULES indicam papel futuro; Auth e migrations já contêm papel | Inventariar contrato atual e isolamento das empresas atribuídas |
| Termos | Gate oficial usa versão 2026-10-15/canal preenchido e libera UI em erro; alvo DEC-08 exige bloqueio | Decisão funcional resolvida; planejar comprovação da adesão/aceite versionado e corrigir divergência somente na execução autorizada |
| Prazo cliente | Patch de 19/10 altera revisão para 24h × parâmetro; caminho v39 sem corpo localizado | Conferir aplicação e contrato por operação; não mudar prazo de dúvida do relatório por analogia |
| Alertas de horas | Além de fontes antigas 50/80 e 70/85/100, SQL de capacidade usa 75/100 e marcos de excedente | Reconciliar mecanismos e configuração ativa; ver REF-09 |
| Indicadores | Fixtures não definem fórmula oficial de turnover/headcount | Preservar comportamento existente e validar snapshots/regra; não redesenhar fórmula nesta etapa |
| DISC | Fonte permite leitura individual/token; DEC-13 restringe públicos e entrega | Efetivar projeções/rotas/storage/tokens por relatório, sem reabrir a decisão de produto |
| Resumo diário | Produto Admin definido; filtros/volume/corte e retry precisam de prova; versão Partner adiada | Seguir DEC-19/RESUMO-01 e os limites abaixo; não certificar cobertura integral ou ausência de chat apenas por existir cron |
| Dados pessoais | Finalidades/guarda por campo ainda precisam de conteúdo validado | Registrar consumidores e políticas no documento dono e refletir a informação no acesso/coleta; não inventar prazo nem novos campos |

Não resolver esses pontos com mudanças silenciosas no backend ou no payload frontend.

## Contrato do resumo Admin e limites da fonte

Produto: [RESUMO-01](PRODUCT_RULES.md#resumo-01--contrato-admin-definido-partner-posterior). Fontes: [função](flows/SOURCES.md#admin-summary), [agendamento e desativação do chat](flows/SOURCES.md#admin-summary-schedule), [origem de teste](flows/SOURCES.md#admin-summary-test). Consulta estática, sem executar função/SQL ou acessar o banco.

- Seleciona notificações do dia em Brasília, ordenadas por `created_at`; horas por `work_date` do dia. São critérios distintos: não substituir data de atuação por data de criação do lançamento sem contrato.
- Classifica avisos pelo papel do destinatário: Admin em “O cliente fez”, Cliente em “A CALI fez”; exclui `staff_` e deduplica por bloco/empresa/título/texto/entidade. Isso não é contagem automática de todo clique do usuário.
- Ordena empresas pela quantidade de avisos dos dois blocos; horas sem aviso também podem gerar seção. Mostra 12 itens por bloco, 180 caracteres e “e mais N”; totais são calculados antes do corte visual.
- Busca Admins ativos com e-mail; função usa chave de idempotência por Admin/dia e separa origem de teste. Aceitação pelo provedor não comprova entrega ao destinatário. Não usar canal de produção para testar.
- Migration agenda diariamente às 22h UTC, equivalentes a 19h de Brasília na referência, e desagenda o resumo de chat das 08h. Não comprova cron efetivo de produção.
- Janela SQL vai até o fim do dia, mas a mensagem contém somente dados existentes na geração. Eventos posteriores ao envio não entram naquela mensagem; não foi localizado mecanismo de recuperação do restante do dia nesse fluxo. Não mudar horário/recorte por conta própria.
- A fonte limita a consulta a 2.000 notificações antes do agrupamento. Esse teto técnico não é regra de produto; testar alto volume e cobertura dos totais antes de garantir “todas as atividades”. Não confundir com os 12 itens visíveis por bloco.
- O loop localizado exclui `staff_`, mas não contém exclusão explícita de todo tipo de chat. Verificar os tipos/produtores e provar ausência de chat no resumo; não inferir que desligar o digest das 08h elimina qualquer outro caminho de e-mail.

Esses itens são reconciliação/teste de engenharia dentro de TEC-01/02/03 e REF-16, não novas perguntas de produto sobre o que entra no resumo. Implementar Partner somente após definição de empresas/horas/projeção autorizada na etapa correspondente.

## Matriz mínima de comprovação futura

Testar usuário sem sessão, inativo, cliente A, cliente B, Admin e Partner atribuído/não atribuído, conforme contrato. Para cada operação, provar permissão e negação em SELECT/INSERT/UPDATE/DELETE, RPC, arquivos e funções aplicáveis. Repetir após expiração, logout e troca de empresa; verificar cache/detalhes antigos e efeitos outbound.

Teste deve usar atores reais de teste no ambiente isolado. Mock de frontend não comprova RLS. Migration versionada não comprova migration aplicada.
