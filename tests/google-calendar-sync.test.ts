import { describe, expect, it } from 'vitest';
import {
  deleteGoogleCalendarEvent,
  googleEventBody,
  stableGoogleEventId,
  syncGoogleCalendarEvent,
  type CalendarMeeting,
} from '../supabase/functions/_shared/google-calendar-sync';

const meeting: CalendarMeeting = {
  id: '2f43a222-cfd4-4c8e-b8a9-a37f0c46f52b',
  title: 'Reunião de homologação',
  description: 'Fixture sem dados pessoais',
  location: null,
  startsAt: '2026-11-17T13:00:00Z',
  endsAt: '2026-11-17T14:00:00Z',
  mode: 'remote',
  meetingUrl: null,
};

describe('sincronização Agenda Google simulada', () => {
  it('cria Meet sem participantes e converge retries pelo mesmo ID', async () => {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    let created = false;
    const fetcher: typeof fetch = async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? init.body : '';
      requests.push({ url, method, body });
      if (method === 'POST' && !created) {
        created = true;
        return Response.json({ id: stableGoogleEventId(meeting.id) });
      }
      if (method === 'POST') return Response.json({ error: 'duplicate' }, { status: 409 });
      if (method === 'PATCH') return Response.json({ id: stableGoogleEventId(meeting.id) });
      throw new Error(`Método inesperado: ${method}`);
    };

    const first = await syncGoogleCalendarEvent(meeting, 'test-calendar', 'fixture-token', fetcher);
    const second = await syncGoogleCalendarEvent(
      meeting,
      'test-calendar',
      'fixture-token',
      fetcher,
    );
    const body = googleEventBody(meeting);

    expect(first.id).toBe(stableGoogleEventId(meeting.id));
    expect(second.id).toBe(first.id);
    expect(body.conferenceData?.createRequest.requestId).toBe(
      `cali-meet-${meeting.id.replace(/-/g, '')}`,
    );
    expect(body).not.toHaveProperty('attendees');
    expect(requests).toHaveLength(3);
    expect(requests.every(({ url }) => url.includes('sendUpdates=none'))).toBe(true);
    expect(requests[0].method).toBe('POST');
    expect(JSON.parse(requests[0].body)).toHaveProperty('id', first.id);
    expect(requests[2].method).toBe('PATCH');
    expect(JSON.parse(requests[2].body)).not.toHaveProperty('id');
  });

  it('cancela sem enviar notificações e aceita evento já removido', async () => {
    const urls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response(null, { status: 410 });
    };

    await deleteGoogleCalendarEvent(
      'test-calendar',
      stableGoogleEventId(meeting.id),
      'fixture-token',
      fetcher,
    );
    expect(urls[0]).toContain('sendUpdates=none');
  });
});
