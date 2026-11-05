// O gateway continua exigindo JWT. Credencial nova sb_secret_* não é JWT.
export async function matchesSchedulerBearer(authorization: string, serviceRoleJwt: string) {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(serviceRoleJwt)) return false;
  if (!authorization.startsWith('Bearer ') || authorization.length > 8192) return false;
  const encoder = new TextEncoder();
  const [received, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(authorization)),
    crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${serviceRoleJwt}`)),
  ]);
  const left = new Uint8Array(received);
  const right = new Uint8Array(expected);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}
