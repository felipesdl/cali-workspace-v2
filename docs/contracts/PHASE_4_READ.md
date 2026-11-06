# Fase 4 — Consultas de homologação

Primeiro incremento da fase 4. A publicação 83 continua como referência de interface e comportamento; a composição simplificada serve para validar os contratos do piloto. Paridade e aceite final seguem no [roteiro da Patrícia](../HOMOLOGACAO_PATRICIA.md).

Em 05/11/2026, leitura somente do catálogo do CALI MAPA conferiu colunas, políticas, gatilhos e corpos de RPCs. O incremento usa quatro novas RPCs em propostas SQL, sem mudar tabelas, grants legados ou gatilhos. Não houve aplicação hospedada.

| Domínio | Consulta implementada no código | Próxima entrega operacional |
| --- | --- | --- |
| 4A Projetos e entregáveis | Lista e detalhe, última revisão e prazo, frentes do projeto e entregáveis paginados | Rascunho estruturado, compartilhamento, aprovação/ajustes e execução; reabertura do mesmo entregável, histórico, bloqueio e nova aprovação |
| 4B Horas e agenda | Extrato por mês (soma dos lançamentos exibidos, sem saldo contratual), agenda do mês em Brasília | Timer/manual, capacidade e saldo conciliados, solicitação/reunião com estado real da integração |
| 4C Ocorrências, documentos e avisos | Ocorrências por visibilidade, metadados de documentos, avisos publicados para a audiência do Cliente | Conversas sem e-mail, anexos/versões/ciência e notificações, resumo diário Admin |
| 4D Relatórios e satisfação | Lista e resumo executivo dos relatórios disponibilizados | Fontes e curadoria, revisão/PDF, publicação/ciência, reabertura do mesmo relatório e tratamento da avaliação |
| 4E Comercial e administração | Consulta de frentes contratadas | Propostas, Forms, Mapa, ajuda, auditoria, direitos, exportação/encerramento e equipe CALI |

A empresa de Cliente vem da sessão, nunca do filtro da URL. Admin escolhe uma das empresas piloto e exige MFA. A guarda compartilhada exige sessão ativa, aceite vigente e vínculo admitido. As RPCs vinculam explicitamente a empresa a cada consulta, omitem notas internas para Cliente e não retornam URL, caminho do Storage ou conteúdo de arquivos. Cache separado por ator, empresa, filtros e página. A autorização do catálogo de documentos não comprova autorização para baixar.

## O que o catálogo resolveu

- O corpo instalado de abertura e o de resolução de ajuste calculam `now() + 24h × client_response_business_days`, padrão 3: **72 horas corridas** no padrão. O ajuste v39 exige revisão pendente e permite pedidos nas rodadas 1 e 2. O timestamp não funciona como bloqueio de prazo nessa RPC. Reagendamento exige data; troca exige outro entregável do projeto com complexidade equivalente.
- Compartilhar cronograma já insere notificações com `email_required=true`; o gatilho de movimento também pode marcar e-mail no compartilhamento e na aprovação. Exercitar o fluxo exige separar o transporte no ambiente de teste e conferir duplicidade. UPDATE direto não substitui as guardas das operações.
- A RPC legada de mudança de status não reabre entregável aprovado. A de relatório v63 só aceita relatório ainda não visto, arquiva o anterior e cria outro registro. Ambas precisam de caminho V2 conforme DEC-06/11/12, com histórico e visibilidade por revisão.
- Horas para Cliente combinam permissão por mês, publicação do lançamento e projeto operacional. A soma implementada usa exatamente esses lançamentos; preço, saldo e capacidade seguem nos contratos próprios.

## Validação e reversão

A prova com PostgreSQL descartável (`supabase/proposals/phase-4/test.sh`) executa as projeções e a guarda do piloto com sessão, dados e dependências do legado sintéticos. Cobre papéis e permissões, MFA, aceite, revogação, isolamento A/B, filtros, campos privados, mês em Brasília, paginação e rollback. Não certifica Data API hospedada ou navegador autenticado.

O frontend exige modo desenvolvimento, composição do piloto A/B e `VITE_CALI_PHASE4_READ=true`. Manter desativado até instalar as quatro RPCs em ambiente de homologação autorizado. A ausência das RPCs deve resultar em erro de consulta; não há fallback para dados de demonstração. Para reverter, desligar a flag e, caso as propostas tenham sido aplicadas, usar `supabase/proposals/phase-4/rollback-read.sql`: remove somente as quatro RPCs novas. Não é necessário ligar o cron DISC para este incremento.
