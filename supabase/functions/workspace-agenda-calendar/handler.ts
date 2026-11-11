import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  deleteGoogleCalendarEvent,
  stableGoogleEventId,
  syncGoogleCalendarEvent,
  type CalendarMeeting,
} from '../_shared/google-calendar-sync.ts';

const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync_appointment'), appointmentId: z.uuid() }),
  z.object({ action: z.literal('sync_change'), changeId: z.uuid() }),
  z.object({ action: z.literal('sync_extra_cancellation'), appointmentId: z.uuid() }),
]);
const profileSchema = z.object({
  id: z.uuid(),
  role: z.enum(['admin', 'client']),
  company_id: z.uuid().nullable(),
  active: z.literal(true),
});
const appointmentSchema = z.object({
  id: z.uuid(),
  company_id: z.uuid(),
  status: z.string().optional(),
  confirmed_event_id: z.uuid().nullable().optional(),
  request_mode: z.enum(['remote', 'in_person']),
  extra_visit: z.boolean(),
  billable_extra: z.boolean(),
  urgency_fee_applies: z.boolean(),
  online_extra_requested: z.boolean(),
  online_extra_quote_accepted_at: z.string().nullable().optional(),
  extra_visit_change_kind: z.enum(['cancel', 'reschedule']).nullable().optional(),
  extra_visit_change_was_confirmed: z.boolean().nullable().optional(),
  extra_visit_change_at: z.string().nullable().optional(),
});
const changeSchema = z.object({
  id: z.uuid(),
  company_id: z.uuid(),
  event_id: z.uuid(),
  action: z.enum(['cancel', 'reschedule']),
  status: z.string(),
});
const eventSchema = z.object({
  id: z.uuid(),
  company_id: z.uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  mode: z.enum(['remote', 'in_person']),
  event_type: z.string(),
  visibility: z.string(),
  schedule_class: z.string().nullable().optional(),
  source_type: z.string().nullable().optional(),
  source_entity_id: z.uuid().nullable().optional(),
  cancelled_at: z.string().nullable(),
  google_calendar_id: z.string().nullable().optional(),
  google_event_id: z.string().nullable(),
  meeting_url: z.string().nullable().optional(),
});
const connectionSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  company_id: z.uuid().nullable(),
  provider: z.literal('google'),
  status: z.literal('connected'),
  sync_enabled: z.literal(true),
  is_primary: z.literal(true),
  account_email: z.email(),
  calendar_id: z.string(),
  credential_key: z.string(),
});
const credentialSchema = z.object({
  access_token: z.string().nullable(),
  refresh_token: z.string(),
  scope: z.string().nullable(),
  expires_at: z.string().nullable(),
});
const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number().optional() });
const leaseSchema = z.discriminatedUnion('acquired', [
  z.object({ acquired: z.literal(true), token: z.uuid() }),
  z.object({ acquired: z.literal(false), retryAfterSeconds: z.number().int().positive() }),
]);
const aalClaims = z.object({ aal: z.enum(['aal1', 'aal2']) });

type Config = {
  project: string;
  anon: string;
  service: string;
  clientId: string;
  clientSecret: string;
  calendarConnectionId: string;
  testCalendarId: string;
  origins: string[];
};

function decodeClaims(authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').split('.')[1];
  if (!token) return null;
  try {
    const payload = token.replace(/-/g, '+').replace(/_/g, '/');
    const claims = aalClaims.safeParse(
      JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4))),
    );
    return claims.success ? claims.data : null;
  } catch {
    return null;
  }
}

