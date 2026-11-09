# Homologação funcional com Patrícia

Patrícia participa do aceite final, após a conclusão de todo o escopo combinado da V2, a validação interna e a preparação do ambiente de homologação. Até lá, este roteiro é material de preparação. A versão atual usa telas simplificadas para os testes internos.

Na rodada final, usar empresas e dados de teste no CALI MAPA. Felipe prepara o ambiente, acompanha a rodada e registra o aceite por tarefa. Completar a lista abaixo com os módulos que ainda estão em implementação antes de compartilhar o acesso.

## Preparar antes de enviar o acesso

| Item | Ação de Felipe ou da equipe técnica |
| --- | --- |
| Link da V2 | Definir a URL de homologação. Hoje Equipe, dados mensais, DISC e as consultas piloto da fase 4 dependem do modo de desenvolvimento, e o acesso A/B, arquivos privados e DISC aceitam origens locais específicas. Para Patrícia testar do próprio computador via link, preparar um preview protegido, adaptar os gates ao domínio de teste, configurar origens e callbacks e trocar os links locais nos e-mails. Conferir login, link de convite e PDF nessa URL antes do envio. |
| Banco e acesso | Apontar o frontend para o CALI MAPA em modo Supabase, com URL e chave pública. Conferir serviços de login, arquivos e DISC já instalados, Auth, aceite vigente e documentos sintéticos. Preparar a conta Admin de Patrícia com MFA e os vínculos Cliente A/B com endereços de teste aprovados. Conferir revogação ou suspensão anterior antes de reautorizar um vínculo. |
| Homologação acompanhada no ambiente local | Servir a V2 em `127.0.0.1:5173` para Admin e em `127.0.0.1:5181` e `127.0.0.1:5182` para os Clientes A/B, com `VITE_CALI_PILOT_ACCESS=true` nas duas instâncias Cliente. Esses endereços abrem na máquina que executa os servidores. |
| E-mails de acesso e DISC | Conferir remetente, provedor e destinatários permitidos antes de solicitar códigos ou processar campanhas sintéticas. Patrícia recebe os próprios códigos pelo canal autorizado. Combinar com ela os destinatários de cada teste. |
| Provisionamento de novos Clientes | Ligar somente se o roteiro incluir convite para uma conta nova. Requer destinatário aprovado, `CALI_PILOT_PROVISIONING=true` na Edge e `VITE_CALI_PILOT_PROVISIONING=true` na ficha Admin de desenvolvimento. Ao terminar, suspender provisionamento e revogar o vínculo temporário conforme o runbook. |
| Cron DISC | Manter desligado para o roteiro padrão. Para conferir e-mails do DISC, usar o processamento manual do Admin com campanhas sintéticas. Se a rodada incluir cadência automática, combinar a janela, revisar fila e os dois destinatários, conferir worker, Vault e hash do JWT, ligar somente para esse teste e aplicar o desligamento ao encerrar. |

[Operação de acesso e automações](RUNBOOK.md) · [Contrato DISC](contracts/DISC_3.md)

## Roteiro da Patrícia

1. **Admin.** Entrar com MFA, abrir Empresas e acessos e conferir cadastro, ficha, comprovação e gestão de convites na empresa de teste.
2. **Clientes A/B.** Entrar em sessões separadas, ler o aceite e conferir se cada conta vê somente sua empresa, seus documentos e sua equipe. Validar a revogação com um vínculo temporário se estiver previsto no roteiro.
3. **Equipe e dados mensais.** Cadastrar ou editar um registro fictício, lançar um mês pelo Cliente, revisar e confirmar como Admin. Conferir persistência após recarga, indicadores e retirada da pendência.
4. **DISC.** Responder um convite sintético, conferir o PDF do respondente, revisar o avaliador interno como Admin e aprovar ou retirar um relatório de gestão. Confirmar que o Cliente enxerga somente a gestão liberada para a própria empresa.
5. **Operação.** Percorrer os fluxos da tabela abaixo com as contas de teste preparadas. Executar os itens pendentes internamente antes de incluí-los no aceite com Patrícia.
6. **Aceite.** Para cada problema, registrar papel, tela, ação, resultado esperado e observado. Registrar em separado os ajustes de layout em relação à main da V2 e ao domínio publicado, com a fonte de cada evidência.

