// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { expect, it } from 'vitest';
import { mapaReportPdf } from '../src/lib/people-map/mapa-report-pdf';

it('gera um PDF com a revisão do diagnóstico e quebra pareceres longos em páginas', async () => {
  const document = await mapaReportPdf({
    companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
    recordId: '40000000-0000-4000-8000-000000000041',
    protocol: 'CALI-QA-V2-MAPA-REPORT',
    companyName: 'Empresa Sintética A',
    createdAt: '2026-11-08T17:00:00Z',
    version: 2,
    dimensions: [8, 6, 5, 7],
    subscores: [8, 8, 8, 6, 6, 6, 5, 5, 5, 7, 7, 7],
    score: 6.6,
    observations: ['Processos documentados.', null, 'Revisar indicadores.', null],
    opinion: 'Observação sintética sobre os próximos passos. '.repeat(90),
    recommendedService: 'Assessoria Estratégica Mensal — CALI Full',
  });
  const bytes = new Uint8Array(await document.blob.arrayBuffer());
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getTitle()).toBe('Diagnóstico do Mapa de People');
  expect(parsed.getPageCount()).toBeGreaterThan(1);
  expect(document.fileName).toBe('CALI-QA-V2-MAPA-REPORT.pdf');
  if (process.env.CALI_MAPA_PDF_QA_OUTPUT) {
    await writeFile(process.env.CALI_MAPA_PDF_QA_OUTPUT, bytes);
  }
});