export function createAgendaCalendarHandler(config: Config, transport: typeof fetch = fetch) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? '';
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'Access-Control-Allow-Origin': config.origins.includes(origin) ? origin : config.origins[0],
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    const reply = (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !config.origins.includes(origin))
      return reply({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return reply({ error: 'invalid_session' }, 401);
    if (
      !config.calendarConnectionId ||
      !config.testCalendarId ||
      config.testCalendarId === 'primary'
    )
      return reply({ error: 'test_calendar_not_configured' }, 503);

    const authOptions = {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    };
    const boundedTransport: typeof fetch = (input, init = {}) =>
      transport(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(25000),
        redirect: 'error',
      });
    const user = createClient(config.project, config.anon, {
      auth: authOptions,
      db: { schema: 'cali_workspace' },
      global: { headers: { Authorization: authorization }, fetch: boundedTransport },
    });
    const root = createClient(config.project, config.service, {
      auth: authOptions,
      db: { schema: 'cali_workspace' },
      global: { fetch: boundedTransport },
    });
    let heldLease: { eventId: string; token: string } | null = null;

    try {
      const input = command.parse(await request.json());
      const { data: session, error: authError } = await user.auth.getUser();
      if (authError || !session.user) return reply({ error: 'invalid_session' }, 401);
      const accepted = await user.rpc('v2_read_terms_state');
      if (!z.object({ accepted: z.literal(true) }).safeParse(accepted.data).success)
        return reply({ error: 'session_not_admitted' }, 403);
      const profileResult = await root
        .from('profiles')
        .select('id,role,company_id,active')
        .eq('id', session.user.id)
        .single();
      const profile = profileSchema.safeParse(profileResult.data);
      if (!profile.success) return reply({ error: 'profile_not_available' }, 403);
      if (profile.data.role === 'admin' && decodeClaims(authorization)?.aal !== 'aal2')
        return reply({ error: 'admin_mfa_required' }, 403);

      let companyId = '';
      let eventId = '';
      let appointmentIdForEvent = '';
      let meetingMode: 'remote' | 'in_person' = 'remote';
      let expectedScheduleClass = 'contractual';
      let shouldCancel = false;
      if (input.action === 'sync_appointment' || input.action === 'sync_extra_cancellation') {
        let query = root
          .from('scheduling_requests')
          .select(
            'id,company_id,status,confirmed_event_id,request_mode,extra_visit,billable_extra,urgency_fee_applies,online_extra_requested,online_extra_quote_accepted_at,extra_visit_change_kind,extra_visit_change_was_confirmed,extra_visit_change_at',
          )
          .eq('id', input.appointmentId);
        if (profile.data.role === 'client') {
          if (!profile.data.company_id) return reply({ error: 'event_access_denied' }, 403);
          query = query.eq('company_id', profile.data.company_id);
        }
        const result = await query.maybeSingle();
        const parsed = appointmentSchema.safeParse(result.data);
        if (!parsed.success) return reply({ status: 'not_confirmed' });
        const appointment = parsed.data;
        if (input.action === 'sync_extra_cancellation') {
          if (
            profile.data.role !== 'client' ||
            !['cancelled', 'reschedule_review'].includes(appointment.status ?? '') ||
            !appointment.extra_visit ||
            !appointment.extra_visit_change_was_confirmed ||
            !appointment.extra_visit_change_at ||
            !appointment.extra_visit_change_kind
          )
            return reply({ error: 'event_access_denied' }, 403);
          if (profile.data.company_id !== appointment.company_id)
            return reply({ error: 'event_access_denied' }, 403);
          const cancelledEvent = await root
            .from('events')
            .select('id')
            .eq('company_id', appointment.company_id)
            .eq('source_type', 'scheduling_request')
            .eq('source_entity_id', appointment.id)
            .eq('schedule_class', 'extra')
            .eq('cancelled_at', appointment.extra_visit_change_at)
            .maybeSingle();
          const cancelledEventId = z.uuid().safeParse(cancelledEvent.data?.id);
          if (!cancelledEventId.success) return reply({ status: 'not_cancelled' });
          companyId = appointment.company_id;
          eventId = cancelledEventId.data;
          appointmentIdForEvent = appointment.id;
          meetingMode = appointment.request_mode;
          expectedScheduleClass = 'extra';
          shouldCancel = true;
        } else {
          if (profile.data.role === 'client' && profile.data.company_id !== appointment.company_id)
            return reply({ error: 'event_access_denied' }, 403);
          if (appointment.status !== 'confirmed' || !appointment.confirmed_event_id)
            return reply({ status: 'not_confirmed' });
          const ordinaryMeeting =
            !appointment.extra_visit &&
            !appointment.billable_extra &&
            !appointment.urgency_fee_applies &&
            !appointment.online_extra_requested;
          const confirmedInPersonVisit =
            appointment.extra_visit &&
            !appointment.online_extra_requested &&
            appointment.request_mode === 'in_person';
          const acceptedOnlineExtra =
            appointment.online_extra_requested &&
            !appointment.extra_visit &&
            appointment.request_mode === 'remote' &&
            Boolean(appointment.online_extra_quote_accepted_at);
          if (!ordinaryMeeting && !confirmedInPersonVisit && !acceptedOnlineExtra)
            return reply({ error: 'unsupported_agenda_item' }, 403);
          companyId = appointment.company_id;
          eventId = appointment.confirmed_event_id;
          appointmentIdForEvent = appointment.id;
          meetingMode = appointment.request_mode;
          expectedScheduleClass = ordinaryMeeting ? 'contractual' : 'extra';
        }
      } else {
        if (profile.data.role !== 'admin') return reply({ error: 'admin_required' }, 403);
        const result = await root
          .from('agenda_change_requests')
          .select('id,company_id,event_id,action,status')
          .eq('id', input.changeId)
          .maybeSingle();
        const parsed = changeSchema.safeParse(result.data);
        if (!parsed.success || parsed.data.status !== 'approved')
          return reply({ status: 'not_approved' });
        const change = parsed.data;
        companyId = change.company_id;
        eventId = change.event_id;
        shouldCancel = change.action === 'cancel';
        const appointmentResult = await root
          .from('scheduling_requests')
          .select(
            'id,company_id,request_mode,extra_visit,billable_extra,urgency_fee_applies,online_extra_requested,online_extra_quote_accepted_at',
          )
          .eq('company_id', companyId)
          .eq('confirmed_event_id', eventId)
          .maybeSingle();
        const appointment = appointmentSchema.safeParse(appointmentResult.data);
        if (
          !appointment.success ||
          appointment.data.extra_visit ||
          appointment.data.billable_extra ||
          appointment.data.urgency_fee_applies ||
          appointment.data.online_extra_requested
        )
          return reply({ error: 'unsupported_agenda_item' }, 403);
        appointmentIdForEvent = appointment.data.id;
        meetingMode = appointment.data.request_mode;
      }
      const leaseResult = await root.rpc('v2_agenda_calendar_lease', {
        p_event_id: eventId,
        p_action: 'acquire',
        p_token: null,
      });
      const lease = leaseSchema.safeParse(leaseResult.data);
      if (leaseResult.error || !lease.success)
        return reply({ error: 'calendar_lease_unavailable' }, 503);
      if (!lease.data.acquired)
        return reply({ status: 'busy', retryAfterSeconds: lease.data.retryAfterSeconds });
      heldLease = { eventId, token: lease.data.token };

      // Re-read the source after acquiring the lease; pre-lock state is stale by definition.
      if (input.action === 'sync_appointment' || input.action === 'sync_extra_cancellation') {
        const currentResult = await root
          .from('scheduling_requests')
          .select(
            'id,company_id,status,confirmed_event_id,request_mode,extra_visit,billable_extra,urgency_fee_applies,online_extra_requested,online_extra_quote_accepted_at,extra_visit_change_kind,extra_visit_change_was_confirmed,extra_visit_change_at',
          )
          .eq('id', input.appointmentId)
          .eq('company_id', companyId)
          .maybeSingle();
        const current = appointmentSchema.safeParse(currentResult.data);
        if (input.action === 'sync_extra_cancellation') {
          if (
            !current.success ||
            !['cancelled', 'reschedule_review'].includes(current.data.status ?? '') ||
            !current.data.extra_visit ||
            !current.data.extra_visit_change_was_confirmed ||
            !current.data.extra_visit_change_at ||
            !current.data.extra_visit_change_kind ||
            profile.data.company_id !== companyId
          )
            return reply({ status: 'not_cancelled' });
          const currentEvent = await root
            .from('events')
            .select('id')
            .eq('id', eventId)
            .eq('company_id', companyId)
            .eq('source_type', 'scheduling_request')
            .eq('source_entity_id', input.appointmentId)
            .eq('schedule_class', 'extra')
            .eq('cancelled_at', current.data.extra_visit_change_at)
            .maybeSingle();
          if (!currentEvent.data) return reply({ status: 'not_cancelled' });
        } else if (
          !current.success ||
          current.data.status !== 'confirmed' ||
          current.data.confirmed_event_id !== eventId ||
          current.data.request_mode !== meetingMode ||
          (expectedScheduleClass === 'extra' &&
            current.data.online_extra_requested &&
            !current.data.online_extra_quote_accepted_at)
        )
          return reply({ status: 'not_confirmed' });
      } else {
        const currentResult = await root
          .from('agenda_change_requests')
          .select('id,company_id,event_id,action,status')
          .eq('id', input.changeId)
          .maybeSingle();
        const current = changeSchema.safeParse(currentResult.data);
        if (
          !current.success ||
          current.data.status !== 'approved' ||
          current.data.company_id !== companyId ||
          current.data.event_id !== eventId ||
          (current.data.action === 'cancel') !== shouldCancel
        )
          return reply({ status: 'not_approved' });
      }
      const eventResult = await root
        .from('events')
        .select(
          'id,company_id,title,description,location,starts_at,ends_at,mode,event_type,visibility,schedule_class,source_type,source_entity_id,cancelled_at,google_calendar_id,google_event_id,meeting_url',
        )
        .eq('id', eventId)
        .eq('company_id', companyId)
        .maybeSingle();
      const parsedEvent = eventSchema.safeParse(eventResult.data);
      if (!parsedEvent.success) return reply({ error: 'event_not_found' }, 404);
      const event = parsedEvent.data;
      if (
        event.event_type !== 'meeting' ||
        event.visibility !== 'client' ||
        event.source_type !== 'scheduling_request' ||
        event.source_entity_id !== appointmentIdForEvent ||
        event.mode !== meetingMode ||
        event.schedule_class !== expectedScheduleClass
      )
        return reply({ error: 'unsupported_agenda_item' }, 403);
      if (!shouldCancel && event.cancelled_at) return reply({ status: 'cancelled_local' });
      if (shouldCancel && !event.cancelled_at) return reply({ error: 'event_not_cancelled' }, 409);
      const expectedGoogleId = stableGoogleEventId(event.id);
      if (event.google_calendar_id && event.google_calendar_id !== config.testCalendarId)
        return reply({ error: 'calendar_target_mismatch' }, 409);
      if (
        event.google_event_id &&
        event.google_event_id !== expectedGoogleId &&
        !event.google_calendar_id
      )
        return reply({ error: 'legacy_google_event_requires_manual_review' }, 409);

      const connectionResult = await root
        .from('calendar_connections')
        .select(
          'id,user_id,company_id,provider,status,sync_enabled,is_primary,account_email,calendar_id,credential_key',
        )
        .eq('id', config.calendarConnectionId)
        .maybeSingle();
      const parsedConnection = connectionSchema.safeParse(connectionResult.data);
      if (!parsedConnection.success)
        return reply({ error: 'calendar_connection_unavailable' }, 503);
      const connection = parsedConnection.data;
      if (connection.company_id !== null || connection.calendar_id !== config.testCalendarId)
        return reply({ error: 'calendar_target_mismatch' }, 403);
      const ownerResult = await root
        .from('profiles')
        .select('id,role,active')
        .eq('id', connection.user_id)
        .single();
      const owner = z
        .object({ id: z.uuid(), role: z.literal('admin'), active: z.literal(true) })
        .safeParse(ownerResult.data);
      if (!owner.success || (profile.data.role === 'admin' && owner.data.id !== profile.data.id))
        return reply({ error: 'calendar_owner_unavailable' }, 403);

      const credentialResult = await root
        .from('google_calendar_credentials')
        .select('access_token,refresh_token,scope,expires_at')
        .eq('credential_key', connection.credential_key)
        .maybeSingle();
      const parsedCredential = credentialSchema.safeParse(credentialResult.data);
      if (!parsedCredential.success) return reply({ error: 'google_credential_unavailable' }, 503);
      const credential = parsedCredential.data;
      if (!String(credential.scope ?? '').includes('calendar.events'))
        return reply({ error: 'google_calendar_scope_missing' }, 403);

      const googleFetch: typeof fetch = (url, init = {}) =>
        boundedTransport(url, {
          ...init,
          signal: AbortSignal.timeout(25000),
        });
      let accessToken = credential.access_token ?? '';
      if (!accessToken || !(Date.parse(credential.expires_at ?? '') > Date.now() + 60000)) {
        const refreshResponse = await googleFetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: credential.refresh_token,
            grant_type: 'refresh_token',
          }),
        });
        const refreshed = tokenSchema.safeParse(await refreshResponse.json().catch(() => null));
        if (!refreshResponse.ok || !refreshed.success)
          return reply({ error: 'google_token_refresh_failed' }, 503);
        accessToken = refreshed.data.access_token;
        await root
          .from('google_calendar_credentials')
          .update({
            access_token: accessToken,
            expires_at: new Date(
              Date.now() + (refreshed.data.expires_in ?? 3600) * 1000,
            ).toISOString(),
          })
          .eq('credential_key', connection.credential_key);
      }

      if (shouldCancel) {
        await deleteGoogleCalendarEvent(
          config.testCalendarId,
          event.google_event_id ?? expectedGoogleId,
          accessToken,
          googleFetch,
        );
        let cancellationReceipt = root
          .from('events')
          .update({ sync_status: 'cancelled_google' })
          .eq('id', eventId)
          .eq('company_id', companyId)
          .not('cancelled_at', 'is', null);
        cancellationReceipt = event.google_event_id
          ? cancellationReceipt.eq('google_event_id', event.google_event_id)
          : cancellationReceipt.is('google_event_id', null);
        cancellationReceipt = event.google_calendar_id
          ? cancellationReceipt.eq('google_calendar_id', event.google_calendar_id)
          : cancellationReceipt.is('google_calendar_id', null);
        const { data: cancelledEvent, error: cancellationError } = await cancellationReceipt
          .select('id')
          .maybeSingle();
        if (cancellationError || !cancelledEvent)
          return reply({ error: 'calendar_cancel_receipt_failed' }, 503);
        return reply({ status: 'cancelled_google' });
      }

      const meeting: CalendarMeeting = {
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        mode: meetingMode,
        meetingUrl: event.meeting_url ?? null,
      };
      const synced = await syncGoogleCalendarEvent(
        meeting,
        config.testCalendarId,
        accessToken,
        googleFetch,
        event.google_event_id ?? undefined,
      );
      const meetingUrl = synced.hangoutLink || meeting.meetingUrl;
      let saveQuery = root
        .from('events')
        .update({
          google_calendar_id: config.testCalendarId,
          google_event_id: synced.id,
          meeting_url: meetingUrl,
          sync_status: 'synced',
        })
        .eq('id', eventId)
        .eq('company_id', companyId)
        .eq('starts_at', event.starts_at)
        .eq('ends_at', event.ends_at)
        .is('cancelled_at', null);
      saveQuery = event.google_event_id
        ? saveQuery.eq('google_event_id', event.google_event_id)
        : saveQuery.is('google_event_id', null);
      saveQuery = event.google_calendar_id
        ? saveQuery.eq('google_calendar_id', event.google_calendar_id)
        : saveQuery.is('google_calendar_id', null);
      const { data: savedEvent, error: saveError } = await saveQuery.select('id').maybeSingle();
      if (saveError || !savedEvent) {
        const latestResult = await root
          .from('events')
          .select('id,cancelled_at')
          .eq('id', eventId)
          .eq('company_id', companyId)
          .maybeSingle();
        if (latestResult.data?.cancelled_at) {
          await deleteGoogleCalendarEvent(
            config.testCalendarId,
            synced.id,
            accessToken,
            googleFetch,
          );
          const compensation = await root
            .from('events')
            .update({
              google_calendar_id: config.testCalendarId,
              google_event_id: synced.id,
              sync_status: 'cancelled_google',
            })
            .eq('id', eventId)
            .eq('company_id', companyId)
            .not('cancelled_at', 'is', null)
            .select('id')
            .maybeSingle();
          if (!compensation.error && compensation.data)
            return reply({ status: 'cancelled_google' });
        }
        return reply({ error: 'calendar_sync_receipt_failed' }, 503);
      }
      return reply({ status: 'synced', meetingUrl });
    } catch {
      return reply({ error: 'calendar_sync_failed' }, 503);
    } finally {
      if (heldLease) {
        try {
          await root.rpc('v2_agenda_calendar_lease', {
            p_event_id: heldLease.eventId,
            p_action: 'release',
            p_token: heldLease.token,
          });
        } catch {
          // TTL reclaims leases after an interrupted request.
        }
      }
    }
  };
}
