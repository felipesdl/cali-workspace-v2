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

it('expõe retry quando o lease do evento já está ocupado', async () => {
  const transport = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles') && url.searchParams.get('id')?.includes(otherCompany))
      return Response.json({ id: otherCompany, role: 'admin', active: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role: 'admin', company_id: null, active: true });
    if (url.pathname.endsWith('/scheduling_requests'))
      return Response.json([
        {
          id: appointmentId,
          company_id: company,
          status: 'confirmed',
          confirmed_event_id: event,
          request_mode: 'remote',
          extra_visit: false,
          billable_extra: false,
          urgency_fee_applies: false,
          online_extra_requested: false,
        },
      ]);
    if (url.pathname.endsWith('/v2_agenda_calendar_lease'))
      return Response.json({ acquired: false, retryAfterSeconds: 12 });
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
      headers: { origin, authorization: `Bearer fixture.${btoa('{"aal":"aal2"}')}.fixture` },
      body: JSON.stringify({ action: 'sync_appointment', appointmentId }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'busy', retryAfterSeconds: 12 });
  expect(transport.mock.calls.some(([url]) => String(url).includes('www.googleapis.com'))).toBe(
    false,
  );
});

it('remove do Google apenas a visita extra cancelada e vinculada ao pedido', async () => {
  const changedAt = '2026-11-11T12:00:00.000Z';
  const extraAppointment = {
    id: appointmentId,
    company_id: company,
    status: 'cancelled',
    confirmed_event_id: null,
    request_mode: 'in_person',
    extra_visit: true,
    billable_extra: true,
    urgency_fee_applies: false,
    online_extra_requested: false,
    online_extra_quote_accepted_at: null,
    extra_visit_change_kind: 'cancel',
    extra_visit_change_was_confirmed: true,
    extra_visit_change_at: changedAt,
  };
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles') && url.searchParams.get('id')?.includes(otherCompany))
      return Response.json({ id: otherCompany, role: 'admin', active: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role: 'client', company_id: company, active: true });
    if (url.pathname.endsWith('/v2_agenda_calendar_lease')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { p_action?: string };
      return Response.json(
        body.p_action === 'acquire'
          ? { acquired: true, token: '10000000-0000-4000-8000-000000000099' }
          : { released: true },
      );
    }
    if (url.pathname.endsWith('/scheduling_requests')) return Response.json([extraAppointment]);
    if (url.pathname.endsWith('/events') && method === 'PATCH')
      return Response.json([{ id: event }]);
    if (url.pathname.endsWith('/events')) {
      if (url.searchParams.get('select') === 'id') return Response.json([{ id: event }]);
      return Response.json([
        {
          id: event,
          company_id: company,
          title: 'Visita presencial',
          description: null,
          location: null,
          starts_at: '2026-12-01T12:00:00Z',
          ends_at: '2026-12-01T13:00:00Z',
          mode: 'in_person',
          event_type: 'meeting',
          visibility: 'client',
          schedule_class: 'extra',
          source_type: 'scheduling_request',
          source_entity_id: appointmentId,
          cancelled_at: changedAt,
          google_calendar_id: 'test-calendar',
          google_event_id: 'confirmed-extra-google-id',
          meeting_url: null,
        },
      ]);
    }
    if (url.pathname.endsWith('/calendar_connections'))
      return Response.json([
        {
          id: connection,
          user_id: otherCompany,
          company_id: null,
          provider: 'google',
          status: 'connected',
          sync_enabled: true,
          is_primary: true,
          account_email: 'calendar@example.test',
          calendar_id: 'test-calendar',
          credential_key: 'fixture',
        },
      ]);
    if (url.pathname.endsWith('/google_calendar_credentials'))
      return Response.json([
        {
          access_token: 'fixture-access-token',
          refresh_token: 'fixture-refresh-token',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          expires_at: '2099-01-01T00:00:00Z',
        },
      ]);
    if (url.hostname === 'www.googleapis.com') return new Response(null, { status: 204 });
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
      body: JSON.stringify({ action: 'sync_extra_cancellation', appointmentId }),
    }),
  );
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  expect(await response.json()).toEqual({ status: 'cancelled_google' });
  const googleDelete = transport.mock.calls.find(([input]) =>
    String(input).includes('www.googleapis.com'),
  );
  expect(googleDelete?.[1]?.method).toBe('DELETE');
  expect(String(googleDelete?.[0])).toContain('/events/confirmed-extra-google-id');
});

