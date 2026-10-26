# Design system CALI

Estado: **regras de identidade/experiência confirmadas; implementação e contratos de componentes propostos**. Atualização: 26/10/2026. Fonte visual: V2 e [publicação 83](BASELINE_REFERENCE_2026-10-26.md). [Regras de produto](PRODUCT_RULES.md), UI-01 a UI-14, definem os resultados obrigatórios; não há DS implementado nesta entrega.

Este documento é dono de tokens, primitivas e seus contratos. Composição de telas, hierarquia de ações, escolha de página/drawer/modal e continuidade de tarefas pertencem a [UX/UI](UX_UI.md). Usar o [Catálogo de fluxos](FLOW_CATALOG.md) para aplicar essas peças a uma jornada concreta.

## Identidade e direção

Produto consultivo, editorial e compacto: superfícies predominantemente claras, bordô para navegação/ação principal e dourado como detalhe. Cards são pontuais; diretório, extrato, cronograma e leitura executiva têm composições próprias. Não transformar todas as páginas em uma faixa de indicadores seguida de cards.

Tema exclusivo da V2: claro, em Cliente e Admin; sem modo noturno. Folha e lima usam assets oficiais CALI identificados. Fotos/logos são quadrados com cantos de 7 px; não circulares. PDFs usam Inter sem serifa. Nenhuma dessas regras comprova implementação ou homologação visual.

## Camadas de tokens

1. **Primitivos:** valores de marca, neutros, escalas de espaço/tipo/raio.
2. **Semânticos:** papel do valor na interface: texto, superfície, borda, ação, status, foco.
3. **Componente:** apenas especializações necessárias, como largura de sidebar ou altura de linha.

Fonte futura: `src/styles/tokens.css`, consumida pelo DS. Novas features usam tokens semânticos; não repetem hex. Tokenizar primeiro valores efetivamente usados, sem criar centenas de aliases para reproduzir a cascata atual.

### Paleta primária

| Valor existente | Token primitivo proposto | Uso semântico |
| --- | --- | --- |
| `#5A1E2D` | `--color-brand-burgundy` | Ação primária, navegação selecionada, links |
| `#F7F3EE` | `--color-brand-ivory` | Fundo da aplicação |
| `#2B2B2B` | `--color-brand-graphite` | Texto principal |
| `#B7A99A` | `--color-brand-taupe` | Detalhes/divisórias; não assumir contraste para texto pequeno |
| `#B58C52` | `--color-brand-gold` | Detalhe, ênfase pontual; não usar indiscriminadamente em texto/estado |
| `#FFFFFF` | `--color-neutral-white` | Superfícies principais |

Aliases esperados: `--surface-app`, `--surface-panel`, `--surface-subtle`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-default`, `--action-primary`, `--action-primary-hover`, `--focus-ring`. Valores secundários, hover e foco precisam de verificação de contraste no fundo real; não estão homologados aqui.

### Paleta de status

Fonte: [CALI_SECONDARY_PALETTE.md na revisão consultada](https://github.com/patricia258/app.cali/blob/f3d3f14043a6abc38636f0340fe831e621d8b357/docs/CALI_SECONDARY_PALETTE.md).

| Estado/uso no documento oficial | Valor | Semântica proposta |
| --- | --- | --- |
| Aprovado | `#367B60` | Sucesso |
| Revisão CALI | `#3D7793` | Revisão interna/informação |
| Ajuste solicitado | `#B84D51` | Ajuste/atenção conforme fluxo |
| Rebriefing | `#AD4F6A` | Revisão de escopo |
| Em espera | `#8B786E` | Espera |
| Validação do cliente | `#E3A536` | Ação pendente |
| Detalhes de avaliação | `#D85C73`, `#2BAFA8` | Série/destaque de avaliação |

São valores de referência, não certificação de acessibilidade. Definir pares texto/fundo/borda por estado e validá-los antes de virar primitiva. Cor de categoria/gráfico não concede significado de sucesso ou erro. Status deve aparecer em texto; não criar enum de negócio a partir da cor.

## Tipografia, densidade e movimento

