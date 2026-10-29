# Acesso, contas e propostas

Fichas FLOW-01/02/03. Estado: observado estaticamente com divergências registradas. Validação/estados comuns: [contrato comum](README.md). Permissões: [matriz](../PERMISSIONS.md).

## Alvo V2 confirmado em 26/10/2026

Referência: [publicação 83](../BASELINE_REFERENCE_2026-10-26.md), [regras de produto](../PRODUCT_RULES.md) e [informação sobre dados no acesso](../DATA_PRIVACY.md). Textos de uso/privacidade devem estar consultáveis; registrar versão/confirmação conforme DEC-08, sem inventar prazo de guarda ou declarar gate já implementado.

- **DEC-05:** até quatro acessos Cliente equivalentes por empresa, sem cadastro principal como hierarquia de acesso. Todos podem manter Equipe; revogar um não exige substituir principal nem deve retirar direitos dos demais.
- **DEC-08:** adesão registrada antes do convite; termos obrigatórios no primeiro acesso e em nova versão. Falha ao comprovar aceite bloqueia a entrada e oferece recuperação/retry; não repetir o fail-open observado no oficial.
- Contato comercial e papel/permissão de login são conceitos distintos. Dependências legadas de `is_primary` precisam ser inventariadas, sem remover campos ou alterar contratos agora.

As tabelas abaixo continuam descrevendo fontes oficiais, inclusive a guarda antiga de principal. O alvo é o contrato de construção futuro, não mudança aplicada ao backend.

## Contratos mínimos reconciliados — 28/10

[Contratos de acesso/empresas](../contracts/ACCESS_COMPANIES.md) detalham payloads, projeções, códigos de erro, fontes e lacunas por operação. Schemas de fronteira existem, sem service/Auth conectado. DEC-21 fecha MFA obrigatório Admin, incluindo primeiro uso e bloqueio em falha; tabelas de evidência abaixo preservam as exceções observadas no oficial. DEC-22/25 definem laboratório executado e prova do recorte de adesão em 29/10. Não considerar contratos totalmente fechados: corpo de create_client_account, DDL de códigos, termos/sessão e predicados dos demais domínios ainda exigem implementação/reconciliação.

## Persistência local verificada — 29/10

