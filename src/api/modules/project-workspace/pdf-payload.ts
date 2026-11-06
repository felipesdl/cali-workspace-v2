import { z } from 'zod';

export const pdfPayload = z.object({
  id: z.uuid(),
  fileName: z.string(),
  content: z.string().max(2_850_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function decodePdf(result: z.infer<typeof pdfPayload>) {
  const bytes = Uint8Array.from(atob(result.content), (char) => char.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  if (hex !== result.sha256) throw new Error('Não foi possível conferir a integridade do PDF.');
  return {
    blob: new Blob([bytes], { type: 'application/octet-stream' }),
    fileName: result.fileName,
  };
}
