# Fase 2C — Dados e confirmação mensais

Homologação funcional concluída em 05/11/2026 no piloto A/B após a [2B](TEAM_2B.md). Domínios FLOW-08 e FLOW-04. Referência funcional da publicação 83 e DEC-05/10. Execução hospedada restrita às empresas sintéticas A/B do CALI MAPA. A composição simplificada continua autorizada para testes.

## Contrato alvo

- Cliente informa o primeiro lançamento de métricas da própria empresa. Depois da gravação, Cliente consulta e Admin com MFA corrige. A operação confere a versão aberta, registra autoria, instante e preimagem e preserva valores nulos. Dados de outra empresa são recusados.
- Métricas existentes são reutilizadas: horas previstas, ausências por categoria, horas extras, saldo do banco, quadro aprovado por departamento, eNPS e pesquisa de clima. Fórmulas seguem a publicação 83. Ausência de informação permanece ausência, inclusive denominadores nulos.
- O pedido de revisão aparece somente para Cliente. A confirmação registra o quadro conferido, as movimentações já salvas e as vagas acompanhadas. Manutenção do cadastro continua na 2B. Confirmar um mês vazio é permitido. Reconfirmar exige a revisão atual e preserva a versão anterior.
- Mês atual e anterior seguem a janela efetiva das RPCs existentes de Equipe. As consultas preservam meses anteriores e permitem comparação de até 12 referências. O servidor usa América/São Paulo para a virada de mês.
- Vagas ausentes do envio ficam preservadas. Código e abertura identificam a vaga existente. Mudanças concorrentes exigem nova conferência. A confirmação e as vagas são gravadas na mesma transação.
- Todo Cliente equivalente da empresa pode lançar e confirmar. A correção de métricas gravadas permanece exclusiva do Admin. Cadastro de pessoas, métricas e confirmação têm operações explícitas distintas.
- Comunicação desta entrega começa na pendência dentro da V2. O inventário encontrou um lembrete legado por e-mail para perfis principais. Sua existência não comprova envio, nem autoriza ativação ou mudança do canal. O resumo diário Admin permanece em RESUMO-01.

## Lotes e aceite

| Lote | Entrega | Validação |
| --- | --- | --- |
| 1 | Leitura e lançamento/correção de métricas, trilha, preimagem e proteção da escrita direta legada no piloto | Cliente inicial; Admin corrige; recusa Cliente após gravado; MFA, empresa e sessão; concorrência/replay e nulos |
| 2 | Confirmação mensal, snapshots versionados, vagas e pendência Cliente | Mês vazio, atual/anterior, preimagem, falha atômica, repetição, ausentes preservados e troca de empresa |
| 3 | Consulta de indicadores essenciais e comparação de referências, integração com histórico | Fórmulas preservadas, 12 meses, denominador ausente, datas efetivas e estados vazios |
| 4 | Homologação autenticada A/B/Admin no navegador integrado, documentação e PR | Recarga, teclado/mobile, isolamento, lançamento Cliente, correção Admin e confirmação com trilha |

## Inventário de 05/11

O catálogo ativo confirmou as tabelas `team_month_metrics`, `team_months`, `team_month_snapshots`, `team_month_reviews`, `team_vacancies` e `team_vacancy_events`. As duas empresas do piloto tinham zero métricas, meses, revisões e vagas antes da entrega.

A escrita direta de métricas usa `can_access_company` em INSERT e UPDATE e admite alteração pelo Cliente. A função `confirm_team_month_v2` chama `save_team_month_v1`, que também grava confirmação e snapshots. Os dois escritores legados ainda usam `is_primary`. A V2 precisa de operações próprias e proteção da escrita direta no recorte A/B para cumprir DEC-05/10.

## Estado e limites

### Lote 1 — Métricas

O [SQL de métricas](../../supabase/proposals/team-monthly-2c/metrics.sql) e seu [rollback](../../supabase/proposals/team-monthly-2c/rollback-metrics.sql) foram implementados e aplicados no CALI MAPA após preflight de schema, guardas, perfis A/B e ausência de lançamentos. Duas policies restritivas bloqueiam INSERT/UPDATE direto somente nas empresas do piloto. As permissões e policies preexistentes continuam válidas fora desse recorte. As duas RPCs novas aceitam `authenticated` e recusam `anon`.