Encerrar verificando cron DISC desligado e ausente, fila conferida e provisionamento temporário desligado, caso usado. Guardar a versão testada e os resultados no PR de acompanhamento.

## Roteiro de regressão interna da fase 4

Cada percurso usa a empresa A como fixture e B como controle de isolamento. Registrar a revisão do código, o ambiente, o papel, o resultado e o estado final da fixture. A prova do piloto orienta a regressão e a preparação do aceite final.

| Percurso | Conferir na próxima rodada completa | Prova disponível |
| --- | --- | --- |
| Projetos e arquivos | Compartilhar cronograma, solicitar ajuste, aprovar, concluir revisão de entregável e conferir o corte de acesso após retirada | [Projetos](contracts/PHASE_4_READ.md#lote-de-projetos-e-entregáveis-no-cali-mapa) e [biblioteca de PDFs](contracts/PHASE_4_READ.md#lote-da-biblioteca-de-pdfs-no-cali-mapa) |
| Horas e Agenda | Lançar horas internas e visíveis em contexto, retomar timer e conferir mês fechado. Solicitar e remarcar encontro ordinário. Registrar o resultado de participantes e extras nos fluxos aplicáveis | [Horas vinculadas](contracts/PHASE_4_READ.md#horas-vinculadas-a-entregável-e-subtarefa) e [agenda ordinária](contracts/PHASE_4_READ.md#lote-de-agenda-ordinária-no-cali-mapa) |
| Ocorrências e avisos | Anexar PDF, revisar ocorrência, confirmar ciência e testar comentário em aviso dirigido. Conferir leitura após recarga e retirada | [Anexos de ocorrências](contracts/PHASE_4_READ.md#anexos-pdf-de-ocorrências-no-cali-mapa) e [interações de avisos](contracts/PHASE_4_READ.md#interações-de-avisos-no-cali-mapa) |
| Relatórios | Aprovar, conferir tela e PDF, republicar com a regra de ciência escolhida e confirmar o corte de download | [Republicação com curadoria](contracts/PHASE_4_READ.md#republicação-com-curadoria-no-cali-mapa) |
| Comercial e administração | Conferir rascunho de Forms, triagem, vínculo de frente e pedido de privacidade. Conferir edição e aprovação interna de Propostas com delegação sintética temporária na V2 | [Forms](contracts/PHASE_4_READ.md#lote-de-homologação-de-forms-no-cali-mapa), [Frentes](contracts/PHASE_4_READ.md#gestão-administrativa-de-frentes-no-cali-mapa) e [prova de Propostas](contracts/PHASE_4_READ.md#delegação-temporária-de-propostas-no-staging) |

Na revisão do aceite visual, conferir navegação por teclado, foco, estados vazios, erros, leitura em tela estreita e os percursos acima na publicação de referência. O [roadmap](ROADMAP.md#fechamento-da-fase-4-no-piloto) registra operações que ainda exigem implementação, prova hospedada ou autorização específica.

## Fase 6 — regressão interna

Primeira rodada no navegador integrado, com sessões existentes e empresas sintéticas no CALI MAPA:

| Percurso | Resultado |
| --- | --- |
| Admin: Projetos A → B → voltar | B deixou de mostrar o detalhe de A. Voltar pelo navegador recuperou a empresa e o projeto de A. |
| Admin: Projetos → Horas → Documentos → Relatórios | A seleção da empresa se manteve. O ID de projeto ficou na tela de origem. A navegação por teclado levou o foco ao título do novo módulo, sem manter o detalhe anterior. |
| Cliente A/B: Minha empresa → Projetos | A viu o projeto da própria empresa; B ficou com lista vazia. O link direto do projeto de A abriu “Projeto indisponível” em B, mesmo com a empresa A na URL. |

A rodada foi de leitura: não alterou dados, não enviou e-mails e não reativou a conta Partner descartável. Os três servidores locais foram desligados ao final. A reversão do ajuste de navegação é de código; não há migração de banco associada.

### Regressão de leitura dos módulos operacionais

Sessões Admin e Cliente A/B existentes no CALI MAPA. A interface local foi configurada para consultar também os catálogos de revisões e as conversas.

| Fluxo | Resultado no navegador |
| --- | --- |
| FLOW-07 e FLOW-09 · Horas e Agenda | Admin viu franquia de 12 h 30 min, consumo de 27 min e saldo de 12 h 3 min em A. Novembro estava oculto aos Clientes, conforme a configuração do piloto. A viu quatro reuniões próprias, B viu a agenda vazia e o evento cancelado apareceu somente no Admin. |
| FLOW-10 · Ocorrências | Admin e A viram “Aguardando Cliente” na lista. A abriu a conversa de teste. B recebeu “Ocorrência indisponível” ao usar o mesmo link. |
| FLOW-11 · Documentos | Admin viu as revisões 1 e 2 do documento sintético e baixou a revisão 2 como PDF. O documento retirado não apareceu nas bibliotecas de A/B. |
| FLOW-12 · Relatórios | Admin viu o relatório sintético de outubro em rascunho. A/B não viram relatório liberado. A comparação positiva entre tela e PDF segue na [prova da revisão publicada](contracts/PHASE_4_READ.md#fechamento-de-relatórios-no-piloto). |
| FLOW-13 · Avisos | A e B viram a publicação geral. Os avisos sintéticos arquivados de A apareceram somente no Admin. |
| FLOW-16 e FLOW-17 · Forms e Auditoria | Admin viu formulários sintéticos e eventos de Forms em A. Em B, a auditoria ficou vazia. Abrir a rota de Auditoria como Cliente B redirecionou para a área Cliente. |

A rodada conferiu leitura, navegação, permissão e download de arquivo sintético. Os servidores locais foram desligados. As transições de escrita e os PDFs publicados permanecem nas provas dos respectivos pilotos. O ajuste de rótulos de ocorrência é reversível no frontend.

### Cruzamento das provas dos pilotos

As provas de escrita e corte abaixo foram registradas nos pilotos. A fase 6 cruzou esses resultados com a regressão de leitura e manteve separados os casos comprovados no navegador, em SQL e com fixtures.

| Fluxos | Prova aplicável | Limite |
| --- | --- | --- |
| FLOW-01 e FLOW-02 · Acesso e conta | Admin e Clientes A/B no piloto 2A. Convite, aceite, limite de quatro acessos e corte individual, com A e B separados. Partner homologou código recebido, TOTP, aceite e corte na mesma sessão. [Acesso](contracts/ACCESS_COMPANIES.md#convite-limite-de-vagas-e-revogação-em-ambiente-isolado) · [Partner](contracts/PARTNER_5.md#otp-por-e-mail-e-limpeza) | Canal temporário do Partner retirado. Infraestrutura de acesso de rollout em aberto. |
| FLOW-03 · Propostas | Admin e destinatário de teste concluíram o percurso de rascunho, aprovação, envio e aceite no staging. [Prova](contracts/PHASE_4_READ.md#criação-envio-no-workspace-e-aceite-no-staging) | Entrega externa real fica no rollout. |
| FLOW-04 e FLOW-14 · Início, atalhos e avisos operacionais | Navegação, contexto e foco conferidos na fase 6. O resumo Admin teve prévia no CALI MAPA e envio a um simulador. [Resumo](contracts/PHASE_4_READ.md#envio-sintético-do-resumo-admin-pelo-resend) | Cobertura integral da visão inicial, da busca e das notificações não foi comprovada. Resumo Partner depende da DEC-19. |
| FLOW-05 e FLOW-06 · Projetos e entregáveis | Admin e Cliente A passaram por ajuste, aprovação, revisão e PDF; B foi recusado. Partner solicitou revisão no recorte inscrito. Admin aprovou o envio à validação do Cliente no navegador. [Projetos](contracts/PHASE_4_READ.md#fechamento-de-projetos-no-piloto) · [Decisão Admin](contracts/PARTNER_5.md#revisão-de-entregável-e-encerramento-de-ocorrência) | Acervo legado fica no rollout. A prova Partner combina SQL e navegação por etapas. |
| FLOW-07 e FLOW-09 · Horas e Agenda | Admin e Cliente homologaram extrato, timer e agenda; realização de visita e comprovantes passaram no staging. Partner operou timer e consultou os catálogos no navegador; fila manual teve recusa Admin na interface e aprovação em prova com rollback. [Timer](contracts/PHASE_4_READ.md#lote-de-lançamento-e-timer-no-cali-mapa) · [Agenda](contracts/PHASE_4_READ.md#conclusão-da-visita-extra-e-comprovantes-no-cali-mapa) · [Horas Partner](contracts/PARTNER_5.md#horas-manuais-e-decisão-admin) | Agenda Partner é de leitura. Google/Meet segue para o rollout. |
| FLOW-08 · Equipe e dados mensais | Admin e Clientes A/B passaram pela leitura isolada e pelos fluxos de Equipe e dados mensais. Partner lê somente a projeção de nome, cargo e área. [Equipe](contracts/TEAM_2B.md#entregue-e-homologado-no-piloto) · [Dados mensais](contracts/TEAM_MONTHLY_2C.md#evidência-de-05112026) · [Catálogos Partner](contracts/PARTNER_5.md#catálogos-adicionais) | Permissões de edição de Admin e Cliente não se estendem ao Partner. |
| FLOW-10 e FLOW-13 · Ocorrências e Avisos | A recebeu arquivos, B foi recusado e a retirada cortou a leitura. Aviso dirigido teve ciência e interação no piloto. Partner respondeu na conversa, com corte de sessão, e Admin aprovou e devolveu pedidos fictícios de encerramento. [Anexos](contracts/PHASE_4_READ.md#fechamento-de-interações-no-piloto) · [Avisos](contracts/PHASE_4_READ.md#interações-de-avisos-no-cali-mapa) · [Resposta Partner](contracts/PARTNER_5.md#resposta-em-ocorrência) | Anexos e notas internas estão fora do recorte Partner. |
| FLOW-11 e FLOW-12 · Documentos e Relatórios | Admin publicou e retirou revisões; A baixou a vigente, B ficou fora. Partner baixou relatório fictício no Chrome e teve o PDF de documento avulso validado em SQL, incluindo recusa da versão antiga. [Biblioteca](contracts/PHASE_4_READ.md#lote-da-biblioteca-de-pdfs-no-cali-mapa) · [Relatório](contracts/PHASE_4_READ.md#fechamento-de-relatórios-no-piloto) · [PDF Partner](contracts/PARTNER_5.md#pdf-de-relatório-liberado) · [Documento Partner](contracts/PARTNER_5.md#documento-avulso-publicado) | A regressão recente encontrou o relatório retirado; tela e PDF publicados seguem na prova 4D. |
| FLOW-15 e FLOW-16 · Partner, Auditoria e Satisfação | Partner admitido apenas para empresas e módulos atribuídos. Admin reviu a fila com MFA e conferiu Auditoria por empresa. Cliente B foi redirecionado ao tentar abrir Auditoria. [Escopo Partner](contracts/PARTNER_5.md#isolamento-no-cali-mapa) · [Auditoria](contracts/PHASE_4_READ.md#lote-de-auditoria-de-formulários) · [Satisfação](contracts/PHASE_4_READ.md#acompanhamento-admin-de-satisfação) | Painel agregado de satisfação e outras fontes exigem evidência própria. |
| FLOW-17 e FLOW-18 · DISC, Forms, Mapa, frentes e privacidade | DISC por público, Forms sintético, triagem e devolutiva de teste, frentes, pedido e exportação têm provas por operação. [DISC](contracts/DISC_3.md#validação-e-limites) · [Forms](contracts/PHASE_4_READ.md#caminhos-condicionais-e-pdf-de-resposta-em-forms) · [Mapa](contracts/PHASE_4_READ.md#jornada-e-relatório-detalhado-do-mapa) · [Frentes](contracts/PHASE_4_READ.md#frentes-contratadas-e-ajuda-no-cali-mapa) · [Privacidade](contracts/PHASE_4_READ.md#exportação-estruturada-e-prévia-de-eliminação) | Coletas e envios reais, acervo Forms e execução da eliminação ficam no preparo do rollout. |

### Revisão visual contra a publicação 83

Registro histórico. A [revisão contra a main da V2](#revisão-visual-contra-a-main-da-v2) substitui esta referência para o aceite visual.

Comparação no navegador integrado a **1440 × 900** e **390 × 844**. A [publicação 83](BASELINE_REFERENCE_2026-10-26.md) foi servida localmente no SHA fixado, com fixtures do repositório e API de teste somente leitura. V2 Admin e Cliente usaram o CALI MAPA. V2 Partner usou uma fixture local com a interface real, pois a identidade de homologação foi removida após a fase 5. Capturas guardadas como evidência local.

| Tela | Diferença observada | Critério para fechar |
| --- | --- | --- |
| Projetos Admin | A 83 usa menu lateral no desktop e navegação recolhida no celular. A V2 empilha os links no topo; a 390 px, o título passou de 109 para 324 px. O cronograma está disponível na V2; hierarquia, tipografia e destaque do contexto do projeto divergem da referência. | Preservar contexto da empresa e do projeto em cabeçalho compacto. Validar navegação, ações e cronograma no primeiro trecho útil da tela. |
| Projetos Cliente | Ambas abrem o cronograma com prazos, mas a navegação da V2 leva o título de 114 a 289 px em 390 px. A tela conectada da V2 usa Times no título observado no Admin, e as capturas exibem o mesmo padrão serifado em Cliente e Partner. | Reaplicar a tipografia do DS e manter o projeto, as abas e a próxima ação visíveis em largura estreita. |
| Relatórios Cliente | A 83 mostrou o convite editorial para uma publicação sintética. A V2 mostrou o vazio esperado após a retirada no staging. O cabeçalho repetiu a diferença de navegação mobile. | Conferir leitura publicada e arquivo em estados equivalentes, com os dados da mesma revisão e o PDF do piloto 4D. |
| Projetos Partner | A 83 abre o módulo no shell próprio, com cronograma e contexto da carteira. A V2 abre módulos atribuídos em botões e uma lista de projetos. As duas capturas couberam em 390 px. | Reconciliar a hierarquia visual e as entradas de projeto preservando somente as operações autorizadas na fase 5. |
| Teclado | Ativar “Ir ao conteúdo” alterava o hash e mantinha o foco no corpo. O ajuste tornou o alvo focável; a repetição levou o foco ao conteúdo principal. Navegar a Horas por teclado manteve o foco no novo título. | Manter essa prova ao ajustar o shell. As telas amostradas couberam em 390 px; diálogos, contraste e demais percursos ainda pedem cobertura. |

### Navegação compartilhada e leitura publicada

- Admin, Cliente e Partner usam a mesma estrutura de navegação. Acima de 1000 px, a lista de módulos fica na lateral com o item atual destacado. Até 1000 px, abre pelo botão Menu principal. A lateral usa rótulos para manter os módulos identificáveis e a marca usa a folha da publicação 83. Inter é servido com o frontend.
- Em 1440 e 390 px, Projetos Admin e Cliente A abriram com as sessões do CALI MAPA. Em 390 px, o título apareceu a 77 px do topo nos dois papéis, antes a 324 e 289 px. O documento coube na largura observada. Escape fechou o menu e devolveu o foco ao botão. Em Admin, a navegação por teclado para Horas preservou a empresa, fechou o menu e focou o título. No Cliente, a mesma navegação abriu Relatórios. O atalho ao conteúdo levou o foco ao elemento principal.
- Partner foi conferido com fixture local da interface real em 390 px. Projetos e Ocorrências apareceram entre os módulos atribuídos, a troca fechou o menu e focou o título de Ocorrências. As provas de autorização da fase 5 continuam vinculadas na matriz acima.
- Relatórios Cliente foi comparado com a leitura publicada da 83 e uma publicação sintética na V2. A V2 manteve versão, protocolo e data ao lado do artigo em 1440 px e abaixo em 390 px. A ida ao arquivo e a reabertura da leitura passaram. A 83 apresenta o documento com capa e composição editorial próprias. Essa paridade e a revisão visual das ações com a mesma versão do PDF continuam abertas. [Prova funcional do PDF e da revisão](contracts/PHASE_4_READ.md#fechamento-de-relatórios-no-piloto).

### Composição de Projetos e Relatórios

- **Projetos, Admin e Cliente.** O detalhe agrupa protocolo, nome, situação, datas e revisão em um cabeçalho bordô. A aba ativa se destaca e o cronograma usa o espaço abaixo do cabeçalho. Novo projeto e Gerenciar projeto abrem os formulários sob demanda. No navegador, Admin e Cliente A abriram o cronograma no CALI MAPA em 1440 e 390 px. A largura do documento acompanhou a janela. Admin abriu e fechou as duas áreas por teclado sem gravar dados.
- **Revisão pendente.** A fixture local apresentou o prazo vencido junto da revisão e manteve Aprovar cronograma e Pedir ajuste disponíveis ao Cliente. A transição em banco permanece coberta pelas provas da [fase 4A](contracts/PHASE_4_READ.md#fechamento-de-projetos-no-piloto).
- **Relatórios Cliente.** A leitura publicada ganhou abertura com marca e período, resumo identificado e contexto da revisão. Uma fixture local mostrou a revisão 2 e o protocolo CALI-EXEC-2026-000002 em 1440 e 390 px. O navegador baixou o PDF com os mesmos bytes da fixture, registrou ciência na revisão 2 e reabriu o relatório pelo arquivo. A prova hospedada do PDF e da retirada continua na [fase 4D](contracts/PHASE_4_READ.md#fechamento-de-relatórios-no-piloto).

### Revisão visual contra a main da V2

Em 09/11/2026, Felipe definiu a `main` da V2 como base visual do PR #2 e indicou [app.calirh.com](https://app.calirh.com/) para conferir o que está publicado.

- **Código da V2.** A `main` do GitHub foi verificada no [commit c9baea7](https://github.com/patricia258/cali-workspace-v2/commit/c9baea7903a9bbd26d1f89321c789e60e1a542d3). O build da árvore foi servido em loopback. É uma demonstração com interfaces Cliente e Admin. O GitHub da V2 não retornou registros de deploy.
- **Domínio publicado.** A sessão Admin existente permitiu leitura. O HTML carregou `/assets/index-D3-QXOYI.js` e `/report-print-ready-v64.js`. O blob do segundo arquivo servido é `74da2232b7613fbc8d5cded6adc2bc04900fb422`, idêntico ao [arquivo em app.cali@773c9d4](https://github.com/patricia258/app.cali/blob/773c9d4256df40a302e34a83ad756eb1eead2cf9/public/report-print-ready-v64.js) e ausente da árvore de `c9baea7`. O GitHub registrava `7615653486` como deploy de produção de `app.cali` nesse SHA. A Visão geral publicada também difere da prévia Admin local. A ligação exata do projeto e do alias no painel Vercel exige acesso à conta. A publicação 83 segue como histórico funcional.
- **PR #2.** Rotas reais Cliente de Projetos e Relatórios renderizadas em navegador com serviços sintéticos locais. A prévia demonstrativa já reutilizava os componentes principais da main. As correções foram na composição conectada.

| Recorte | Comparação e resultado | Limite |
| --- | --- | --- |
| Navegação e cabeçalho | A main da V2 e o Admin publicado usam lateral compacta com ícones. O PR conectado usava lateral textual de 208 px. A lateral passou a 56 px com ícones, nomes acessíveis e expansão dos rótulos. Cabeçalho segue título em grafite e ponto dourado. O ajuste é compartilhado por Admin, Cliente e Partner. | Mantém as entradas de cada papel. Visão geral, busca, atalhos e notificações da publicação ainda exigem comparação de percurso e contrato. |
| Projetos | Na main da V2, abas sublinhadas acima do resumo e painel de leitura branco. O PR tinha botões preenchidos e cabeçalho bordô. A rota passou para abas sublinhadas e resumo branco, preservando datas, situação e revisão vencida. A publicação atual também foi aberta em Projetos Admin. | Cronograma interativo, Kanban, gestão Admin e o histórico seguem com suas provas funcionais. A revisão visual de cada estado e diálogo continua aberta. |
| Relatórios | A main da V2 usa leitura branca e contexto lateral bordô. O PR tinha capa bordô e contexto branco. As superfícies e proporções foram realinhadas. A rota Cliente preserva arquivo, protocolo, versão e ações existentes fora da caixa escura. A publicação atual também foi aberta em Relatórios Admin. | Comparação da composição Cliente com publicação sintética local. PDF e ciência da mesma revisão têm evidência nos lotes anteriores. |
| Demais módulos | Equipe, Horas, Calendário, Ocorrências, Documentos e Avisos foram inventariados na demonstração Cliente da main e abertos no Admin publicado. Contas, Equipe CALI e Auditoria também abriram no Admin publicado. | O inventário identifica equivalências e diferenças de papel. Paridade de estados, diálogos, formulários e módulos sem equivalente na main continua aberta. |
| Partner | A lateral compartilhada recebe o mesmo tratamento com os módulos atribuídos. A árvore da main da V2 não tem o workspace conectado Partner. | Sem comparação de ponta a ponta com Partner publicado nesta rodada. A prova funcional permanece no contrato da fase 5. |

Capturas locais em `cali-main-v2`. Projetos Admin e Cliente e Relatórios Cliente conferidos em 1280 px e 390 px. No desktop a lateral expandiu para 208 px, e Escape recolheu o menu. Em 390 px, abrir o menu e selecionar Projetos fechou a navegação, manteve o foco no título e não causou rolagem horizontal. A inspeção online foi somente leitura. Os servidores temporários foram encerrados. Rollback do lote é de frontend.

### Responsividade e hierarquia em 375 px

Felipe definiu 375 px como largura principal da revisão mobile. A rodada usou 375 × 812 no navegador integrado, com 320 px como checagem adicional e 1280 px como referência desktop. As rotas conectadas usaram serviços sintéticos locais com nomes e títulos longos sem espaços. A demonstração usou os dados do repositório.

| Recorte | Defeito e correção | Evidência |
| --- | --- | --- |
| Demonstração Cliente | Barra superior cortava o perfil e as notificações. O atalho Admin ganhou rótulo compacto. A faixa de contexto de Equipe e os filtros de Ocorrências passaram a quebrar linha. | Nove telas em 375 e 320 px sem rolagem horizontal da página. Notificações abertas em 320 px. |
| Demonstração Admin | A expansão lateral estreitava o conteúdo e cortava ações. O menu expandido passou a sobrepor a página em telas compactas. Projetos e a Visão executiva passaram a quebrar linhas de metadados e ações. O atalho repetido para Cliente foi retirado. | Onze telas em 375 px, incluindo as três abas de Projetos. Abrir o menu manteve a lateral de 60 px e a página em 375 px. |
| Empresas e Equipe conectados | Nomes longos estouravam a página e as ações ficavam na última coluna. A ação agora fica junto ao nome, com rolagem restrita à tabela. Nomes quebram linha também nas fichas. | Abrir Acessos e Ficha pelo botão visível sem rolar horizontalmente. Página dentro de 375 px, com checagens adicionais a 320 e 1280 px. |
| Catálogos e Partner | Títulos longos estouravam Ocorrências, Agenda, Documentos, Avisos, Frentes e a área Partner. Cartões quebram texto e ocupam a largura útil. Contexto Partner, fila e detalhe receberam o mesmo tratamento. | Cinco catálogos e lista Partner em 375 px. Detalhe Partner conferido em 390 px. A largura da página acompanha a janela. |

O Início conectado deixou de anunciar módulos integrados como se estivessem em preparação. A ficha de Empresas mantém as mensagens de disponibilidade nas seções responsáveis. Capturas locais em `cali-fase-6-responsividade`. Validação de interface com dados sintéticos e operações de escrita desativadas. O lote não altera contratos de backend. Rollback de frontend.

A fase 6 permanece aberta para os demais percursos e para o aceite da Patrícia. Acervo legado e Google/Meet ficam para o rollout.

## Mensagem para enviar junto do link

> Patrícia, a V2 está pronta para esta rodada de homologação em ambiente de teste. Vamos conferir acesso, empresas, Equipe, dados mensais e DISC usando os dados de exemplo. Te mando o link e os acessos de teste pelo canal combinado. Para cada ponto que você quiser ajustar, me diga a tela, o que tentou fazer e o que esperava ver.
