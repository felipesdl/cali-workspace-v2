# Homologação funcional com Patrícia

Usar empresas e dados de teste no CALI MAPA. Patrícia valida o fluxo como dona do produto. Felipe prepara o ambiente, acompanha a rodada e registra o aceite por tarefa. A versão atual usa as telas simplificadas de homologação.

## Preparar antes de enviar o acesso

| Item | Ação de Felipe ou da equipe técnica |
| --- | --- |
| Link da V2 | Definir a URL de homologação. Hoje Equipe, dados mensais e DISC conectados dependem do modo de desenvolvimento, e o acesso A/B, arquivos privados e DISC aceitam origens locais específicas. Para Patrícia testar do próprio computador via link, preparar um preview protegido, adaptar os gates ao domínio de teste, configurar origens e callbacks e trocar os links locais nos e-mails. Conferir login, link de convite e PDF nessa URL antes do envio. |
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
5. **Aceite.** Para cada problema, registrar papel, tela, ação, resultado esperado e observado. Registrar em separado os ajustes de layout em relação à publicação 83.

Encerrar verificando cron DISC desligado e ausente, fila conferida e provisionamento temporário desligado, caso usado. Guardar a versão testada e os resultados no PR de acompanhamento.

## Mensagem para enviar junto do link

> Patrícia, a V2 está pronta para esta rodada de homologação em ambiente de teste. Vamos conferir acesso, empresas, Equipe, dados mensais e DISC usando os dados de exemplo. Te mando o link e os acessos de teste pelo canal combinado. Para cada ponto que você quiser ajustar, me diga a tela, o que tentou fazer e o que esperava ver.
