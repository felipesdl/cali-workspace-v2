import { createAgendaCalendarHandler } from './handler.ts';

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
  createAgendaCalendarHandler({
    project: required('SUPABASE_URL'),
    anon: required('SUPABASE_ANON_KEY'),
    service: required('SUPABASE_SERVICE_ROLE_KEY'),
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    calendarConnectionId: Deno.env.get('CALI_AGENDA_CALENDAR_CONNECTION_ID')?.trim() ?? '',
    testCalendarId: Deno.env.get('CALI_AGENDA_TEST_CALENDAR_ID')?.trim() ?? '',
    origins: required('CALI_ALLOWED_ORIGINS')
      .split(',')
      .map((value) => new URL(value.trim()).origin),
  }),
);
