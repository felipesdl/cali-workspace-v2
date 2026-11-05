# Fase 3 — DISC: respondente, avaliador e gestão

Plano autorizado por Felipe em 05/11/2026 para execução conjunta de 3A, 3B e 3C, com trabalho independente em paralelo. Dono: FLOW-17; referência funcional: publicação 83 (`f3d3f14043a6abc38636f0340fe831e621d8b357`). DEC-13 e NEG-07 a NEG-14 prevalecem sobre as permissões legadas. O recorte sintético está implementado; provas e pendências de ativação estão separadas abaixo.

## Inventário e decisão técnica

O catálogo ativo do CALI MAPA foi lido em 05/11: tabelas `profile_links`, `profile_invites`, `profile_results` e configurações de assinatura; 34 funções relacionadas, nove policies e seis triggers. As funções públicas legadas retornam resultado individual por token, e a referência possui rota Cliente do avaliador: essas superfícies contradizem o público aprovado para a V2. As funções de tally/submissão ativas confirmam `cali-disc-v1.1`, 18 blocos naturais e seis de pressão; não será criado novo método de avaliação.

A implementação usa um domínio privado separado para campanhas sintéticas da V2, com wrappers próprios. Nenhuma resposta nova fica nas tabelas ou tokens legados. Os escritores/leitores antigos permanecem inalterados fora desse domínio. Admin exige sessão MFA e aceite vigentes; Cliente usa a empresa da sessão; público recebe somente contexto do convite e estado da participação. Avaliação técnica e conteúdo de PDF não fazem parte da resposta pública.

## Execução e dependências

1. **Fundação comum:** schema privado, guardas, DTOs por público, revisão/preimagem, identidade de operação, fila de comunicação e rollback. Conferir catálogo antes da aplicação; testar em PostgreSQL descartável por socket Unix. Não iniciar a bateria Auth/Edge/Docker suspensa.
2. **3A:** portar banco de questões da referência, estados do convite e submissão validada; sete dias desde envio, até 23h59 de Brasília; três lembretes conforme cadência existente, pessoa focal na véspera/encerramento; agradecimento apenas; PDF próprio gerado e enviado no servidor, com falha/retry e identidade de envio. Usar somente destinatários de teste autorizados, nunca e-mails versionados.
3. **3B:** consulta e artefato técnico exclusivos de Admin CALI; nenhuma liberação individual Cliente ou token público de resultado. Reutilizar cálculo e narrativa da referência, sem alegação de validade científica.
4. **3C:** gestão com cinco respostas distintas, objetivo e parecer; cinco a 14 somente texto qualitativo, sem contagens/gráficos; 15 ou mais com agregados. Projeção nunca contém nomes de respondentes. Aprovação congela revisão, assinatura/foto/protocolo; mudança retira a liberação e exige nova aprovação, preservando a anterior. Entrega com conta no aplicativo e aviso; sem conta, PDF ao gestor.
5. **Homologação:** A/B/Admin no navegador integrado, fluxo público sintético, limites 4/5/14/15, expiração/recusa/replay, alteração após aprovação, outra empresa e ausência de acesso individual por públicos indevidos. Registrar entrega por lote e atualizar PR #2 sem pausa entre commits.

As três interfaces podem ser preparadas em paralelo após o DTO comum. Operações de aprovação/liberação dependem de resultados, assinatura e projeção definidos; comunicação depende da fila e do artefato. Não ativar cron global ou reusar hook legado que inclua destinatários fora do piloto.

## Dados, canais e limites

Nome/e-mail identificam o convite e a entrega individual; cargo é contexto profissional opcional; respostas/resultados são dados restritos de perfil comportamental. A campanha e o relatório de gestão não concedem acesso ao workspace. Somente atores/dados sintéticos nesta entrega. Conteúdo/finalidade/guarda e textos finais dos relatórios/e-mails precisam de validação CALI antes da coleta real; não inventar prazo de retenção.

Existem `RESEND_API_KEY` e duas Edge Functions legadas no destino; presença de configuração não comprova entrega nem autoriza envio global. O worker próprio deve limitar destinatários, validar sessão e registrar aceitação pelo provedor sem chamá-la de recebimento no inbox. PDF e e-mail terão identidade idempotente por objeto/revisão/tipo. Preparar rollback antes da aplicação. Nenhuma publicação do frontend, merge ou alteração da referência V1 faz parte deste lote.

## Implementação e prova de 05/11/2026

