# Fichas reconciliadas com a referência oficial

Data: 25/10/2026. Escopo: **Cliente e Admin**, nesta V2, sem implementação. Oficial consultado somente em leitura na revisão `f3d3f14043a6abc38636f0340fe831e621d8b357`. Proveniência e links imutáveis: [Fontes](SOURCES.md).

Referência vigente: funcionamento de 26/10 testado pela Patrícia, [publicação 83](../BASELINE_REFERENCE_2026-10-26.md), identificada pelo mesmo SHA. [Regras de produto](../PRODUCT_RULES.md) e decisões atuais prevalecem sobre hipóteses anteriores; as tabelas de fonte preservam evidência estática.

## Estado e responsabilidade

As fichas estão preenchidas com o comportamento localizado e com lacunas explícitas. Isso encerra a ficha documental deste levantamento, não certifica o contrato de produção nem resolve dúvidas por suposição. Separar:

- **Observado UI/SQL/EDGE:** fonte identificada, sem teste operacional.
- **Divergência:** fontes/camadas não expressam a mesma restrição ou estado.
- **Não comprovado:** corpo da operação, condição ou evidência não localizada.
- **Aceite proposto:** verificação que a futura implementação deve realizar; não teste já executado.

Responsável pelo levantamento: agente Codex. Responsáveis humanos por validação funcional, aprovação de produto, dados e operação ainda não nomeados. Não atribuir aprovação a quem publicou um arquivo.

## Fichas por domínio

| IDs | Fonte canônica da ficha |
| --- | --- |
| FLOW-01, FLOW-02, FLOW-03 | [Acesso, contas e propostas](ACCESS_ACCOUNTS.md) |
| FLOW-04, FLOW-07, FLOW-08, FLOW-14 | [Workspace, Horas, Equipe e perfil](WORKSPACE_HOURS_TEAM.md) |
| FLOW-05, FLOW-06 | [Projetos e entregáveis](PROJECTS.md) |
| FLOW-09 | [Agenda e solicitações](CALENDAR.md) |
| FLOW-10 | [Ocorrências](RECORDS.md) |
| FLOW-11, FLOW-12 | [Documentos e relatórios](DOCUMENTS_REPORTS.md) |
| FLOW-13, FLOW-15, FLOW-16, FLOW-18 | [Avisos, administração e ciclo de dados](ADMIN_LIFECYCLE.md) |
| FLOW-17 | [Mapa, formulários e perfil comportamental](FORMS_PEOPLE_PROFILE.md) |

Permissões por operação: [Matriz Cliente/Admin](../PERMISSIONS.md). Divergências e dúvidas numeradas: [Decisões](../DECISIONS.md).

## Atualização do contrato alvo — 26/10/2026

Decisões iniciais DEC-05 a DEC-12 e revisão DEC-13 a DEC-18 orientam as fichas; **DEC-07 foi substituída por DEC-13**. DISC separa respondente, avaliador interno e gestão. Regras de comunicação/interface e informação sobre dados pessoais foram incorporadas; DEC-19 fecha o resumo Admin em RESUMO-01; Cliente/staff não recebem, conteúdo Partner fica posterior e digest de chat das 08h não retorna. Tabelas de fonte não fingem implementação. Aceites são futuros, por entrega completa conforme o roadmap; nenhuma permissão efetiva foi alterada.

## Contrato comum de contexto e navegação

Estas regras de experiência são propostas da V2, complementando o comportamento observado nas fichas; não atribuí-las automaticamente ao oficial.

1. Preservar caminhos compatíveis e parâmetros identificados em [Arquitetura](../ARCHITECTURE.md). Deep links de objeto devem carregar o objeto autorizado, mesmo sem visita prévia à lista.
2. Admin seleciona empresa; Cliente deriva empresa do vínculo autenticado. Filtro/URL não é autorização. Em troca de contexto, não manter detalhe, resumo ou rascunho de outra empresa como se fossem atuais.
3. Lista, aba e período têm política explícita de retorno. O oficial frequentemente mantém filtros/rascunhos apenas em estado local: ausência de preservação não autoriza inventar persistência no navegador.
4. Fechar antes de confirmar abandona a edição, salvo autosave explicitamente localizado. Após envio, reconciliar resultado real antes de repetir. Idempotência não é presumida.
5. Conteúdo privado, nomes, arquivos e dados de teste não devem ser expostos em screenshots públicos. Fixtures devem reproduzir estados, não pessoas reais.

## Contrato comum de apresentação e estados

Cada ficha herda [UX/UI](../UX_UI.md) e os contratos do [DS](../DESIGN_SYSTEM.md). Anatomia específica aparece na ficha. Campos e rótulos exatos devem ser conferidos na fonte antes de implementar; nenhum formulário recebe campo inexistente apenas porque o template o prevê.

Aceite proposto para todas as fichas: loading localizado; vazio distinto de falta de acesso; erro específico com recuperação; envio pendente sem duplo submit; perda de sessão sem sucesso falso; dados parciais identificados; retorno preservando contexto. Verificar desktop/mobile, foco, teclado, Escape e overflow com dados sintéticos. Comportamento acessível não foi validado por esta leitura.

Não há teste de usabilidade, captura visual autenticada, execução de RPC, prova de RLS ou aprovação funcional nesta etapa. Fontes de apresentação são os TSX/CSS da V2 e consumidores oficiais vinculados. Critérios de aceite são cenários futuros.

## Como resolver pendência

Primeiro localizar fonte adicional versionada ou contrato aprovado. Quando a definição está somente no banco, obter exportação/inspeção autorizada em etapa própria; não conectar produção por consequência deste levantamento. Decisão de negócio continua aberta até haver evidência ou resposta do responsável. Nenhuma dúvida implica mudar silenciosamente backend/payload.