No laboratório, Admin ativo com AAL2 e fator TOTP verificado registra adesão por RPC; empresa/referência vêm da request, autoria/instante do servidor. Referência vazia, autoria extra, escrita direta, Cliente A/B, Admin inativo/sem MFA e fator removido são negados; histórico não pode ser reescrito/apagado. [Contrato e limites](../contracts/ACCESS_COMPANIES.md#persistência-local-de-adesão--2910). Frontend permanece desconectado; convite, comprovação documental, aceite individual e sessão completa continuam pendentes. Tabelas abaixo preservam a evidência histórica do oficial.

## Códigos/termos e estado no servidor — 29/10

Edge local e banco implementam código/limites/consumo, troca por sessão Auth, versões/aceites e revogação; [contrato detalhado](../contracts/ACCESS_COMPANIES.md#códigos-termos-e-guarda-de-sessão--2910). Sessão e guardas do frontend estão preparadas por injeção; adapter/eventos/telas reais ainda pendentes. Textos de teste são sintéticos e não aprovam conteúdo jurídico. A referência histórica abaixo não descreve o runtime novo.

## FLOW-01 — Convite, código, sessão, MFA e aceite

**Objetivo/atores:** pessoa autorizada acessa o workspace adequado como Cliente ou Admin. Empresa e papel vêm do perfil; não da seleção demonstrativa da V2. Adesão comercial e aceite de uso são eventos diferentes.

**Fontes:** [login EDGE](SOURCES.md#login), [sessão](SOURCES.md#auth), [troca do token](SOURCES.md#supabase), [guardas](SOURCES.md#route-guard), [MFA SQL](SOURCES.md#mfa), [predicado Admin posterior](SOURCES.md#admin-predicate), [MFA UI](SOURCES.md#mfa-ui), [termos UI](SOURCES.md#terms), [versão legal](SOURCES.md#legal), [RLS de aceite](SOURCES.md#terms-sql), [bloqueio de conta](SOURCES.md#access-close).

**Entrada/dados/composição:** `/login`, e-mail e código de seis dígitos; callback de autenticação; fluxo Admin de autenticador; conteúdo legal versionado e checkbox para Cliente. Sem cadastro de senha neste caminho. EDGE procura perfil/convite ativo e pode provisionar usuário/perfil. Criação/reativação deve ser lida junto dos triggers de conta encerrada.

| Anterior | Ação e ator | Guarda localizada | Seguinte/efeito observado |
| --- | --- | --- | --- |
| Sem código | Solicitar, Cliente/Admin | E-mail elegível; uma solicitação em dois minutos | Código com validade de dez minutos; solicita envio externo; e-mail não localizado não deve ser revelado |
| Código pendente | Verificar | Seis dígitos, não usado, não expirado, menos de cinco tentativas | Incrementa tentativa; se correto marca usado e gera token hash de magic link |
| Token recebido | Cliente do app verifica token | Resultado de `verifyOtp` | Sessão Supabase; carregamento de `profiles.role/active` |
| Perfil ausente/inativo | Entrar em rota protegida | Guarda UI exige usuário, papel e ativo | Redireciona para login; papel diferente redireciona para sua home |
| Admin autenticado | Cadastrar/verificar MFA | UI consulta fatores/nível; SQL exige AAL2 se já há fator verificado | Acesso administrativo conforme predicado; UI possui caminhos de erro que deixam seguir |
| Cliente sem aceite corrente | Aceitar | Versão `2026-10-15`, canal legal preenchido, fora de QA; checkbox antes de gravar | Insere `terms_acceptances`; libera UI após confirmação |
| Cliente ao consultar aceite | Consulta falha | `found.error` no TermsGate | UI libera acesso; não há comprovação de bloqueio jurídico no backend |
| Sessão ativa | Sair | Ação explícita | `signOut` e login; estratégia de cache da V2 ainda não implementada |

**Continuidade/falhas:** retorno por papel; não documentado um retorno universal ao destino anterior ao login. Verificação de código tem resultado explícito; envio de boas-vindas pode falhar sem impedir entrada. Marcar convite como aceito nessa função não demonstra leitura/aceite jurídico nem entrega do e-mail. Não repetir automaticamente verificação já consumida.

**Aceite proposto:** testar código incorreto/expirado/usado/limite; perfil inativo; empresa bloqueada; acesso direto cruzado Cliente/Admin; AAL1/AAL2; erro de consulta de termo; sair sem dados remanescentes. Testes reais dependem de ambiente isolado.

**Dúvidas:** `REF-01` (MFA e identidade administrativa não uniformes), `REF-02` (gate jurídico fail-open e adesão), `REF-03` (reativação/convites). Não transformar fallback encontrado em padrão desejado da V2.

## FLOW-02 — Conta, contrato, acessos e ciclo de vida

**Estado V2 em 27/10:** `/admin/clientes` consulta três empresas e acessos sintéticos por módulo/hook, com filtros e seleção na URL. Quatro acessos equivalentes aparecem na fixture inicial, sem conta principal. Isso prepara a interface/contrato local; não implementa cadastro, adesão, convite, revogação, autenticação, persistência ou limites no servidor. Demais transições abaixo descrevem referência/alvo a portar, não comportamento já entregue. Ver [arquitetura](../ARCHITECTURE.md) e [runbook](../RUNBOOK.md).

**Objetivo/atores:** Admin cadastra/manutenção de conta e configura contrato/acessos; Cliente consulta contexto autorizado. Rotas `/admin/clientes` e páginas cliente relacionadas. Fontes: [cadastro UI](SOURCES.md#accounts), [contato principal](SOURCES.md#contact), [limite/status](SOURCES.md#access-limit), [triggers de encerramento](SOURCES.md#access-close), [definição ausente](SOURCES.md#account-missing), [schema/RLS](SOURCES.md#schema), [frentes](SOURCES.md#fronts).

**Entrada/dados/composição:** Admin usa etapas Dados, Decisores/acessos, Contrato, Financeiro e Documentos; manutenção inclui Operação, Frentes, Agenda, Comunicações e Histórico. Campos incluem empresa/contato/e-mail, plano/capacidade, vigência, condições comerciais, documentos, acesso e automações. Valores de fixtures não são contrato. Perfil cliente não recebe escrita genérica em `companies`, `profiles` ou `client_invites` pelas policies iniciais.

| Anterior | Ação Admin | Guarda/evidência | Seguinte/efeitos |
| --- | --- | --- | --- |
| Não cadastrada | Criar | UI valida e chama `create_client_account` | Atualiza empresa como `active`, contato, acessos e arquivos em chamadas posteriores |
| Conta existente | Editar | RLS Admin; contato principal por RPC | Atualiza cadastro/contrato; upload, convites e histórico são operações separadas |
| Acesso adicional | Habilitar/desabilitar | `platform_access`, `active`; limite SQL de quatro convites ativos por empresa | Upsert de convite; revogação tenta desativar perfil correspondente |
| Estado atual | Pausar | Ação UI e motivo | `paused`; app mantém perfis ativos e documenta consulta permitida |
| Estado atual | Bloquear | Ação UI/motivo | `blocked`; trigger desativa perfis cliente |
| Estado atual | Encerrar | Data/motivo e projeção UI | `closed`, `closed_at`, dados de encerramento; trigger desativa perfis; pode enfileirar comunicação |
| Estado atual | Arquivar | Ação UI | `archived`; trigger desativa perfis; não significa eliminação de dados |
| Estado não ativo | Reativar | Ação UI | `active`; app tenta reativar perfis cliente da empresa |

Fonte exibe essas ações, mas não estabelece uma máquina SQL restrita de todos os estados de origem. Não inventar transições proibidas. Status de empresa, vigência contratual, acesso e eliminação são dimensões distintas.

**Continuidade/falhas:** lista com busca/filtro; ficha por abas e modal de confirmação de ciclo de vida. Cancelar antes do submit não grava. Criação/edição faz múltiplas chamadas; falha intermediária pode deixar gravação parcial. UI reativa perfis em lote: não inferir que preserva revogações individuais. Corpo de `create_client_account` não está versionado, apenas comentário de correção posterior.

**Aceite proposto:** limite de acessos, alteração de contato sem trocar empresa, pausa distinta de bloqueio, sessão existente após encerramento, erro após criar conta antes de anexar contrato, reativação sem conceder acesso indevido. Eliminação/exportação: FLOW-18.

**Dúvidas:** `REF-03`, `REF-04` (corpos ausentes), `REF-05` (atomicidade/reativação), `OPEN-02` (adesão comercial). A migration de quatro acessos contrasta com PRODUCT_RULES antigo de acesso principal único; só `is_primary` recebe certas escritas de Equipe.

## FLOW-03 — Proposta comercial e oportunidade

**Objetivo/atores:** Admin trata oportunidade, calcula/edita proposta, revisa e envia. Destinatário comercial não é automaticamente usuário Cliente. Fontes: [tipos/transporte Portal](SOURCES.md#portal), [editor](SOURCES.md#proposal-ui), [rotas](SOURCES.md#routes).

**Entrada/dados/composição:** `/admin/propostas`, editor por `submissionId` e preview por `proposalId`; dados de briefing, pacote, preço/base, extras, desconto, vigência/validade, escopo, condição e destinatário. Origem `public.cali_submissions/cali_proposals/cali_pricing_rules/cali_activity`, distinta de `cali_workspace`.

| Anterior | Ação | Guarda/camada | Seguinte ou limite de comprovação |
| --- | --- | --- | --- |
| Briefing recebido | Analisar/editar Admin | UI protegida, transporte exige sessão | Oportunidade tem enum `novo/analise/edicao/aprovada/enviada/negociacao/fechada/recusada/expirada` |
| Nova proposta | Salvar Admin | Payload tipado no cliente | `rascunho`, com versão; POST/PATCH no schema `public` |
| Rascunho | Aprovar/revisar Admin | Guarda do editor | Estado de proposta `aprovada`; não confundir com aceite comercial externo |
| Aprovada | Enviar Admin | Chama `portal-send-proposal` com PDF/destinatário | Tipos contemplam `enviada`; implementação da Edge Function não localizada neste repo |
| Enviada | Aceitar/recusar/expirar | Enum contém `aceita/recusada/expirada` | Caminho efetivo, ator e guardas desse aceite não comprovados na fonte coletada |

Enums de status não constituem uma máquina de transição autorizada. Não afirmar que qualquer proposta pode mudar para qualquer estado nem que seu envio cria conta/contrato.

**Continuidade/falhas:** editor/preview e seleção de oportunidade; contratos de retorno e rascunho devem ser preservados no recorte da V2. Erro HTTP aparece no transporte. Atomicidade de PDF, status, atividade e envio não comprovada; idempotência de envio desconhecida.

**Aceite proposto:** manter valor/versão já aceita; separar aprovação interna e aceite do destinatário; validar cálculo e mudança de versão; impedir envio duplicado; testar acesso Cliente negado à gestão Admin. Estes testes não foram executados.

**Dúvidas:** `REF-06` (Portal sem políticas/servidor no repositório). Não reconstruir permissões/calculadora a partir somente dos tipos TypeScript.
