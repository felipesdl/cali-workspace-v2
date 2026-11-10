import { z } from 'zod';
import {
  professionalFieldsSchema,
  professionalPatchSchema,
  type ProfessionalPatch,
} from './maintenance';
import { teamPrivateValues } from './private-fields';
import { formatTerminationReason, teamTerminationCodes } from './termination';

const csvColumns = {
  codigo_colaborador: 'employee_code',
  nome_completo: 'full_name',
  data_admissao: 'admission_date',
  cargo: 'job_title',
  senioridade: 'seniority',
  departamento: 'department',
  setor: 'team_area',
  codigo_gestor: 'manager_code',
  lideranca: 'is_leader',
  tipo_contratacao: 'employment_type',
  jornada_semanal_horas: 'weekly_hours',
  modelo_trabalho: 'work_model',
  unidade_localidade: 'location',
  email_corporativo: 'work_email',
  telefone_profissional: 'work_phone',
  situacao: 'status',
  motivo_afastamento: 'leave_reason',
  data_inicio_afastamento: 'leave_start_date',
  previsao_retorno: 'expected_return_date',
  data_desligamento: 'termination_date',
  iniciativa_desligamento: 'termination_initiative',
  codigo_esocial_desligamento: 'termination_code',
  motivo_desligamento: 'termination_reason',
  aviso_previo: 'notice_type',
  remuneracao_atual: 'salary',
  data_ultima_revisao_salarial: 'salary_review_date',
  genero: 'gender',
  identificacao_genero: 'gender_detail',
  tem_filhos: 'has_children',
  origem_dados_opcionais_confirmada: 'optional_data_declared',
} as const;
const required = ['employee_code', 'full_name', 'admission_date', 'job_title', 'department'];
const optionalPrivate = teamPrivateValues.partial();
const dateColumns = new Set([
  'admission_date',
  'leave_start_date',
  'expected_return_date',
  'termination_date',
  'salary_review_date',
]);
export const teamCsvTemplate = '\ufeff' + Object.keys(csvColumns).join(';') + '\r\n';

type CsvMember = {
  line: number;
  fields: ProfessionalPatch;
  privateFields: z.infer<typeof optionalPrivate>;
};
type CsvResult = { rows: CsvMember[]; errors: string[] };
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const headerKey = (value: string) =>
  normalized(value.trim())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const headers = new Map<string, string>(
  Object.entries(csvColumns).flatMap(([label, key]) => [
    [label, key],
    [key, key],
  ]),
);

function splitCsv(raw: string) {
  const firstLine = raw.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.replace(/"[^"]*"/g, '').includes(';') ? ';' : ',';
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let mode: 'plain' | 'quoted' | 'closed' = 'plain';
  let line = 1;
  let startLine = 1;
  function pushCell() {
    cells.push(cell.trim());
    cell = '';
    mode = 'plain';
  }
  function pushRow() {
    pushCell();
    if (cells.some(Boolean)) rows.push({ line: startLine, cells });
    cells = [];
  }
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (mode === 'quoted') {
      if (char === '"' && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') mode = 'closed';
      else {
        cell += char;
        if (char === '\n') line++;
      }
      continue;
    }
    if (char === delimiter) pushCell();
    else if (char === '\r' || char === '\n') {
      pushRow();
      if (char === '\r' && raw[i + 1] === '\n') i++;
      line++;
      startLine = line;
    } else if (char === '"' && mode === 'plain' && cell.trim() === '') mode = 'quoted';
    else if (mode === 'closed' && char.trim() === '') continue;
    else if (mode === 'closed' || char === '"')
      throw new Error(`Aspas inválidas na linha ${line}.`);
    else cell += char;
  }
  if (mode === 'quoted') throw new Error(`Aspas sem fechamento na linha ${startLine}.`);
  pushRow();
  return rows;
}

const aliases: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  status: {
    ativo: 'active',
    ativa: 'active',
    afastado: 'leave',
    afastada: 'leave',
    ferias: 'leave',
    desligado: 'terminated',
    desligada: 'terminated',
  },
  employment_type: {
    estagio: 'intern',
    aprendiz: 'other',
    temporario: 'temporary',
    terceirizado: 'outsourced',
    outro: 'other',
  },
  work_model: {
    hibrido: 'hibrido',
    presencial: 'presencial',
    remoto: 'remoto',
    'home office': 'remoto',
    home_office: 'remoto',
  },
  leave_reason: {
    ferias: 'vacation',
    afastamento: 'medical_leave',
    licenca: 'medical_leave',
    'licenca maternidade': 'parental_leave',
    'licenca paternidade': 'parental_leave',
    'licenca nao remunerada': 'unpaid_leave',
    outro: 'other',
  },
  termination_initiative: {
    'pedido da pessoa': 'employee',
    'pedido do colaborador': 'employee',
    'por iniciativa do empregado': 'employee',
    empresa: 'company',
    'por iniciativa do empregador': 'company',
    'fim do contrato': 'contract_end',
    'termino do contrato a termo': 'contract_end',
    outro: 'other',
  },
  notice_type: {
    trabalhado: 'worked',
    indenizado: 'indemnified',
    dispensado: 'waived',
    'nao se aplica': 'not_applicable',
  },
  gender: {
    feminino: 'female',
    masculino: 'male',
    outra: 'other',
    'outra identificacao': 'other',
    'prefiro nao informar': 'prefer_not',
  },
  has_children: { sim: 'yes', nao: 'no', 'prefiro nao informar': 'prefer_not' },
};

