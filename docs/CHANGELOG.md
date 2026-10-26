# Registro de mudanças

## 26/10/2026 — Revisão de produto e plano por fluxos completos

- **Autor e autorização:** agente Codex; Felipe autorizou aplicar a revisão de produto da Patrícia e atualizar o PR #1, mantendo o detalhamento do resumo diário pendente de resposta.
- **Decisões:** DEC-13 substitui DEC-07 com três públicos DISC; DEC-14 a DEC-18 registram referência funcional testada, comunicação por público, regras de produto/interface, prioridade e documentação de dados pessoais. Demais decisões anteriores continuam vigentes; aprovação interna não é ciência Cliente e pessoa focal não cria acesso principal.
- **Fontes:** comentários da Patrícia no PR e complemento fornecido pelo Felipe. Consulta somente leitura ao GitHub confirmou mensagem “Publicação 83” em `f3d3f14043a6abc38636f0340fe831e621d8b357`, o mesmo SHA das fontes. Não houve auditoria de runtime/banco.
- **Arquivos:** novos PRODUCT_RULES, BASELINE_REFERENCE_2026-10-26 e DATA_PRIVACY; atualização de README, AGENTS, índice, decisões, contexto, DS/UX, arquitetura, contratos, permissões, catálogo/fichas, política e roadmap.
- **Roadmap:** fundação mínima e entregas completas de empresas/acessos, Equipe e dados mensais; depois DISC e demais fluxos; Partner posterior. Matriz cobre os 18 IDs com dependências, bloqueios e aceite. DS, rotas, hooks e integração acompanham cada entrega.
- **Pendências:** RESUMO-01 / OPEN-13 aguardam conteúdo/público/recorte/agenda detalhados; finalidade/guarda dos dados têm inventário e validação documental próprios, sem prazos inventados. TEC-01/02/03 continuam abertos para as operações afetadas.
- **Validação desta rodada:** conferência de links/âncoras, Markdown/whitespace, regras/decisões/públicos, cobertura de fluxos e hashes de código/configuração/handoff. Build/typecheck, QA de aplicação, RLS e CI não executados, pois somente documentação mudou.
- **Execução:** nenhum código/dependência/env/schema/payload/policy ou dado alterado; sem Supabase, migration, comunicação operacional, deploy ou escrita no oficial. A atualização do PR é documental; fase 1 não iniciada.
- **Rollback:** reverter somente o commit desta revisão; preservar fontes/levantamento anteriores e histórico de decisões. Sem alteração de runtime/dados para desfazer.

## 26/10/2026 — Preparação do PR da base documental

- **Autor:** agente Codex; PR solicitado pelo usuário antes de iniciar a fase 1.
- **Escopo:** README, AGENTS e documentação nova de diagnóstico, arquitetura, produto, UX/UI, DS, fluxos, permissões, decisões, contratos, fases e validação. Handoff histórico preservado.
- **Destino:** revisão para `patricia258/cali-workspace-v2:main`, por branch `codex/docs-cali-standardization` em fork da conta autenticada, que possui somente leitura no repositório de destino. Commit e URL do PR serão informados na entrega.
- **Validação:** 27 documentos e 479 links locais conferidos; 18 IDs na matriz do roadmap; Markdown/whitespace íntegros; nenhum padrão de credencial encontrado na conferência textual; código/configuração e handoff sem alterações. A conferência textual não é certificação de segurança.
- **Limites:** sem repetição de build/typecheck por ser mudança documental; nenhum teste de aplicação, autenticação, RLS, integração ou CI executado nesta rodada. As execuções históricas permanecem identificadas nos registros anteriores.
- **Estado:** pacote preparado para revisão; fase 1 não iniciada. Não inclui merge, conexão ao Supabase, migration, comunicação operacional ou deploy.
- **Rollback:** reverter o commit documental preserva implementação e dados; regras aprovadas continuam registradas na conversa e devem ser recuperadas antes de trabalho posterior.

## 26/10/2026 — Roadmap detalhado após as decisões de produto

