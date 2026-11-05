import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const pilotDocuments = new Map([
  [
    '9c5ab148-78b8-4410-9338-58c44222a5db',
    { label: 'A', id: '61918761-e44c-45fb-848c-a5df59538b0b' },
  ],
  [
    '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76',
    { label: 'B', id: '570adf40-77e7-4bf8-85b2-be25aa5575e9' },
  ],
]);
const unavailable = () => new Error('Não foi possível preparar o contrato sintético.');

function fixturePdf(label: string) {
  const text = `BT /F1 14 Tf 42 760 Td (CALI - Contrato sintetico de teste ${label}) Tj 0 -25 Td (Fixture de homologacao 2A. Sem valor contratual.) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return pdf + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

export async function preparePilotDocument(client: WorkspaceClient, companyId: string) {
  const fixture = pilotDocuments.get(companyId);
  if (!import.meta.env.DEV || !fixture) throw unavailable();
  const pdf = fixturePdf(fixture.label);
  const path = `${companyId}/account/qa-contrato-sintetico-2a.pdf`;
  const bucket = client.storage.from('cali-workspace-private');
  const uploaded = await bucket.upload(path, new Blob([pdf], { type: 'application/pdf' }), {
    contentType: 'application/pdf',
    cacheControl: '0',
    upsert: false,
  });
  if (uploaded.error) {
    const existing = await bucket.download(
      path,
      { cacheNonce: crypto.randomUUID() },
      { cache: 'no-store' },
    );
    if (existing.error || (await existing.data.text()) !== pdf) throw unavailable();
  }

  const title = `QA 2A - Contrato sintético ${fixture.label}`;
  const { error } = await client.from('account_documents').upsert(
    {
      id: fixture.id,
      company_id: companyId,
      storage_path: path,
      document_type: 'contract',
      title,
      client_visible: false,
      notes: 'Documento sintético sem valor contratual. Homologação 2A.',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw unavailable();
  const result = await client
    .from('account_documents')
    .select('company_id,storage_path,title,document_type,client_visible')
    .eq('id', fixture.id)
    .single();
  const row = z
    .object({
      company_id: z.literal(companyId),
      storage_path: z.literal(path),
      title: z.literal(title),
      document_type: z.literal('contract'),
      client_visible: z.literal(false),
    })
    .safeParse(result.data);
  if (result.error || !row.success) throw unavailable();
}