O primeiro lançamento exige Cliente e ausência de registro. A correção exige Admin com MFA, motivo e timestamp da preimagem. O lock de empresa acompanha a 2B. A chave de operação identifica replay com o mesmo ator e payload. Auditoria privada preserva antes/depois e autoria. Horas negativas são recusadas, exceto no saldo do banco. Quadros aprovados usam contagens inteiras não negativas. A observação admite até 5.000 caracteres, e o motivo até 500.

No navegador integrado, Cliente A informou 100 horas previstas, quatro horas de ausência, saldo de banco negativo e quadro aprovado sintéticos. A recarga preservou os dados e os campos não informados. O Admin não recebeu ação para o primeiro lançamento de B. Em A, corrigiu as horas para 120 com motivo e viu as duas revisões.

O teste focado `sh supabase/proposals/team-monthly-2c/test.sh` passou em PostgreSQL descartável. A fixture simula sessão e termos; as guardas e RPCs de Equipe são as candidatas reais. A prova cobre isolamento, MFA exigido, recusa de escrita direta, equivalência Cliente, Cliente sem correção, motivo, limites, preimagem, replay, corte, aceite e continuidade da escrita legada fora do piloto. A rodada hospedada complementa a fixture com sessões reais.

### Lotes 2–4 — Confirmação, vagas, indicadores e homologação

O [SQL de confirmação](../../supabase/proposals/team-monthly-2c/review.sql) foi aplicado transacionalmente após conferir dependências, ausência de confirmações/vagas e triggers efetivas. Cadastro e métricas não são reenviados pela confirmação. O servidor grava mês, revisão, snapshot, vagas e eventos na mesma transação. Vaga omitida permanece cadastrada. Até 200 vagas são conferidas por envio; abertura de vaga existente é imutável. Novas vagas, alterações e cancelamentos preservam antes/depois em `team_vacancy_events`.

A confirmação captura um token da revisão, cadastro, vagas e métricas. Mudança após a abertura exige recarga. O mesmo lock de empresa da 2B serializa as escritas. Repetição com a mesma identidade/ator/payload retorna o resultado anterior, sem nova revisão. Reconfirmação preserva o snapshot anterior na auditoria privada e substitui somente a projeção corrente daquele mês. Admin exige motivo para reconfirmar; Cliente equivalente pode reconfirmar a própria empresa. A leitura retorna projeções explícitas e até 12 referências confirmadas.

O [complemento de leitura](../../supabase/proposals/team-monthly-2c/read.sql) acrescenta policies restritivas nas seis tabelas mensais. No catálogo observado, a leitura direta já aplicava empresa/sessão/MFA por `can_access_company`, mas não exigia aceite vigente. O complemento aplica a mesma guarda das RPCs somente a A/B, inclusive aceite e admissão. Fora do piloto retorna verdadeiro e mantém as condições permissivas preexistentes. Não concede acesso a quem já não tinha SELECT. Preflight conferiu as duas empresas exatas, nomes livres e as seis tabelas; postflight confirmou seis policies restritivas.

