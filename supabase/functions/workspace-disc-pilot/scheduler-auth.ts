// O gateway continua exigindo JWT. Credencial nova sb_secret_* não é JWT.
export async function matchesSchedulerBearer(authorization: string, expectedSha256: string) {
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) return false;
  if (!authorization.startsWith('Bearer ') || authorization.length > 8192) return false;
  const jwt = authorization.slice('Bearer '.length);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) return false;
  const received = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jwt)),
  );
  let difference = 0;
  for (let index = 0; index < received.length; index++) {
    const expectedByte = Number.parseInt(expectedSha256.slice(index * 2, index * 2 + 2), 16);
    difference |= received[index] ^ expectedByte;
  }
  return difference === 0;
}
