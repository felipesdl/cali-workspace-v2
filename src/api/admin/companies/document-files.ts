import { documentFileSchema, type CompanyDocumentFile } from './document-schemas';
export function readCompanyBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error('Não foi possível ler o arquivo.'));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(blob);
  });
}
export async function companyFileDigest(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await readCompanyBlob(blob));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function describeCompanyFile(file: File): Promise<CompanyDocumentFile> {
  const inferred: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const contentType = file.type || inferred[file.name.split('.').pop()?.toLowerCase() ?? ''];
  const fields = { fileName: file.name, contentType, bytes: file.size, sha256: '0'.repeat(64) };
  const validated = documentFileSchema.safeParse(fields); // Recusar tipo/tamanho antes de ler bytes.
  if (!validated.success)
    throw new Error(validated.error.issues[0]?.message ?? 'Arquivo inválido.');
  return { ...validated.data, sha256: await companyFileDigest(file) };
}
