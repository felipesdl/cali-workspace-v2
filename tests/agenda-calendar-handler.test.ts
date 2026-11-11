// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createAgendaCalendarHandler } from '../supabase/functions/workspace-agenda-calendar/handler';

const actor = '10000000-0000-4000-8000-000000000001';
const company = '10000000-0000-4000-8000-000000000002';
const otherCompany = '10000000-0000-4000-8000-000000000003';
const appointmentId = '10000000-0000-4000-8000-000000000004';
const event = '10000000-0000-4000-8000-000000000005';
const connection = '10000000-0000-4000-8000-000000000006';
const origin = 'https://cali-qa.vercel.app';

it.each([
  { role: 'admin', appointmentCompany: company, error: 'admin_mfa_required' },
  { role: 'client', appointmentCompany: otherCompany, error: 'event_access_denied' },
  { role: 'client', appointmentCompany: company, error: 'calendar_target_mismatch' },
])('recusa $error sem chamar o Google', async ({ role, appointmentCompany, error }) => {
  const transport = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role, company_id: company, active: true });
    if (url.pathname.endsWith('/scheduling_requests'))
      return Response.json([
        {
          company_id: appointmentCompany,
          status: 'confirmed',
          confirmed_event_id: event,
          request_mode: 'remote',
          extra_visit: false,
          billable_extra: false,
          urgency_fee_applies: false,
          online_extra_requested: false,
        },
      ]);
    if (url.pathname.endsWith('/events'))
      return Response.json([
        {
          id: event,
          company_id: company,
          title: 'Encontro de teste',
          starts_at: '2026-12-01T12:00:00Z',
          ends_at: '2026-12-01T13:00:00Z',
          cancelled_at: null,
          google_event_id: null,
        },
      ]);
    if (url.pathname.endsWith('/calendar_connections'))
      return Response.json([
        {
          id: connection,
          user_id: actor,
          company_id: null,
          provider: 'google',
          status: 'connected',
          sync_enabled: true,
          is_primary: true,
          account_email: 'calendar@example.test',
          calendar_id: 'calendar-fora-do-teste',
          credential_key: 'fixture',
        },
      ]);
    return new Response(null, { status: 500 });
  });
  const handle = createAgendaCalendarHandler(
    {
      project: 'https://supabase.example.test',
      anon: 'public-fixture',
      service: 'service-fixture',
      clientId: 'calendar-fixture',
      clientSecret: 'oauth-fixture',
      calendarConnectionId: connection,
      testCalendarId: 'test-calendar',
      origins: [origin],
    },
    transport,
  );
  const response = await handle(
    new Request(`${origin}/functions/v1/workspace-agenda-calendar`, {
      method: 'POST',
      headers: { origin, authorization: `Bearer fixture.${btoa('{"aal":"aal1"}')}.fixture` },
      body: JSON.stringify({ action: 'sync_appointment', appointmentId }),
    }),
  );

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error });
  expect(transport.mock.calls.every(([url]) => String(url).includes('supabase.example.test'))).toBe(
    true,
  );
});
