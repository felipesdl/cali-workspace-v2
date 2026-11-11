import { createDriveHandler } from './handler.ts';
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};
function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}
Deno.serve(
  createDriveHandler({
    project: required('SUPABASE_URL'),
    anon: required('SUPABASE_ANON_KEY'),
    service: required('SUPABASE_SERVICE_ROLE_KEY'),
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: required('GOOGLE_REDIRECT_URI'),
    origins: required('CALI_ALLOWED_ORIGINS')
      .split(',')
      .map((value) => new URL(value.trim()).origin),
    testAccounts: Deno.env
      .get('CALI_DRIVE_TEST_ACCOUNTS')
      ?.split(',')
      .map((email) => email.trim())
      .filter(Boolean),
  }),
);