A pendência do mês anterior aparece no Início apenas ao Cliente e desaparece após confirmar, inclusive em mês sem pessoas ou vagas. Não foi ativado scheduler, envio de e-mail, resumo diário ou notificação externa. Métricas ausentes não impedem a conferência do quadro, preservando a separação observada na referência. Na fase 4C, a primeira confirmação Cliente passou a gerar [aviso Admin no app e no resumo](PHASE_4_READ.md#prévia-do-resumo-diário-admin-no-cali-mapa), sem e-mail ou retroatividade.

Os componentes `TeamMonthReview`, `TeamMonthlyIndicators` e `TeamMonthlyReminder` usam o serviço mensal e seu hook. Cache é segregado por ator/empresa/referência e invalidado após escrita. A empresa Cliente vem da sessão; `companyId` da URL não concede seleção. Admin usa o seletor do piloto. Os estados de erro, recarga, confirmação, nulos e contexto são explícitos.

**Fórmulas preservadas.** Rotatividade segue saídas/quadro ativo, com zero quando o quadro confirmado está vazio. Absenteísmo soma as quatro categorias de ausência e divide pelas horas previstas; denominador zero/ausente permanece “Não informado”. A referência 83 usa recortes diferentes: resumo do mês atual desconsidera fichas arquivadas; a série histórica de admissões/saídas conserva os eventos. Isso foi mantido e explicado na tela. No piloto, B mostrou zero admissões no resumo e duas na série de novembro após arquivar as fichas QA. A diferença não foi transformada em nova regra. A revisão de fórmula/qualidade de produto permanece em OPEN-05.

### Evidência de 05/11/2026

- Cliente A confirmou novembro com uma vaga sintética, reconfirmou cancelando essa vaga e preservou o histórico. Admin reconfirmou A com motivo, chegando à revisão 3. As horas corrigidas permaneceram em 120 e o absenteísmo em 3,3%.
- Cliente B lançou zero horas previstas e zero ausência por atestado; demais campos permaneceram nulos. Confirmou mês sem pessoas/vagas. Absenteísmo ficou “Não informado”, sem divisão por zero.
- Cliente A abriu a pendência de outubro pelo Início, confirmou a referência vazia e voltou à home sem o aviso. Nenhuma métrica de outubro foi inventada.
- Seleção A/B no Admin e recarga preservaram o contexto. Incluir `companyId` de A na URL do Cliente B manteve a leitura de B. Após o complemento de leitura, a recarga Admin manteve os dados e a confirmação.
- Editor mensal em viewport de 390 × 844 px: formulário com 324 px e documento com 390 px, sem transbordamento horizontal. Interações de teclado e datas nativas foram exercitadas. A composição permanece simplificada para homologação funcional.
- Prova de banco hospedado: A com uma linha de métricas, duas referências confirmadas e seis eventos privados; B com uma linha, uma referência e dois eventos. Revisões de mês/revisão consistentes, nenhuma vaga aberta de teste, preimagem de 100 para 120 preservada, dois eventos de vaga e identidades de operação únicas. As definições das guardas anteriores e dos escritores legados permaneceram idênticas ao preflight.
- `sh supabase/proposals/team-monthly-2c/test.sh test-review.sql` passou em PostgreSQL descartável, sem rede/Auth/Edge/Docker. Inclui os casos de métricas, falha atômica de vaga, token obsoleto, replay, outro Cliente equivalente, vaga omitida, preimagem de snapshot, mês vazio e janela de 12 referências. Também comprova leitura direta negada sem aceite/Admin sem MFA e leitura legada preservada fora do piloto. Sessão e termos são simulados na fixture; as guardas/RPCs de Equipe são as candidatas reais.

### Gates do lote

`npm run verify` passou: formatação, lint, TypeScript, 225 testes em 33 arquivos, integridade da configuração local, links documentais, build do frontend e bundle autocontido da Edge. Não houve execução de runtime Edge/Auth/Docker. A tentativa anterior com 33 workers teve oito falhas de espera/timeout; o limite de dois workers foi fixado no Vitest, preservando timeouts e asserções, e a suíte completa passou. Build mantém o aviso conhecido de chunk principal acima de 500 kB; otimização do carregamento permanece no frontend final. CI remota não foi comprovada.

### Rollback e limites

Desabilitar o consumidor mensal na composição do piloto antes da retirada de endpoints. Executar [rollback da leitura](../../supabase/proposals/team-monthly-2c/rollback-read.sql), [rollback da confirmação](../../supabase/proposals/team-monthly-2c/rollback-review.sql) e, se retirar também o lote 1, [rollback das métricas](../../supabase/proposals/team-monthly-2c/rollback-metrics.sql), nessa ordem. O rollback preserva métricas, referências, snapshots, vagas, eventos e auditoria. Ele restaura as permissões anteriores de leitura/escrita direta; por isso não manter o consumidor novo ativo após a retirada das guardas.

A 2C fecha funcionalmente no piloto sintético A/B, com Admin e Clientes autenticados no navegador integrado. Isso não encerra a cobertura global da fase 1, nem comprova CI, merge ou publicação. Equivalência de dois Clientes na mesma empresa e recusas de sessão/MFA/aceite têm prova SQL descartável; a rodada hospedada exercitou os atores A, B e Admin existentes. Paridade visual com a publicação 83, validação da coleta real e liberação operacional continuam como condições do lançamento. A bateria suspensa permanece intocada.
