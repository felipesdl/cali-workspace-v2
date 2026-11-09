import { hostedLegalContent, hostedLegalTitle, hostedLegalVersion } from './legal';
import { currentTermsSchema } from './session';

let bundledHash: Promise<string> | undefined;

export async function readPublishedTerms(publication: { version: string; contentHash: string }) {
  if (publication.version !== hostedLegalVersion) return null;
  bundledHash ??= crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(hostedLegalContent))
    .then((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
  if (publication.contentHash !== (await bundledHash)) return null;
  return currentTermsSchema.parse({
    version: publication.version,
    contentHash: publication.contentHash,
    title: hostedLegalTitle,
    content: hostedLegalContent,
  });
}
