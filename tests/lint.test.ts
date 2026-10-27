// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

describe('contrato das restrições de lint', () => {
  it.each([
    {
      name: 'any no domínio',
      file: 'src/features/companies/lint-contract.ts',
      code: 'export type Item = any;',
      rule: '@typescript-eslint/no-explicit-any',
    },
    {
      name: 'any nos testes',
      file: 'tests/lint-contract.ts',
      code: 'export type Item = any;',
      rule: '@typescript-eslint/no-explicit-any',
    },
    {
      name: 'unknown sem exceção local, inclusive no service',
      file: 'src/api/modules/companies/service.ts',
      code: 'export type Item = unknown;',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'cast que oculta campo ausente no objeto',
      file: 'src/lib/lint-contract.ts',
      code: 'type Item = { id: string }; export const item = {} as Item;',
      rule: '@typescript-eslint/consistent-type-assertions',
    },
    {
      name: 'cast de array literal',
      file: 'src/lib/lint-contract.ts',
      code: 'type Item = { id: string }; export const items = [{}] as Item[];',
      rule: '@typescript-eslint/consistent-type-assertions',
    },
    {
      name: 'import de tipo sem marcador type',
      file: 'src/lib/lint-contract.ts',
      code: "import { Company } from '../api/modules/companies/schemas'; export type Item = Company;",
      rule: '@typescript-eslint/consistent-type-imports',
    },
    {
      name: 'import não utilizado',
      file: 'src/lib/lint-contract.ts',
      code: "import { format } from 'date-fns'; export const marker = 1;",
      rule: '@typescript-eslint/no-unused-vars',
    },
    {
      name: 'alert',
      file: 'src/lib/lint-contract.ts',
      code: "export function show() { alert('mensagem'); }",
      rule: 'no-alert',
    },
    {
      name: 'window.location.reload',
      file: 'src/lib/lint-contract.ts',
      code: 'export function refresh() { window.location.reload(); }',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'location.reload sem window',
      file: 'src/lib/lint-contract.ts',
      code: 'export function refresh() { location.reload(); }',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'índice direto como key',
      file: 'src/features/companies/lint-contract.tsx',
      code: 'export function List() { return [1, 2].map((item, index) => <span key={index}>{item}</span>); }',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'índice interpolado como key no legado',
      file: 'src/app/ClientWorkspace.tsx',
      code: 'export function List() { return [1, 2].map((item, i) => <span key={`item-${i}`}>{item}</span>); }',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'aplicação importando testes',
      file: 'src/lib/lint-contract.ts',
      code: "import { sample } from '../../tests/mocks/http'; export const proof = sample;",
      rule: 'no-restricted-imports',
    },
    {
      name: 'feature importando mocks',
      file: 'src/features/companies/lint-contract.ts',
      code: "import { sample } from '../../mocks/fixtures/companies'; export const proof = sample;",
      rule: 'no-restricted-imports',
    },
    {
      name: 'DS importando API',
      file: 'src/components/ds/lint-contract.ts',
      code: "import { sample } from '../../api/modules/companies/service'; export const proof = sample;",
      rule: 'no-restricted-imports',
    },
    {
      name: 'service selecionando mocks fora da composição',
      file: 'src/api/modules/companies/service.ts',
      code: "import { sample } from '../../../mocks/adapters/companies'; export const proof = sample;",
      rule: 'no-restricted-imports',
    },
  ])('bloqueia $name', async ({ file, code, rule }) => {
    const results = await eslint.lintText(code, { filePath: file });
    expect(results.flatMap((result) => result.messages.map((message) => message.ruleId))).toContain(
      rule,
    );
  });

  it.each([
    {
      name: 'variante UI como string tipada',
      file: 'src/features/companies/lint-contract.tsx',
      code: 'import { Button } from "../../components/ds/button/Button"; export function Sample() { return <Button variant="secondary" />; }',
    },
    {
      name: 'variante UI como literal em expressão',
      file: 'src/features/companies/lint-contract.tsx',
      code: 'import { Button } from "../../components/ds/button/Button"; export function Sample() { return <Button variant={"secondary"} />; }',
    },
    {
      name: 'variante UI do vocabulário compartilhado',
      file: 'src/features/companies/lint-contract.tsx',
      code: "import { Button } from '../../components/ds/button/Button'; import { UiVariant } from '../../components/ds/variants'; export function Sample() { return <Button variant={UiVariant.Secondary} />; }",
    },
    {
      name: 'constantes as const e contrato por satisfies',
      file: 'src/lib/lint-contract.ts',
      code: "export const status = { Active: 'active' } as const; export const labels = { active: 'Ativa' } satisfies Record<string, string>;",
    },
    {
      name: 'mock selecionado pela composição',
      file: 'src/api/modules/companies/api.ts',
      code: "import { createCompaniesMockAdapter } from '../../../mocks/adapters/companies'; export const adapter = createCompaniesMockAdapter();",
    },
    {
      name: 'testes importando seu próprio suporte',
      file: 'tests/lint-contract.ts',
      code: "import { createStaticResponseAdapter } from '../tests/mocks/http'; export const adapter = createStaticResponseAdapter([]);",
    },
    {
      name: 'entrada bruta com exceção local justificada e guard',
      file: 'src/lib/lint-contract.ts',
      code: '// eslint-disable-next-line no-restricted-syntax -- Entrada bruta validada por guard.\nexport function decode(value: unknown) { return typeof value === "string" ? value : null; }',
    },
  ])('permite $name', async ({ file, code }) => {
    const results = await eslint.lintText(code, { filePath: file });
    expect(results.flatMap((result) => result.messages)).toEqual([]);
  });
});