function parseCell(key: string, value: string): string | number | boolean | null {
  if (key === 'is_leader' || key === 'optional_data_declared') {
    const norm = normalized(value);
    if (['sim', 's', 'yes', 'true', '1'].includes(norm)) return true;
    if (['', 'nao', 'n', 'no', 'false', '0'].includes(norm)) return false;
    throw new Error('Use Sim ou Não no campo de confirmação.');
  }
  if (!value) return null;
  if (dateColumns.has(key)) {
    const brazilian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return z.iso
      .date()
      .parse(brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : value);
  }
  if (key === 'weekly_hours') return Number(value.replace(',', '.'));
  if (key === 'salary') {
    const amount = value.replace(/\s|^R\$/gi, '');
    const canonical = amount.includes(',') ? amount.replace(/\./g, '').replace(',', '.') : amount;
    if (!/^\d+(\.\d{1,2})?$/.test(canonical)) throw new Error('Remuneração inválida.');
    return Number(canonical);
  }
  const dict = aliases[key];
  const token = normalized(value);
  if (dict && Object.prototype.hasOwnProperty.call(dict, token)) return dict[token];
  return key === 'employment_type' ? token : value;
}

export function parseTeamCsv(raw: string): CsvResult {
  const rows = splitCsv(raw.replace(/^\ufeff/, ''));
  if (rows.length < 2) throw new Error('A planilha está vazia.');
  if (rows.length > 2001) throw new Error('Envie no máximo 2.000 pessoas por importação.');
  const [header, ...records] = rows;
  const keys = header.cells.map((cell) => headers.get(headerKey(cell)) ?? '');
  if (keys.includes('') || new Set(keys).size !== keys.length)
    throw new Error('Coluna desconhecida ou duplicada. Use o modelo da Equipe.');
  if (!required.every((key) => keys.includes(key)))
    throw new Error('Informe código, nome, admissão, cargo e departamento.');
  const publicKeys = new Set<string>(professionalFieldsSchema.keyof().options);
  const privateKeys = new Set<string>(teamPrivateValues.keyof().options);
  const seen = new Set<string>();
  const result: CsvResult = { rows: [], errors: [] };
  for (const row of records) {
    try {
      if (row.cells.length !== keys.length)
        throw new Error('Quantidade de colunas divergente do cabeçalho.');
      const fields: Record<string, string | number | boolean | null> = {};
      const privateFields: Record<string, string | number | boolean | null> = {};
      let declared = false;
      let terminationCode = '';
      for (const [index, key] of keys.entries()) {
        const value = row.cells[index];
        if (key === 'termination_code') {
          terminationCode = value ? value.padStart(2, '0') : '';
        } else if (key === 'optional_data_declared') declared = parseCell(key, value) === true;
        else if (privateKeys.has(key) && value) privateFields[key] = parseCell(key, value);
        else if (publicKeys.has(key) && (value || !['status', 'employment_type'].includes(key)))
          fields[key] = parseCell(key, value);
      }
      if (terminationCode) {
        const found = Object.entries(teamTerminationCodes).find(
          ([code]) => code === terminationCode,
        );
        if (!found) throw new Error('Código eSocial de desligamento inválido.');
        fields.termination_initiative = found[1].initiative;
        fields.termination_reason = formatTerminationReason(
          terminationCode,
          String(fields.termination_reason ?? ''),
        );
      }
      if (Object.keys(privateFields).length && !declared)
        throw new Error('Confirme a origem dos campos privados nesta linha.');
      const parsed = professionalPatchSchema.parse(fields);
      if (seen.has(parsed.employee_code)) throw new Error('Código repetido na planilha.');
      seen.add(parsed.employee_code);
      result.rows.push({
        line: row.line,
        fields: parsed,
        privateFields: optionalPrivate.parse(privateFields),
      });
    } catch (cause) {
      result.errors.push(
        `Linha ${row.line}. ${cause instanceof z.ZodError ? 'Confira os campos e formatos informados.' : cause instanceof Error ? cause.message : 'Dados inválidos.'}`,
      );
    }
  }
  return result;
}

const stamp = z.iso.datetime({ offset: true }).nullable();
export const previewKind = {
  New: 'new',
  Changed: 'changed',
  Reactivated: 'reactivated',
  Unchanged: 'unchanged',
} as const;
export const teamImportPreview = z.object({
  absent: z.number().int().nonnegative(),
  rows: z.array(
    z.object({
      code: z.string(),
      expectedAt: stamp,
      privateExpectedAt: stamp,
      kind: z.enum(previewKind),
      managerValid: z.boolean(),
    }),
  ),
});
export type TeamImportPreview = z.infer<typeof teamImportPreview>;
export const importPrivateRow = z.object({
  code: z.string().min(1).max(60),
  expectedAt: stamp,
  declared: z.literal(true),
  fields: optionalPrivate,
});
export type ImportPrivateRow = z.infer<typeof importPrivateRow>;
