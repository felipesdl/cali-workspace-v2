# Política de construção e mudança

Estado: orientação de desenvolvimento proposta. Scripts/estrutura atualmente existentes estão no [runbook](RUNBOOK.md); fases em [roadmap](ROADMAP.md).

## Antes de implementar

1. Localizar o domínio, seus consumidores e regra canônica.
2. Conferir código atual; não repetir fatos do baseline como se nunca mudassem.
3. Declarar o recorte: reorganização, mudança visual, funcional, de contrato ou de dados.
4. Inventariar efeitos e comportamentos externos ao componente, especialmente runtimes oficiais.
5. Definir aceite observável e testes proporcionais ao risco.

Para mudança de experiência/comportamento, localizar o ID em [Catálogo de fluxos](FLOW_CATALOG.md), preencher a ficha pertinente e conferir [UX/UI](UX_UI.md) e [Decisões](DECISIONS.md). DS isolado não determina jornada, permissão ou significado de uma confirmação.

Conferir também [Regras de produto](PRODUCT_RULES.md) e [publicação 83](BASELINE_REFERENCE_2026-10-26.md): cada entrega fecha tarefa, dados, interface, permissão, falhas e comunicação aplicável. Chat não gera e-mail; RESUMO-01 / DEC-19 define o resumo Admin e mantém versão Partner posterior. Conferir filtros, volume e corte temporal; não reativar digest de chat das 08h. Para campos pessoais, conferir informação/validação do acesso e finalidade/guarda no [documento dono](DATA_PRIVACY.md).

Reorganização de arquivos não deve mudar silenciosamente payload, fórmulas, permissões, valores já aceitos ou histórico. Se precisar mudar contrato, documentar compatibilidade e decisão antes de portar consumidores.

## Gates

| Mudança | Evidência exigida |
| --- | --- |
| Documentação | Links locais válidos, fatos conferidos, proposta distinguida de implementação, `git diff --check` |
| Experiência/composição | Tarefa/ator, anatomia, ações, estados, continuidade e comportamento responsivo especificados; validação registrada sem confundir proposta com teste de usabilidade |
| Reorganização sem comportamento | Typecheck/build; conferir imports/exports e comportamento preservado; lint quando implantado |
| Componente DS/layout | Consumidores reais, estados, teclado/foco, contraste e capturas nas larguras definidas |
| URL/filtros | Parse inválido/defaults, URL direta, reload, Back/Forward, reset/preservação e shell persistente |
| Regra pura | Casos de fronteira no dono da regra; período vazio, retroatividade e identidade quando aplicáveis |
| Hook/dados | Loading/erro/vazio/retry, cache/invalidação, concorrência, troca de empresa e sessão |
| Contrato Supabase | Operação permitida/negada em ambiente isolado; RLS/RPC/storage conforme superfície; falha/atomicidade/idempotência |
| Jornada crítica | E2E de transição e falha; desktop/mobile; cliente/Admin/Partner aplicáveis |
| Entrega completa de fluxo | Checklist contra referência funcional e alvo atual; dados, permissão, UI, histórico/falha e canais aplicáveis testados; aceite de produto |
| Informação sobre dados pessoais | Campos/consumidores/finalidade/guarda documentados e validados; informação apresentada e versão/aceite coerentes; projeções privadas testadas |
| Release | Gates da alteração + ambiente/revisão, configuração, observabilidade, rollback e aceite |

Não criar testes que apenas reproduzam a implementação. Não exigir uma suíte nova para ajuste documental. Mock prova comportamento do cliente; não prova RLS, envio de e-mail ou sincronização externa.

Desde 27/10, `npm run verify` agrega formatação, lint, typecheck, testes, integridade da configuração local, links documentais e build. Escopo/exceções legadas estão no runbook. Workflow definido não comprova CI executada; verificações locais não substituem gates de permissão/integração ou aceite funcional. Não criar scripts que prometam garantias não executadas.

Migração de estilos segue DEC-24: novas peças/consumidores usam Tailwind e tokens CALI. Remover CSS/imports substituídos junto da migração; manter folhas compartilhadas enquanto houver consumidores. Conferir o inventário no [DS](DESIGN_SYSTEM.md#inventário-da-migração-de-estilos). Limpeza global ocorre após a migração completa, com revisão da cascata/base e regressão dos fluxos.

## Controle de documentação

- Atualizar o documento dono da mudança, conforme [índice](INDEX.md).
- Registrar versão/revisão e fonte quando descrever contrato externo.
- Não promover proposta para “implementado” antes da mudança existir e ser validada.
- Preservar handoff histórico; acrescentar divergências no documento atual.
- Não copiar credenciais, dados de clientes ou capturas privadas para a documentação.

## Registro de entrega

Cada entrega registra autor/agente, data, revisão ou ausência de commit, arquivos, motivo, impacto, migrations, envs, testes, QA manual Cliente/Admin, estado de aprovação e rollback. Usar [CHANGELOG](CHANGELOG.md) ou descrição da mudança com esse mesmo conteúdo; evitar duplicar relatos extensos.

No PR de acompanhamento da fase 1, atualizar a descrição a cada lote de commits: escopo entregue, checklist restante, validação da revisão enviada e limites. ROADMAP e documentos donos continuam canônicos; desmarcar ou corrigir um item se surgir evidência contrária. Manter o PR em rascunho enquanto faltarem os critérios de fechamento. Atualizar o changelog com resultados sem confundir CI pendente, revisão, merge e deploy.

Commits devem separar documentação/fundação, DS, navegação e integração em recortes revisáveis. Não criar commit, PR, deploy ou migration apenas para fechar o diagnóstico.
