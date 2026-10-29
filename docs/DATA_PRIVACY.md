# Dados pessoais e informação no acesso

Atualização: 28/10/2026. **Contrato documental a completar e validar conforme o uso real; nenhum dado migrado ou coletado nesta entrega.** Dono de campos/operações: [Dados e contratos](DATA_CONTRACTS.md). Leitores autorizados: [matriz alvo](PERMISSIONS.md). Entrada/aceite: FLOW-01 e DEC-08.

## Escopo confirmado

Documentar por que cada dado é coletado, onde é utilizado, quem o recebe e como é tratado ao longo do ciclo de vida. A informação correspondente deve estar disponível ao usuário no acesso à plataforma, integrada aos textos de uso/privacidade e à validação da versão vigente. Não inventar finalidade, período de guarda ou validação já realizada.

DEC-09 permite que Cliente e Admin informem/consultem os campos privados de Equipe, com Cliente limitado à própria empresa. Isso não torna esses campos públicos nem inclui automaticamente e-mail, PDF, log, notificação ou exportação geral. Cada projeção precisa declarar quais campos recebe.

## Inventário por campo

| Campo/grupo | Acesso alvo conhecido | Registro de finalidade e uso a validar | Guarda e encerramento |
| --- | --- | --- | --- |
| Registro de adesão da empresa (persistência testada somente com dados sintéticos locais) | Admin autorizado na operação; projeção Cliente depende do fluxo aplicável | Vincular empresa à referência de formalização, autor e instante do registro, antes do convite; referência não deve copiar conteúdo pessoal desnecessário. Contrato em [Acesso/empresas](contracts/ACCESS_COMPANIES.md#registro-próprio-de-adesão--dec-23) | Guarda/encerramento ainda a validar; não inventar prazo. Baseline local protege autoria/referência com leitura Admin e histórico append-only; não homologa retenção/eliminação ou documento real |
| Código de acesso/hash, e-mail e tentativas (somente laboratório sintético) | Adapter de serviço; navegador não consulta tabela privada | Autenticar pessoa previamente elegível, limitar solicitações/tentativas e impedir reutilização; código só na captura local, HMAC no banco; sem coleta adicional de IP neste recorte | TTL de dez minutos não é prazo de guarda. Expurgo/retenção de registros ainda a validar; não apagar como efeito do build |
| Versão/conteúdo jurídico e aceite | Conteúdo corrente público; aceite próprio com sessão vigente | Provar versão/digest apresentados, autoria e instante de servidor; conteúdo imutável e nova confirmação a cada versão | Histórico preservado; retenção/eliminação a validar. Textos atuais são sintéticos, não homologação jurídica |
| Identificação e vínculo da pessoa na Equipe | Cliente da própria empresa e Admin conforme operação | Relacionar campos exatos às operações de diretório, movimento e histórico identificadas no contrato | Identificar fonte e período aplicado por campo; não presumir exclusão ao arquivar ficha |
| Remuneração | Cliente da própria empresa e Admin; projeção privada | Identificar consultas/indicadores que realmente usam o valor e validar a descrição de finalidade com a CALI | Prazo e tratamento de versões/histórico ainda não definidos neste levantamento |
| Data de revisão salarial | Mesmo escopo privado | Identificar operação consumidora e texto que explica a coleta, sem ampliar para folha de pagamento | Documentar vínculo ao histórico e regra após desligamento/fim de contrato |
| Gênero | Mesmo escopo privado | Confirmar uso efetivo, necessidade e obrigatoriedade do campo antes de descrever finalidade como aprovada | Não definir prazo por analogia; documentar exclusão/retenção da projeção e derivados |
| Filhos/informações familiares existentes | Mesmo escopo privado | Inventariar campo exato e consumidor real; não ampliar coleta para dados adicionais da família | Definir tratamento do original, histórico, snapshot e exportações aplicáveis |

Os registros ainda não preenchidos são trabalho documental/validação de conteúdo, não autorização para criar campos ou prazos novos. Fontes iniciais: [Equipe](flows/WORKSPACE_HOURS_TEAM.md), [policies privadas](flows/SOURCES.md#team-private), [salvar mês](flows/SOURCES.md#team-save), snapshots e encerramento. A CALI valida finalidade/necessidade e regra de guarda; engenharia identifica os consumidores e efetiva as restrições na implementação autorizada.

## Informação e validação no acesso

- Textos de uso/privacidade acessíveis antes da confirmação e depois consultáveis; finalidade e leitores compatíveis com a coleta realmente implementada.
- Termos obrigatórios no primeiro acesso e a cada versão nova, conforme DEC-08; falha ao comprovar versão/aceite bloqueia entrada e permite tentar novamente.
- Registro da versão apresentada, ator e data de confirmação; alterações de texto seguem versionamento. Não declarar esse registro implementado antes de existir.
- Formulários explicam campos privados e obrigatoriedade conforme contrato; a confirmação no acesso não cria privilégio de acesso nem autoriza qualquer dado futuro por consequência.
- Ações de consulta/correção/exportação e solicitações previstas no perfil apontam para seu contrato e responsável; não confundir solicitar um direito com eliminar imediatamente uma empresa.

## Ciclo de vida e critérios de validação

Antes de migrar/coletar os campos do recorte, registrar suas finalidades, consumidores, responsáveis pela validação, regra de guarda e destinos. Conferir desligamento, arquivamento, encerramento da conta, exportação, eliminação e cópias aplicáveis; histórico não é apagado por mudança visual.

O prazo de 45 dias encontrado no código para elegibilidade de eliminação de empresa é uma regra técnica observada daquele caminho. Não constitui prazo geral de guarda dos campos nem comprovação de adequação dos textos de privacidade.

Aceite futuro: informação apresentada coincide com campo/uso; Cliente A não recebe privados de B; logs/e-mails/arquivos respeitam projeções declaradas; versão/aceite conferidos; política de ciclo de vida testada no ambiente isolado autorizado. A revisão do texto e dos prazos deve ser registrada pelos responsáveis, sem presumir aprovação com base apenas na criação deste documento.