- `src/api/modules/disc` é a fronteira de dados; features compõem hooks, campos e estados com tokens CALI. Rotas Admin/Cliente são autenticadas; a rota pública recebe somente o convite. A composição conectada fica restrita a DEV, ao projeto CALI MAPA e às empresas A/B ou campanha sem conta. Não existe flag para habilitar coleta global.
- `supabase/proposals/disc-3/candidate.sql` foi aplicado transacionalmente no CALI MAPA após inventário. Schema privado `cali_v2_disc`, RLS e wrappers `v2_disc_*` não usam tabelas/tokens de resposta legados. Admin exige MFA/aceite; Cliente deriva empresa da sessão. `service_role` acessa somente o wrapper de processamento; tabelas privadas não recebem grants de aplicação. A allowlist contém somente os dois destinatários do piloto, sem seus endereços no repositório.
- 3A preserva os 18 blocos naturais e seis de pressão da referência, permutações e método `cali-disc-v1.1`. O formulário foi concluído uma vez no navegador integrado; depois mostrou somente agradecimento. O provedor aceitou um convite e um PDF individual anexado. Isso não comprova recebimento no inbox. As demais respostas usadas nos limiares são fixtures inseridas explicitamente, sem convites ou entregas.
- 3B apresenta escores e PDF técnico somente ao Admin. A sessão Admin baixou o PDF pelo worker autenticado. Não há liberação individual externa. O token novo de participação não consulta resultados legados nem fornece identificador/token de resultado.
- 3C foi exercitada com cinco e 15 respostas: cinco a 14 omitem contagem/distribuição/indicadores; a partir de 15 exibem estilos primários/secundários, perfis mistos, faixas e adaptação agregados, sem nomes. Parecer/objetivo, protocolo, foto e assinatura são congelados na aprovação. Cliente A recebeu somente a gestão liberada e baixou PDF; Cliente B permaneceu sem relatório. O provedor aceitou o aviso de liberação, sem PDF individual. A campanha sem conta foi criada/aprovada no Admin com cinco fixtures; seu PDF anexado foi aceito pelo provedor. A retirada em A voltou a rascunho na revisão 10, preservou aprovação/liberação anteriores e removeu o relatório da consulta Cliente após recarga.
- `workspace-disc-pilot` versão 2 está ativa com `verify_jwt=true`. A revisão local seguinte acrescenta os demais agregados ao PDF de gestão; o deploy dessa revisão foi recusado pela revisão automática por falta de autorização explícita de novo deploy. O PDF já baixado no hospedado contém distribuição primária, ainda sem os recortes adicionais presentes no código local. Não confundir os dois estados.
- A fila registra confirmação do provedor, usa chave idempotente por tarefa e não marca falha como entrega. Retentativas ficam separadas por cinco minutos, limitadas a três tentativas e à janela de 23 horas desde a primeira reserva. PDF privado revalida autorização/revisão após renderizar. Não existe URL pública de resultado/PDF.
- `pdf-lib` 1.17.1 gera artefatos no servidor; `@jsquash/webp` 1.5.0 decodifica WebP via WASM incorporado no bundle. A foto existente usa WebP: a conversão ocorre em memória no servidor, com limites de tamanho/dimensões, sem download diagnóstico local da foto. PNG/JPEG e WebP com/sem perda têm fixtures sintéticas. PDF e imagem não integram o bundle público do questionário.
- O editor preserva rascunho ao detectar revisão externa e exige recarga explícita; ações próprias atualizam sua revisão base. O botão de gestão identifica campanha, enquanto download do avaliador identifica resultado. Regressão de UI cobre ambos os públicos da gestão.

## Validação e limites

A prova SQL descartável por socket Unix cobre Admin/MFA/aceite, Cliente A/B, ausência de grants privados, replay e revisão concorrente, tokens inválidos/expirados/recusados, submissão, limites 4/5/14/15, aprovação/liberação/reabertura, histórico, entrega sem conta, fila/retentativa e cadência de dias/horas. Usa dependências de sessão simuladas e tally/guardas reais; não equivale à execução de todos os cenários no Auth hospedado. A bateria suspensa de Auth/Edge/Docker não foi iniciada.

Testes locais cobrem questões, contratos, isolamento de conteúdo dos PDFs, determinismo para retentativa, normalização de imagem, conteúdo de e-mail, worker e fronteira de download. Renderização sintética com Poppler conferiu paginação dos PDFs. O `verify` inclui somente construção autocontida do worker, sem rede/envio/runtime. `npm run verify` passou com 251 testes em 38 arquivos, formatação, lint, tipos, configuração, links e builds; a prova SQL descartável também passou. As 34 funções legadas inventariadas mantiveram definições idênticas. Quatro tarefas terminaram `sent` com recibo (convite, PDF individual, aviso e PDF ao gestor), sem tarefas pendentes.

A cadência temporal está implementada/testada em SQL, mas **não está operando automaticamente**: `config.enabled=false`, nenhum cron novo DISC instalado. O processamento do piloto é manual pelo Admin. A tentativa inicial de worker sem JWT foi recusada automaticamente; a alternativa publicada preservou JWT obrigatório. Ativar agendamento exige desenho autenticado e autorização de ativação, sem remover JWT por conveniência.

Coleta real, finalidade/guarda, textos de consentimento/relatórios/e-mails e artefatos finais precisam de validação CALI. A composição simplificada é funcional para homologação; paridade visual com a publicação 83 e lançamento continuam pendentes. Forms e Mapa pertencem a 4E e não foram convertidos em DISC.

## Rollback e operação

DEC-28 antecipa preservação atual e restauração comprovada antes da próxima alteração hospedada, incluindo a revisão final deste worker. O [plano de backup e ambientes](../RUNBOOK.md#backup-restauração-e-ambientes--dec-28) não foi executado e não substitui a autorização do deploy. A agenda permanece desligada.

Antes de retirar: desligar composição DISC e processamento, manter agendamento desativado e confirmar ausência de tarefas em trânsito. `rollback.sql` retira somente wrappers novos e solicita recarga do catálogo; preserva schema privado, respostas, revisões e eventos. Não restaurar exposição individual legada como fallback. Retorno ao serviço exige versão de worker e DTO compatíveis, concessões conferidas e prova sintética do recorte.

Não reaplicar `candidate.sql` sobre schema existente: ele é a criação inicial. Alterações posteriores exigem preimagem e migração específica. Não há baseline local, reset ou escrita no repositório V1 nesta entrega. E-mails enviados não podem ser desfeitos; histórico deve continuar registrando a aceitação do provedor.
