import { describe, expect, it } from 'vitest';
import { parseTeamCsv } from '../src/api/modules/team/import';
import { writeMonthOptions } from '../src/api/modules/team/maintenance';

const base = 'codigo_colaborador;nome_completo;data_admissao;cargo;departamento';

describe('prévia CSV de Equipe', () => {
  it('lê BOM, datas civis, aspas duplas e campos opcionais omitidos', () => {
    const parsed = parseTeamCsv(
      `\ufeff${base};jornada_semanal_horas\r\n42;"Pessoa ""QA""; Sobrenome";03/11/2026;Analista;Pessoas;37,5\r\n`,
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].fields).toEqual({
      employee_code: '42',
      full_name: 'Pessoa "QA"; Sobrenome',
      admission_date: '2026-11-03',
      job_title: 'Analista',
      department: 'Pessoas',
      weekly_hours: 37.5,
    });
  });

  it('exige declaração para valores privados e omite célula privada vazia', () => {
    const parsed = parseTeamCsv(
      `${base};remuneracao_atual;tem_filhos;origem_dados_opcionais_confirmada\n1;Pessoa QA;2026-11-03;Analista;Pessoas;1.234,56;;sim\n2;Pessoa B;2026-11-03;Analista;Pessoas;;sim;nao`,
    );
    expect(parsed.rows[0].privateFields).toEqual({ salary: 1234.56 });
    expect(parsed.errors).toEqual(['Linha 3. Confirme a origem dos campos privados nesta linha.']);
  });

  it('reporta duplicidade, linha inconsistente e data inválida sem transmitir conteúdo', () => {
    const parsed = parseTeamCsv(
      `${base}\n1;Pessoa A;2026-11-01;Analista;Pessoas\n1;Pessoa B;2026-11-01;Analista;Pessoas\n2;Pessoa C;2026-11-31;Analista;Pessoas\n3;Pessoa D;2026-11-01;Analista`,
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toHaveLength(3);
    expect(parsed.errors.join(' ')).not.toContain('Pessoa C');
  });

  it('respeita a virada do mês em Brasília', () => {
    expect(writeMonthOptions(new Date('2026-11-01T01:59:00Z'))).toEqual(['2026-10', '2026-09']);
    expect(writeMonthOptions(new Date('2026-11-01T03:00:00Z'))).toEqual(['2026-11', '2026-10']);
  });
});