it.each([
  { role: 'admin', appointmentCompany: company, error: 'admin_mfa_required' },
  { role: 'client', appointmentCompany: otherCompany, error: 'event_access_denied' },
  { role: 'client', appointmentCompany: company, error: 'calendar_target_mismatch' },
])('recusa $error sem chamar o Google', async ({ role, appointmentCompany, error }) => {
  const transport = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname.endsWith('/v2_agenda_calendar_lease'))
      return Response.json({ acquired: true, token: '10000000-0000-4000-8000-000000000099' });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role, company_id: company, active: true });
    if (url.pathname.endsWith('/scheduling_requests'))
      return Response.json([
        {
          id: appointmentId,
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
    if (url.hostname === 'supabase.example.test' && url.pathname.endsWith('/events'))
      return Response.json([
        {
          id: event,
          company_id: company,
          title: 'Encontro de teste',
          mode: 'remote',
          event_type: 'meeting',
          visibility: 'client',
          schedule_class: 'contractual',
          source_type: 'scheduling_request',
          source_entity_id: appointmentId,
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

it('preserva vínculo evento/calendário existente no destino isolado', async () => {
  const legacyGoogleId = 'existing-google-event-42';
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname.endsWith('/v2_agenda_calendar_lease')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { p_action?: string };
      return Response.json(
        body.p_action === 'acquire'
          ? { acquired: true, token: '10000000-0000-4000-8000-000000000099' }
          : { released: true },
      );
    }
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role: 'admin', company_id: null, active: true });
    if (url.pathname.endsWith('/scheduling_requests'))
      return Response.json([
        {
          id: appointmentId,
          company_id: company,
          status: 'confirmed',
          confirmed_event_id: event,
          request_mode: 'remote',
          extra_visit: false,
          billable_extra: false,
          urgency_fee_applies: false,
          online_extra_requested: false,
        },
      ]);
    if (
      url.hostname === 'supabase.example.test' &&
      url.pathname.endsWith('/events') &&
      method === 'PATCH'
    )
      return Response.json([{ id: event }]);
    if (url.hostname === 'supabase.example.test' && url.pathname.endsWith('/events'))
      return Response.json([
        {
          id: event,
          company_id: company,
          title: 'Reunião sintética',
          mode: 'remote',
          event_type: 'meeting',
          visibility: 'client',
          schedule_class: 'contractual',
          source_type: 'scheduling_request',
          source_entity_id: appointmentId,
          description: null,
          location: null,
          starts_at: '2026-12-01T12:00:00Z',
          ends_at: '2026-12-01T13:00:00Z',
          cancelled_at: null,
          google_calendar_id: 'test-calendar',
          google_event_id: legacyGoogleId,
          meeting_url: null,
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
          calendar_id: 'test-calendar',
          credential_key: 'fixture',
        },
      ]);
    if (url.pathname.endsWith('/google_calendar_credentials'))
      return Response.json([
        {
          access_token: 'fixture-access-token',
          refresh_token: 'fixture-refresh-token',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          expires_at: '2099-01-01T00:00:00Z',
        },
      ]);
    if (url.hostname === 'www.googleapis.com') {
      if (method === 'POST') return Response.json({ error: 'duplicate' }, { status: 409 });
      expect(url.pathname).toContain(`/events/${legacyGoogleId}`);
      return Response.json({
        id: legacyGoogleId,
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
      });
    }
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
      headers: { origin, authorization: `Bearer fixture.${btoa('{"aal":"aal2"}')}.fixture` },
      body: JSON.stringify({ action: 'sync_appointment', appointmentId }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: 'synced',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
  });
  const googleCalls = transport.mock.calls.filter(([input]) =>
    String(input).includes('www.googleapis.com'),
  );
  expect(googleCalls).toHaveLength(2);
  expect(googleCalls[0]?.[1]?.method).toBe('POST');
  expect(JSON.parse(String(googleCalls[0]?.[1]?.body))).toHaveProperty('id', legacyGoogleId);
  expect(googleCalls[1]?.[1]?.method).toBe('PATCH');
  expect(JSON.parse(String(googleCalls[1]?.[1]?.body))).not.toHaveProperty('id');
});

it.each([
  {
    title: 'visita presencial extra sem criar Meet',
    requestMode: 'in_person',
    extraVisit: true,
    billableExtra: true,
    onlineExtra: false,
    quoteAcceptedAt: null,
    expectMeet: false,
    expectAllowed: true,
  },
  {
    title: 'reunião online extra aceita com Meet e sem convidados',
    requestMode: 'remote',
    extraVisit: false,
    billableExtra: true,
    onlineExtra: true,
    quoteAcceptedAt: '2026-11-10T15:00:00Z',
    expectMeet: true,
    expectAllowed: true,
  },
  {
    title: 'rejeita reunião online extra sem aceite de orçamento',
    requestMode: 'remote',
    extraVisit: false,
    billableExtra: true,
    onlineExtra: true,
    quoteAcceptedAt: null,
    expectMeet: false,
    expectAllowed: false,
  },
])('sincroniza $title', async (scenario) => {
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname.endsWith('/v2_agenda_calendar_lease')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { p_action?: string };
      return Response.json(
        body.p_action === 'acquire'
          ? { acquired: true, token: '10000000-0000-4000-8000-000000000099' }
          : { released: true },
      );
    }
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor });
    if (url.pathname.endsWith('/v2_read_terms_state')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/profiles'))
      return Response.json({ id: actor, role: 'admin', company_id: null, active: true });
    if (url.pathname.endsWith('/scheduling_requests'))
      return Response.json([
        {
          id: appointmentId,
          company_id: company,
          status: 'confirmed',
          confirmed_event_id: event,
          request_mode: scenario.requestMode,
          extra_visit: scenario.extraVisit,
          billable_extra: scenario.billableExtra,
          urgency_fee_applies: false,
          online_extra_requested: scenario.onlineExtra,
          online_extra_quote_accepted_at: scenario.quoteAcceptedAt,
        },
      ]);
    if (
      url.hostname === 'supabase.example.test' &&
      url.pathname.endsWith('/events') &&
      method === 'PATCH'
    )
      return Response.json([{ id: event }]);
    if (url.hostname === 'supabase.example.test' && url.pathname.endsWith('/events'))
      return Response.json([
        {
          id: event,
          company_id: company,
          title: 'Reunião extra sintética',
          description: null,
          location: null,
          starts_at: '2026-12-01T12:00:00Z',
          ends_at: '2026-12-01T13:00:00Z',
          mode: scenario.requestMode,
          event_type: 'meeting',
          visibility: 'client',
          schedule_class: 'extra',
          source_type: 'scheduling_request',
          source_entity_id: appointmentId,
          cancelled_at: null,
          google_calendar_id: null,
          google_event_id: null,
          meeting_url: null,
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
          calendar_id: 'test-calendar',
          credential_key: 'fixture',
        },
      ]);
    if (url.pathname.endsWith('/google_calendar_credentials'))
      return Response.json([
        {
          access_token: 'fixture-access-token',
          refresh_token: 'fixture-refresh-token',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          expires_at: '2099-01-01T00:00:00Z',
        },
      ]);
    if (url.hostname === 'www.googleapis.com')
      return Response.json({
        id: 'cali' + event.replace(/-/g, ''),
        ...(scenario.expectMeet ? { hangoutLink: 'https://meet.google.com/abc-defg-hij' } : {}),
      });
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
      headers: { origin, authorization: `Bearer fixture.${btoa('{"aal":"aal2"}')}.fixture` },
      body: JSON.stringify({ action: 'sync_appointment', appointmentId }),
    }),
  );

  if (!scenario.expectAllowed) {
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'unsupported_agenda_item' });
    expect(
      transport.mock.calls.every(([input]) => String(input).includes('supabase.example.test')),
    ).toBe(true);
    return;
  }

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: 'synced',
    meetingUrl: scenario.expectMeet ? 'https://meet.google.com/abc-defg-hij' : null,
  });
  const googleCall = transport.mock.calls.find(([input]) =>
    String(input).includes('www.googleapis.com'),
  );
  expect(googleCall?.[1]?.method).toBe('POST');
  const googleBody = JSON.parse(String(googleCall?.[1]?.body));
  if (scenario.expectMeet)
    expect(googleBody.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
  else expect(googleBody.conferenceData).toBeUndefined();
  expect(googleBody).not.toHaveProperty('attendees');
  expect(googleBody).not.toHaveProperty('attendeeEmails');
});
