// @vitest-environment node
import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from 'vitest';
import { formSpreadsheet } from '../src/modules/admin/forms/components/form-spreadsheet';

test('preserva respostas como texto e escapa o XML da planilha de Forms', async () => {
  const exportFile = formSpreadsheet({
    slug: 'coleta-teste',
    questions: [{ label: 'Ação & revisão' }, { label: 'Outra pergunta' }],
    responses: [
      {
        submittedAt: '2026-11-08T15:00:00Z',
        stage: 'Nova',
        owner: null,
        values: ['=1+2', '  <texto> com quebra\n e 😀\u0000'],
      },
    ],
  });
  const files = unzipSync(new Uint8Array(await exportFile.blob.arrayBuffer()));
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  expect(exportFile.fileName).toBe('cali-forms-coleta-teste-respostas.xlsx');
  expect(sheet).toContain('Ação &amp; revisão');
  expect(sheet).toContain('<c t="inlineStr"><is><t xml:space="preserve">=1+2</t>');
  expect(sheet).toContain('  &lt;texto&gt; com quebra\n e 😀');
  expect(sheet).not.toContain('<f>');
  expect(sheet).not.toContain('\u0000');
});
