const vercelPreviewOrigin = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/;

export function isPreviewOrigin(origin: string): boolean {
  return (
    origin === 'https://staging.calirh.com' ||
    (origin === origin.trim() && vercelPreviewOrigin.test(origin))
  );
}
