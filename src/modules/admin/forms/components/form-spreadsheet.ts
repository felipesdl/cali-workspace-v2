import { strToU8, zipSync } from 'fflate';
import { type DomainOperations } from '../../../../api/shared/workspace/domain-operations';
import { formatServerInstant } from '../../../../lib/dates';

const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRelationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const mimeType = `${officeContentType}.sheet`;

function xmlText(value: string) {
  return value
    .replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formSpreadsheet(data: Awaited<ReturnType<DomainOperations['formExport']>>) {
  const rows = [
    ['Data', 'Situação', 'Responsável', ...data.questions.map(({ label }) => label)],
    ...data.responses.map(({ submittedAt, stage, owner, values }) => [
      formatServerInstant(submittedAt),
      stage ?? '',
      owner ?? '',
      ...values,
    ]),
  ];
  // Células de texto explícitas preservam respostas que começam com =, +, - ou @.
  const sheetRows = rows
    .map(
      (row) =>
        `<row>${row.map((value) => `<c t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`).join('')}</row>`,
    )
    .join('');
  const archive = zipSync({
    '[Content_Types].xml': strToU8(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="${mimeType}.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${officeContentType}.worksheet+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<workbook xmlns="${spreadsheet}" xmlns:r="${relationships}"><sheets><sheet name="Respostas" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<worksheet xmlns="${spreadsheet}"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  });
  return {
    blob: new Blob([new Uint8Array(archive)], { type: mimeType }),
    fileName: `cali-forms-${data.slug}-respostas.xlsx`,
  };
}
