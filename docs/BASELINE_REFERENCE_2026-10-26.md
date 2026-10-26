# Referência funcional CALI — 26/10/2026

Estado: **referência de produto confirmada; V2 ainda não implementada**. O aplicativo oficial como está funcionando em 26/10/2026, testado pela Patrícia, é a base de paridade. A V2 deve reproduzir seus fluxos antes de acrescentar melhorias. O oficial permanece congelado para este trabalho e consultável somente em leitura.

## Identificação

| Informação | Evidência e limite |
| --- | --- |
| Publicação indicada pela responsável de produto | Publicação 83, conforme [revisão da Patrícia](https://github.com/patricia258/cali-workspace-v2/pull/1#issuecomment-6417356971) e confirmação do Felipe |
| Código correspondente à identificação | [`f3d3f14043a6abc38636f0340fe831e621d8b357`](https://github.com/patricia258/app.cali/commit/f3d3f14043a6abc38636f0340fe831e621d8b357) |
| Mensagem do commit | “Publicação 83 — Perfil comportamental: assinatura, protocolo e entrega” |
| Metadados consultados em 26/10/2026 | GitHub informa esse SHA como `main`; data do commit: 24/10/2026, 00:43:08 UTC |
| Validação funcional da referência | Declarada pela Patrícia e aceita pelo Felipe; não é execução de QA autenticado pelo agente |
| Configuração e banco ativos | Não inspecionados nesta revisão; migrations e código não comprovam aplicação/configuração do ambiente |

O SHA já utilizado no [índice de fontes](flows/SOURCES.md) identifica a publicação 83. Seus links imutáveis permanecem válidos; não é necessário inventar outra revisão para representar a data da validação do produto. O [diagnóstico de 25/10](BASELINE_2026-10-25.md) continua como inventário histórico da V2.

## Paridade e decisões posteriores

O funcionamento oficial é a referência de entrada. [Regras de produto](PRODUCT_RULES.md) e [decisões vigentes](DECISIONS.md) registram diferenças aprovadas para a V2, incluindo a nova separação de públicos do DISC. Não reproduzir silenciosamente uma policy antiga contrária ao alvo confirmado.

Para cada fluxo, registrar: comportamento da publicação 83; regra vigente; diferença aprovada, se houver; operação/arquivo de origem; cenário permitido/negado; evidência de teste da V2 e aceite de produto. Diferença desconhecida é investigada, não transformada em melhoria implícita nem em regra inventada.

Uma alteração futura da referência exige nova evidência e registro de diferenças. Não atualizar automaticamente para a `main` mais recente nem modificar o aplicativo oficial durante a padronização.

## Aceite futuro de cada entrega

- Mesmos objetivos, entradas, dados e resultados do fluxo oficial, salvo diferença explicitamente aprovada.
- Transições, autorização por ator/empresa, efeitos e histórico preservados.
- Estados de erro, vazio, indisponibilidade e expiração identificados; ausência de sucesso fictício.
- Interface CALI conforme DS/UX e regras atuais; funcionamento mobile e por teclado.
- Testes reais em ambiente isolado autorizado para dados/acesso; validação humana da tarefa. Publicação e efeitos externos têm escopo próprio.

Nenhum banco, sessão de produção, migration, envio ou deployment foi acessado ou executado para produzir esta identificação.
