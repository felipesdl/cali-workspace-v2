import { describe, expect, it, vi } from 'vitest';
import { createAgendaOperations } from '../src/api/shared/workspace/agenda';
import { createWorkspaceClient } from '../src/api/supabase';

describe('consumidor V2 da sincronização Google Calendar', () => {
  it('envia apenas ID da decisão já confirmada, nunca participantes', async () => {
    const client = createWorkspaceClient('https://qa.invalid', 'sb_publishable_test');
    const invoke = vi.fn(async () => ({
      data: { status: 'synced', meetingUrl: 'https://meet.google.com/abc-defg-hij' },
      error: null,
    }));
    Object.defineProperty(client, 'functions', { value: { invoke } });
    const agenda = createAgendaOperations(client, true);
    const appointmentId = '2f43a222-cfd4-4c8e-b8a9-a37f0c46f52b';

    expect(await agenda.syncConfirmedCalendar(appointmentId)).toEqual({
      status: 'synced',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(invoke).toHaveBeenCalledExactlyOnceWith('workspace-agenda-calendar', {
      body: { action: 'sync_appointment', appointmentId },
    });
  });

  it('mantém integração desligada fora do runtime explicitamente habilitado', async () => {
    const client = createWorkspaceClient('https://qa.invalid', 'sb_publishable_test');
    const invoke = vi.fn();
    Object.defineProperty(client, 'functions', { value: { invoke } });
    const agenda = createAgendaOperations(client);

    expect(await agenda.syncApprovedCalendarChange('2f43a222-cfd4-4c8e-b8a9-a37f0c46f52b')).toEqual(
      {
        status: 'disabled',
      },
    );
    expect(invoke).not.toHaveBeenCalled();
  });
});
