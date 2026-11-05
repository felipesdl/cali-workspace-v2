# Fase 2B — Equipe

Plano autorizado em 04/11/2026. Domínio [FLOW-08](../flows/WORKSPACE_HOURS_TEAM.md). Base de paridade: [publicação 83](../BASELINE_REFERENCE_2026-10-26.md). Escopo de homologação inicial: Admin e empresas sintéticas A/B no CALI MAPA. A V1 publicada serve como referência em leitura.

## Aceite e sequência

| Lote | Entrega | Evidência exigida |
| --- | --- | --- |
| 1. Diretório | Rotas conectadas Cliente/Admin, empresa explícita para Admin, filtro, paginação, ficha profissional, ativos/afastados/desligados/arquivados e estrutura por gestão direta | A lê A; B lê B; Admin com MFA escolhe A/B; troca de empresa, acesso revogado, URL, recarga e mobile |
| 2. Manutenção | Cadastro, edição, movimentações e arquivamento com data de referência e histórico; preimagem para impedir gravação concorrente; ficha separada de acesso Auth | Dois Clientes equivalentes da mesma empresa, inclusive acesso sem marca legada de principal; código duplicado, gestor de outra empresa, datas inválidas, retry e arquivamento sem desligamento |
| 3. Dados privados | Consulta e edição explícitas de remuneração, revisão salarial, gênero e informação de filhos, com declaração de origem; trilha só dos campos alterados | Cliente lê e grava somente na sua empresa; Admin com MFA; diretório, histórico, CSV geral, logs e notificações sem projeção dos valores privados |
| 4. Importação CSV | Leitura local, prévia de novos/alterados/reativados/ausentes, erros por linha e confirmação; gravação atômica com comparação da prévia | Codificação, aspas/delimitadores, cabeçalho, 2.000 linhas, duplicidade, gestores na base ou no lote, concorrência, coluna omitida e ausentes preservados |
| 5. Histórico e fechamento | Histórico de movimentações e consulta dos snapshots existentes por mês; conferir vigência e ligação com a 2C. Homologar fluxos no navegador integrado e registrar PR/checklist | A/B, segundo Cliente da mesma empresa quando disponível, Admin, corte e isolamento; cenário vazio, falha, teclado, mobile, recarga e Back/Forward |

As operações de Equipe não emitem convite, criam perfil Auth ou concedem login. DEC-05 torna os acessos Cliente equivalentes. DEC-09 autoriza os campos privados no recorte da própria empresa. DEC-10 e a confirmação/revisão mensal ficam na 2C. A 2B registra movimentos e preserva os snapshots mensais existentes. Fórmulas de indicadores, comunicação e gestão da equipe interna CALI seguem seus próprios fluxos.

## Fronteiras de implementação

