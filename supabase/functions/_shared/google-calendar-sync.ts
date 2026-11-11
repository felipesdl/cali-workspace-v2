import { z } from 'zod';

export type CalendarMeeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  mode: 'remote' | 'in_person';
  meetingUrl: string | null;
};

export type CalendarEventResult = {
  id: string;
  hangoutLink?: string;
  htmlLink?: string;
};

const calendarEventResult = z.object({
  id: z.string().min(1),
  hangoutLink: z.string().optional(),
  htmlLink: z.string().optional(),
});

export function stableGoogleEventId(eventId: string) {
  return `cali${eventId.replace(/-/g, '').toLowerCase()}`;
}

export function googleEventBody(event: CalendarMeeting) {
  const conferenceData =
    event.mode === 'remote' && !event.meetingUrl
      ? {
          createRequest: {
            requestId: `cali-meet-${event.id.replace(/-/g, '')}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        }
      : undefined;
  return {
    summary: event.title,
    start: { dateTime: event.startsAt },
    end: { dateTime: event.endsAt },
    extendedProperties: { private: { caliWorkspaceEventId: event.id } },
    description: event.description || undefined,
    location: event.location || undefined,
    conferenceData,
  };
}

function eventUrl(calendarId: string, eventId?: string) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

export async function syncGoogleCalendarEvent(
  event: CalendarMeeting,
  calendarId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
  existingEventId?: string,
): Promise<CalendarEventResult> {
  const googleEventId = existingEventId ?? stableGoogleEventId(event.id);
  const body = googleEventBody(event);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const query = '?sendUpdates=none&conferenceDataVersion=1';
  let response = await fetcher(`${eventUrl(calendarId)}${query}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, id: googleEventId }),
  });
  let result = calendarEventResult.safeParse(await response.json().catch(() => ({})));
  if (response.status === 409) {
    response = await fetcher(`${eventUrl(calendarId, googleEventId)}${query}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    result = calendarEventResult.safeParse(await response.json().catch(() => ({})));
  }
  if (!response.ok || !result.success || result.data.id !== googleEventId)
    throw new Error('google_calendar_sync_failed');
  return result.data;
}

export async function deleteGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${eventUrl(calendarId, eventId)}?sendUpdates=none`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error('google_calendar_delete_failed');
}
