# Fase 2C — Dados e confirmação mensais

Plano autorizado em 05/11/2026 após a homologação funcional da [2B](TEAM_2B.md). Domínios FLOW-08 e FLOW-04. Referência funcional da publicação 83 e DEC-05/10. Execução hospedada restrita às empresas sintéticas A/B do CALI MAPA. A composição simplificada continua autorizada para testes.

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

Confirmação/snapshots/vagas e indicadores essenciais continuam pendentes. A coleta real e o frontend final continuam como condições do lançamento.