- **Autor:** agente Codex, conforme pedido de revisar o plano sem implementar. Revisão local sem commit.
- **Arquivos:** ROADMAP, INDEX, DECISIONS, README e este registro.
- **Mudança:** fases 0–7 detalhadas com dependências, entregas, bloqueios e aceite; decisões DEC-05 a DEC-12 rastreadas; integração organizada em ondas 6A–6D e matriz de cobertura/aceite dos 18 fluxos. Fichas permanecem donas das regras e casos de fronteira.
- **Impacto:** distingue levantamento já entregue de implementação ainda planejada; permite fundação/UX/DS/rotas independentes de contratos ausentes, mantendo bloqueio por operação real. Não expande a área Partner nem adia fluxos silenciosamente.
- **Dependências:** TEC-01/02/03, ambiente isolado e questões específicas continuam abertos até prova. Responsáveis individuais, estimativas e detalhes de contratos ainda não comprovados não foram inventados.
- **Validação:** conferência documental de links/âncoras, Markdown, cobertura dos 18 IDs e oito decisões, referências de pendências e preservação de código/configuração/handoff. Nenhum teste de aplicação, RLS ou fluxo real foi executado nesta revisão.
- **Execução:** sem mudanças de dependências, envs, migrations ou implementação; sem conexão ao banco, nova consulta ao oficial, efeito externo, CI executada, commit, PR ou publicação. Aceite de produto anterior não é aceite de implementação futura.
- **Rollback:** reverter somente esta revisão de roadmap e referências associadas, preservando levantamento e decisões de produto anteriores. Não há mudança de runtime/dados para desfazer.

## 26/10/2026 — Oito decisões de produto antes das fases

Registro histórico da rodada inicial: DEC-07 foi posteriormente substituída por DEC-13, conforme a revisão de produto acima. O alvo vigente é Cliente somente gestão, avaliador interno e respondente somente PDF próprio por e-mail.

- **Autor:** agente Codex, registrando respostas expressas do usuário.
- **Decisões:** DEC-05 a DEC-12: até quatro Clientes equivalentes sem principal; reabertura Admin do mesmo item com motivo/histórico; perfil individual e agregado liberados pela CALI; adesão antes do convite e termos obrigatórios por versão; Cliente/Admin informam e consultam privados; Cliente lança métricas e só Admin corrige; item reaberto indisponível até liberação; nova aprovação de entrega e ciência de relatório só quando solicitada.
- **Estado:** PROD-01 a PROD-08 respondidas. Nenhuma opção preselecionada foi tratada como resposta; confirmações vieram do usuário.
- **Arquivos:** registro de decisões, matriz alvo, fichas afetadas, contexto, dados/contratos, README, índice, AGENTS, roadmap e este registro.
- **Impacto:** contrato alvo documental da V2. Nenhum código, schema, enum, payload, policy, integração ou dado alterado. Tabelas de evidência oficial permanecem como retrato da revisão anterior.
- **Pendências:** TEC-01/02/03 — recuperar contratos, reconciliar guardas/consistência e provar em ambiente isolado autorizado; questões específicas de domínio/QA permanecem visíveis.
- **Validação:** coerência entre decisões/matriz/fichas, links/âncoras, Markdown e whitespace. Testes de aplicação/QA/RLS não executados, por ausência de implementação.
- **Execução:** nenhuma fase iniciada, sem conexão ao banco, migration, envio, escrita no oficial ou publicação.
- **Rollback:** reverter somente o registro e a propagação desta rodada, preservando fontes e fichas de levantamento anteriores.

## 25/10/2026 — Priorização das dúvidas antes das fases

- **Autor:** agente Codex, conforme pedido de priorizar bloqueios e perguntar decisões necessárias.
- **Arquivos:** DECISIONS, ROADMAP e este registro.
- **Resultado:** seis decisões de produto organizadas em duas rodadas; três perguntas apresentadas inicialmente. Lacunas de servidor, guardas, consistência e operação separadas como trabalho técnico; detalhes de domínio/QA não viraram bloqueios globais artificiais.
- **Estado:** respostas ainda não registradas nesta entrada; nenhuma opção preselecionada ou recomendação equivale a aprovação.
- **Impacto:** somente documentação/perguntas. Nenhuma fase de implementação, conexão ao banco, alteração de permissão, migration, publicação ou consulta adicional ao oficial.
- **Validação:** coerência com fichas/matriz e conferência documental. Sem repetição de testes da aplicação, pois código permanece intacto.
- **Rollback:** reverter somente os trechos desta priorização, preservando fichas, matriz e levantamento anteriores.

## 25/10/2026 — Fichas, transições e matriz Cliente/Admin

