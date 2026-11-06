// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { createExecutivePdfHandler } from '../supabase/functions/workspace-executive-pdf/handler';
import {
  renderExecutivePdf,
  reportInputSchema,
} from '../supabase/functions/workspace-executive-pdf/report-pdf';

const photo = new Uint8Array(
  await readFile(new URL('./fixtures/disc-signature-photo.png', import.meta.url)),
);
const command = {
  companyId: '9c5ab148-78b8-4410-9338-58c44222a5db',
  reportId: '30000000-0000-4000-8000-000000000001',
  version: 2,
};
const input = {
  title: 'Fechamento do período',
  companyName: 'Empresa Sintética A',
  protocol: 'CALI-EXEC-2026-000002',
  version: 2,
  approvedAt: '2026-11-06T16:00:00+00:00',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  summary: 'Conclusão aprovada: implantação em revisão.\n'.repeat(120),
  source: {
    hours: { contractedHours: 12, consumedMinutes: 115 },
    deliverables: { approvedCount: 4, createdCount: 5 },
    feedback: { count: 2, average: 4.5 },
    internalNote: 'CONTEÚDO_INTERNO_EXCLUÍDO',
  },
  signer: {
    full_name: 'Responsável CALI Sintética',
    job_title: 'People Advisory',
    avatar_url: 'https://app.calirh.com/foto-sintetica.png',
    signature_mode: 'typed',
    signature_url: null,
  },
};
const ticket = '30000000-0000-4000-8000-000000000002';
const request = (body: object, authorization?: string) =>
  new Request('http://localhost/functions/v1/workspace-executive-pdf', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: authorization ? { Authorization: authorization } : {},
  });

it('gera PDF paginado a partir do retrato validado com foto e protocolo da revisão', async () => {
  const bytes = await renderExecutivePdf(reportInputSchema.parse(input), photo);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getTitle()).toBe('Fechamento do período');
  expect(doc.getSubject()).toBe('CALI-EXEC-2026-000002');
  expect(doc.getPageCount()).toBeGreaterThan(1);
  const syntheticOutput = process.env.CALI_QA_EXECUTIVE_OUTPUT;
  if (syntheticOutput) await writeFile(syntheticOutput, bytes);
});

it('só grava artefato após autorização e recusa parâmetros de conteúdo do navegador', async () => {
  const prepare = vi.fn(async () => ({ ticket, input }));
  const store = vi.fn(async () => {});
  const readImage = vi.fn(async () => photo);
  const handle = createExecutivePdfHandler({ prepare, store, readImage });
  expect((await handle(request(command))).status).toBe(401);
  expect(
    (await handle(request({ ...command, summary: 'alterado' }, 'Bearer fixture'))).status,
  ).toBe(400);
  expect(prepare).not.toHaveBeenCalled();
  prepare.mockRejectedValueOnce(new Error('Sem MFA'));
  expect((await handle(request(command, 'Bearer fixture'))).status).toBe(403);
  expect(readImage).not.toHaveBeenCalled();
  prepare.mockResolvedValueOnce({
    ticket,
    input: {
      ...input,
      source: { ...input.source, hours: { contractedHours: 12, consumedMinutes: -1 } },
    },
  });
  expect((await handle(request(command, 'Bearer fixture'))).status).toBe(422);
  expect(store).not.toHaveBeenCalled();
  const success = await handle(request(command, 'Bearer fixture'));
  expect(success.status).toBe(200);
  expect(store).toHaveBeenCalledExactlyOnceWith(command, ticket, expect.any(Uint8Array));
});