- A V2 usa o domínio `team_members`, `team_changes` e `team_member_private` existente, com RPCs próprias no piloto. As RPCs legadas misturam manutenção da ficha com confirmação do mês e ainda usam `is_primary`. O contrato V2 usa empresa, matrícula, sessão vigente e aceite corrente para Cliente e a guarda Admin com MFA.
- Diretório e histórico retornam projeções explícitas. Dados privados têm consulta e escrita separadas. Não abrir SELECT geral da tabela privada, nem alterar permissões de outros consumidores como efeito do piloto.
- Gravação de empresa de teste exige conferência das precondições e trilha. Mudança de permissão compartilhada, coleta real e publicação operacional são gates próprios. O [inventário de dados](../DATA_PRIVACY.md#inventário-por-campo) registra finalidades, leitores e guarda a validar com a CALI. A prova usa apenas dados sintéticos.
- Filtros e empresa selecionada pertencem à URL. Sessão e papel vêm do contexto de acesso. Consultas e invalidações ficam na camada de dados, separadas por ator e empresa. Rascunhos ficam na tela até sucesso confirmado. Na troca de empresa, o formulário é desmontado.
- QA de navegação no navegador integrado. Provas SQL focadas em banco descartável, sem retomar a bateria de runtime suspensa. Atualizar o PR #2 e o roadmap em cada lote e seguir para o próximo sem novo aval, salvo dependência externa.

## Estado

### Entregue na candidata e instalado para homologação

- `/cliente/equipe` deriva a empresa da sessão. `/admin/equipe` oferece seleção explícita entre A/B. Diretório pagina 25 fichas, separa arquivadas e preserva filtro, página, mês e ficha na URL. Estrutura agrupa pessoas vigentes por departamento e gestor direto.
- O [diretório](../../supabase/proposals/team-2b/directory.sql) e a [manutenção](../../supabase/proposals/team-2b/maintenance.sql) projetam os campos profissionais, registram movimentos no mês atual ou anterior de Brasília, preservam a preimagem e rejeitam gestores inválidos e ciclos. Arquivamento remove do quadro atual e preserva situação e histórico. Cadastro e importação não confirmam o mês.
- A [ficha privada](../../supabase/proposals/team-2b/private-fields.sql) exige abertura explícita, declaração de origem para gravar e comparação de versão. Consulta e edição ficam no escopo da empresa. O trigger legado continua auditando campos alterados. A RPC acrescenta a data da revisão salarial à trilha e preserva o avatar profissional anterior na mesma transação.
- A [importação](../../supabase/proposals/team-2b/import.sql) lê CSV UTF-8 de até 1 MB e 2.000 pessoas. A prévia envia apenas campos profissionais, detecta novos, alterados, reativados e ausentes e sinaliza gestor inválido. Dados privados seguem só na confirmação com declaração por linha. Célula privada vazia preserva o dado existente. A gravação é atômica, inclusive se falhar a versão privada.
- O [histórico](../../supabase/proposals/team-2b/history.sql) projeta movimentações e os campos dos snapshots existentes, sem recalcular indicadores. O nome vem da ficha atual como identificação contextual. Histórico de métricas e lançamento/correção mensal ficam para a 2C.

O catálogo do CALI MAPA confirmou as dez RPCs V2 de Equipe com execução para `authenticated` e recusa para `anon`. Nenhuma policy legada foi alterada. As duas matrículas atuais do piloto têm `is_primary=false`. Os escritores legados que exigem essa marca ficam fora da jornada V2. A abertura para outras matrículas depende de conferir o mesmo isolamento das superfícies legadas.

### Evidência e pendências

PostgreSQL descartável confirmou leitura isolada por empresa, recusa sem aceite ou MFA, corte, cadastro, alteração parcial, conflito de versão, arquivamento, dados privados com declaração e rollback de importação. A prova de histórico preservou o snapshot após mudança do cadastro. No navegador integrado com transporte sintético, foram exercitados edição, abertura de privados, histórico, estrutura e importação com prévia. A 390 px, a página preservou a largura e a tabela rolou dentro do próprio contêiner. Testes de interface e parser CSV ficam na suíte Vitest.

Cliente B autenticado passou pelo fluxo no navegador integrado. Criou `QA-2B-B-01`, trocou o departamento, registrou dados privados e importou `QA-2B-B-CSV` com valor privado declarado. A prévia preservou a ficha ausente. Recarga e consulta independente confirmaram persistência. As duas fichas foram arquivadas sem desligamento. O histórico da primeira mostrou admissão, transferência e arquivamento. A URL Cliente com empresa A continuou consultando a empresa B da sessão.

Dois Clientes equivalentes da mesma empresa foram provados no PostgreSQL descartável. O segundo alterou a ficha e leu os dados privados. Após revogá-lo, a sessão antiga perdeu a leitura e o primeiro manteve a ficha atualizada. No navegador integrado, falta conferir a seleção A/B pelo Admin autenticado com MFA e concluir a rodada de atores do piloto. A ampliação para dados reais exige validação do conteúdo de finalidade, necessidade e guarda no [inventário de privacidade](../DATA_PRIVACY.md).

Rollback do banco retira os endpoints V2 na ordem [histórico](../../supabase/proposals/team-2b/rollback-history.sql), [importação](../../supabase/proposals/team-2b/rollback-import.sql), [privados](../../supabase/proposals/team-2b/rollback-private-fields.sql), [manutenção](../../supabase/proposals/team-2b/rollback-maintenance.sql) e [diretório](../../supabase/proposals/team-2b/rollback-directory.sql). Dados e trilhas ficam preservados. A SPA anterior volta a mostrar Equipe como módulo em preparação.