- Inter é a fonte atual, carregada via Google Fonts; manter fallback de sistema e decidir hospedagem/cache na fundação.
- Declarar escala única de títulos, corpo, auxiliar e dados tabulares. Não continuar adicionando valores independentes de 9–13 px para caber conteúdo.
- Conflito a homologar: PRODUCT_RULES oficial recomenda corpo de 16 px; V2 define raiz de 13 px e auxiliares menores. Proposta: corpo legível de 16 px e variante compacta explícita para tabelas, validada nas quatro larguras, sem encolher globalmente a interface.
- Proposta de escala: 4/8/12/16/24/32 px; referência de separação entre cards de 14–16 px, com padrão técnico proposto de 16 px e alinhamento conferido no layout. Raios gerais de 4/8/12 px são proposta; fotos/logos têm regra específica de 7 px.
- Centralizar z-index por camada: navegação, popover, overlay, toast. Não elevar z-index por tentativa em cada módulo.
- Motion breve e funcional; respeitar preferência de movimento reduzido. Ação essencial funciona sem hover.

## Catálogo mínimo e contratos

| Peça | Contrato obrigatório | Primeiros consumidores |
| --- | --- | --- |
| `Button`/`IconButton` | Variantes, tamanho/densidade, disabled, pending, nome acessível, bloqueio de duplo envio | Todos os fluxos |
| `PageShell`/`PageHeader`/`FilterBar` | Slots, título único, ações/filtros responsivos | Equipe, Horas, Admin |
| `Tabs` | Controlado, identificadores estáveis; navegação ou painel local explicitamente definidos | Equipe e Projetos |
| `Field`/`TextInput`/`Select`/`TextArea` | Label, ajuda, erro associado, required/disabled; sem placeholder como único label | Busca e formulários |
| `Badge`/`StatusBadge` | Texto + semântica, sem inferir permissão; estados oficiais mapeados por domínio | Entregas, ocorrências, avisos |
| `Dialog`/`Drawer` | Título, foco inicial/contenção/retorno, Escape, overlay, scroll e ação pendente | Pessoa, documento, ocorrência |
| `Popover`/`DropdownMenu` | Dono único de posicionamento, colisão, teclado e fechamento | Perfil, notificações, flyout |
| `Table`/`List` | Identidade estável, cabeçalhos/semântica, vazio, overflow e paginação quando real | Equipe, contas, extrato |
| `LoadingState`/`ErrorState`/`EmptyState` | Mensagem específica, retry onde fizer sentido, próxima ação | Todas as consultas |
| `Toast` | Sucesso/erro/status com anúncio; duração e deduplicação comuns | Todas as ações |
| `Avatar`/formatadores de data e duração | Fallback autorizado e formatação central, sem alterar fórmula | Pessoas, horas, histórico |

O consumidor visual de foto/logo mantém formato quadrado e raio de 7 px mesmo quando a API interna da peça usa o nome `Avatar`. Barras de controles priorizam linha única sem cortar ações em mobile; rolagem discreta mantém operação por toque/teclado e indicação de continuação. Alertas de atenção/erro usam âmbar/vermelho e orientação textual; demais estados mantêm a semântica da paleta.

Dialog de confirmação, inclusive exclusão, deve seguir o padrão visual atual identificado na publicação 83 e explicar objeto/efeito. Não criar novo formato a partir de um texto genérico de confirmação. Formulário por seções e notas de rodapé são decisões de composição em UX/UI; foco/teclado/scroll pertencem ao DS.

Não criar `DataTable` universal com todos os filtros/ações do produto. DS fornece semântica e composição; coluna, escopo e permissão continuam no domínio. Charts recebem dados com origem e período; não calculam indicador oficial.

Abas de navegação devem usar links/roteador. Abas locais com `tablist` precisam de relação tab/panel e teclado completo.

Biblioteca acessível de primitivas pode ser avaliada na fundação mínima e nos consumidores de cada entrega. Não implementar foco/posicionamento por página nem adicionar biblioteca sem conferir compatibilidade, tamanho e contrato.

## Política de CSS

- Tokens/base carregados uma vez; estilo de componente tem escopo próprio, por convenção ou CSS Modules a definir na implementação.
- Não usar seletores globais para atingir detalhes internos de outras features.
- Migrar o consumidor e remover regras substituídas no mesmo recorte; sem classes antigas escondidas ou camadas `v5/v6`.
- `!important` exige motivo localizado; meta é eliminar a dependência de overrides sucessivos, não apenas trocar prefixos.
- Manter um catálogo visual de componentes e estados. Uma rota interna de demonstração pode bastar inicialmente; Storybook não é pré-requisito.

## Critério de consolidação

DS só está implementado quando componentes têm consumidores reais em Cliente/Admin, estados e contratos documentados, sem variantes duplicadas por módulo. Conferir 1440/1280/1024/390 px, teclado, foco, contraste real, overflow, zoom e movimento reduzido. Esta análise não executou esse QA.
