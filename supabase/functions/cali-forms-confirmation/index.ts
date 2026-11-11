import { createFormConfirmationHandler } from './handler.ts';
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
  createFormConfirmationHandler({
    project: required('SUPABASE_URL'),
    service: required('SUPABASE_SERVICE_ROLE_KEY'),
    resend: required('RESEND_API_KEY'),
    app: new URL(required('CALI_APP_ORIGIN')).origin,
    testRecipients: Deno.env
      .get('CALI_FORMS_TEST_RECIPIENTS')
      ?.split(',')
      .map((email) => email.trim())
      .filter(Boolean),
  }),
);
