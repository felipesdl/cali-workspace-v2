export const maxAttachmentBytes = 2 * 1024 * 1024;
export const maxRecordAttachmentBatchBytes = 10 * 1024 * 1024;

export async function encodeAttachment(file: File) {
  return encodeBytes(new Uint8Array(await file.arrayBuffer()));
}

function encodeBytes(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function stageAttachment(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return {
    base64: encodeBytes(new Uint8Array(buffer)),
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    ),
  };
}