- **Autor:** agente Codex, conforme solicitação expressa de completar documentação sem implementar.
- **Fonte oficial:** `patricia258/app.cali@f3d3f14043a6abc38636f0340fe831e621d8b357`, somente leitura via GitHub. 367 fontes obtidas para pesquisa/conferência; 166 migrations pesquisadas, sem executar SQL ou código importado.
- **Entrega:** 18 fichas vinculadas ao catálogo, transições/guardas por domínio, matriz por operação distinguindo UI/SQL/EDGE, índice com 119 referências de fonte, 29 nomes literais de RPC sem corpo localizado e dúvidas REF-01 a REF-24.
- **Arquivos novos:** `docs/PERMISSIONS.md`; `docs/flows/README.md`, `SOURCES.md`, `ACCESS_ACCOUNTS.md`, `WORKSPACE_HOURS_TEAM.md`, `PROJECTS.md`, `CALENDAR.md`, `RECORDS.md`, `DOCUMENTS_REPORTS.md`, `ADMIN_LIFECYCLE.md`, `FORMS_PEOPLE_PROFILE.md`.
- **Arquivos atualizados:** README, AGENTS, índice, catálogo, dados/contratos, decisões, roadmap, contexto e este registro. Baseline inicial permanece como retrato histórico.
- **Impacto:** nenhuma alteração de UI/código, fórmula, payload, contrato efetivo ou permissão. Fichas são levantamento estático com dúvidas, não validação funcional.
- **Banco/migrations/envs/dependências/deploy:** nenhuma mudança ou execução. Sem conexão ao banco/integrações, login, envio, publicação ou escrita no oficial.
- **Validação:** cobertura dos 18 IDs, links/âncoras locais, referências imutáveis/linhas nas fontes, blocos Markdown, whitespace e hashes do código/configuração/handoff originais. Nenhuma suíte de aplicação repetida; não houve implementação.
- **QA visual/Admin/Cliente/RLS:** não executado. Nenhuma aprovação funcional inferida.
- **Rollback:** remover somente os onze arquivos desta etapa e reverter seus vínculos/atualizações, preservando as entregas documentais anteriores e mudanças posteriores.
- **Próximas decisões:** recuperar definições ausentes, reconciliar divergências de guardas/estados e decidir contratos antes da implementação; depois provar em ambiente isolado autorizado.

## 25/10/2026 — Reavaliação documental e cobertura UX/UI

- **Autor:** agente Codex, conforme pedido de reavaliação da documentação.
- **Base:** checkout V2 e documentos locais revistos; sem nova consulta ao oficial/banco. Nenhum commit criado.
- **Arquivos novos:** `PRODUCT_CONTEXT.md`, `UX_UI.md`, `FLOW_CATALOG.md`, `DECISIONS.md` em `docs/`.
- **Arquivos atualizados:** README, AGENTS, índice, arquitetura, DS, dados/contratos, roadmap, política de mudança e este registro.
- **Motivo:** separar experiência de componentes e consolidar contexto, tarefas/aceite e decisões sem duplicar responsabilidades.
- **Impacto:** somente documentação. Catálogo contém inventário inicial, fichas pendentes e exemplo parcial; não representa jornadas integradas.
- **Banco/migrations/envs/dependências:** nenhuma mudança. **Testes de aplicação:** não repetidos; código permaneceu intacto.
- **Validação documental:** links locais, fechamento de blocos e whitespace conferidos. **QA visual/usabilidade/Admin/Cliente:** não executado nesta revisão.
- **Aprovação:** base/escopo/identidade seguem confirmações anteriores; novas diretrizes são propostas, não aceite funcional.
- **Rollback:** remover apenas os quatro documentos desta revisão e reverter seus vínculos/ajustes nos documentos existentes, preservando a primeira entrega e alterações posteriores.
- **Próximo trabalho:** preencher fichas/contratos/permissões, resolver pendências por recorte e validar experiência com evidência.

## 25/10/2026 — Diagnóstico e documentação de desenvolvimento

- **Autor:** agente Codex, conforme solicitação do usuário.
- **Revisão analisada:** V2 `7c0a232`; referência oficial `f3d3f14043a6abc38636f0340fe831e621d8b357`, somente leitura. Nenhum commit criado nesta entrega.
- **Arquivos:** README atualizado; AGENTS criado; `docs/INDEX.md`, `BASELINE_2026-10-25.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `DATA_CONTRACTS.md`, `ROADMAP.md`, `CHANGE_POLICY.md`, `RUNBOOK.md` e este registro criados.
- **Motivo:** documentar o estado real, reconciliar os contratos oficiais CALI e propor a padronização de todos os fluxos nesta V2.
- **Decisões confirmadas pelo usuário:** V2 como base; cobertura de todos os fluxos; manter bordô/marfim/dourado; referência oficial somente leitura.
- **Impacto em fluxo:** nenhum código de aplicação alterado. Arquitetura, router, DS, hooks, contexts e integração permanecem propostas.
- **Banco/migration:** não. **Novos envs:** não. **Dependências:** nenhuma alteração no checkout.
- **Validação executada:** typecheck/build da base em cópia temporária isolada; conferência documental e de whitespace. Não existe suíte automatizada no checkout.
- **QA manual Admin/Cliente:** não executado no navegador; nenhuma jornada autenticada ou acesso ao banco.
- **Aprovação:** escopo/base/identidade confirmados; proposta de implementação ainda não submetida a aceite final.
- **Rollback:** restaurar README anterior e remover somente arquivos novos desta entrega, preservando alterações posteriores.
- **Pendências:** inventário completo de paridade, conflitos funcionais do baseline, fundação reproduzível e execução das fases propostas.
