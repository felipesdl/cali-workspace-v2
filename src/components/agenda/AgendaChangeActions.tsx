import { useState } from 'react';
import { Input, Select, TextArea } from '../ds/field/Controls';
import { Button } from '../ds/button/Button';
import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { type AgendaOperations, type AppointmentChange } from '../../api/shared/workspace/agenda';
import { Field } from '../ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from '../workspace/ActionForm';

const read = (fields: FormData, name: string) => String(fields.get(name) ?? '');
const options = [
  { id: 'first', number: 1 },
  { id: 'second', number: 2 },
] as const;
const changeStatus = { pending: 'Em análise', approved: 'Aprovada', declined: 'Recusada' } as const;
type CalendarFeedback = { tone: 'success' | 'error'; message: string };

function calendarStatusMessage(status: string) {
  const messages: Record<string, string> = {
    synced: 'Google Calendar atualizado. O link Meet pode levar alguns instantes para aparecer.',
    cancelled_google: 'Cancelamento atualizado no Google Calendar.',
    not_synced: 'Nenhum evento Google anterior encontrado.',
    not_approved: 'A alteração CALI ainda não foi aprovada.',
    cancelled_local: 'Evento CALI cancelado; sincronização Google não foi aplicada.',
    disabled: 'Sincronização Google desligada neste ambiente.',
    busy: 'Outra sincronização está em andamento. Tente novamente em instantes.',
  };
  return messages[status] ?? 'Google Calendar precisa de revisão.';
}

function Reason({ prefix, label }: { prefix: string; label: string }) {
  return (
    <Field id={prefix + 'reason'} label={label}>
      <TextArea id={prefix + 'reason'} name="reason" minLength={5} maxLength={2000} required />
    </Field>
  );
}

export function AgendaChangeActions({
  company,
  appointment,
  admin,
  eligible,
  active,
  change,
  agenda,
  refresh,
}: {
  company: string;
  appointment: string;
  admin: boolean;
  eligible: boolean;
  active: boolean;
  change?: AppointmentChange | null;
  agenda: AgendaOperations;
  refresh: (id: string) => Promise<string>;
}) {
  const [calendarFeedback, setCalendarFeedback] = useState<CalendarFeedback | null>(null);
  const [calendarRetry, setCalendarRetry] = useState(false);
  const pending = change?.status === 'pending';
  const label = change?.action === 'reschedule' ? 'Remarcação' : 'Cancelamento';
  async function retryCalendarChange() {
    if (!change) return;
    setCalendarRetry(true);
    setCalendarFeedback(null);
    try {
      const result = await agenda.syncApprovedCalendarChange(change.id);
      setCalendarFeedback({
        tone:
          result.status === 'synced' ||
          result.status === 'cancelled_google' ||
          result.status === 'disabled'
            ? 'success'
            : 'error',
        message: `Decisão CALI preservada. ${calendarStatusMessage(result.status)}`,
      });
    } catch {
      setCalendarFeedback({
        tone: 'error',
        message:
          'Decisão CALI preservada. Google Calendar não sincronizou; confira a conexão ou tente novamente.',
      });
    } finally {
      setCalendarRetry(false);
      await refresh(change.id);
    }
  }
  return (
    <>
      {calendarFeedback && (
        <FeedbackMessage tone={calendarFeedback.tone}>{calendarFeedback.message}</FeedbackMessage>
      )}
      {change && (
        <div className="tw:grid tw:gap-2">
          <p>
            {label} · {changeStatus[change.status]}
          </p>
          <p className="tw:break-words">Motivo: {change.reason}</p>
          {change.note && <p className="tw:break-words">Decisão da CALI: {change.note}</p>}
          {admin && change.status === 'approved' && agenda.calendarSyncEnabled && (
            <Button
              variant="secondary"
              pending={calendarRetry}
              onClick={() => void retryCalendarChange()}
            >
              Tentar sincronização Google
            </Button>
          )}
          {admin && pending && active && (
            <>
              {eligible && (
                <ActionForm
                  label={`Aprovar ${label.toLowerCase()}`}
                  submit={async (fields) => {
                    const saved = await agenda.decideChange(
                      company,
                      change.id,
                      true,
                      read(fields, 'reason'),
                      change.action === 'reschedule' ? Number(read(fields, 'slot')) : null,
                    );
                    try {
                      const integration = await agenda.syncApprovedCalendarChange(change.id);
                      setCalendarFeedback({
                        tone: ['synced', 'cancelled_google', 'not_synced', 'disabled'].includes(
                          integration.status,
                        )
                          ? 'success'
                          : 'error',
                        message: `Decisão CALI aprovada. ${calendarStatusMessage(integration.status)}`,
                      });
                    } catch {
                      setCalendarFeedback({
                        tone: 'error',
                        message:
                          'Decisão CALI aprovada. Google Calendar não sincronizou; confira a conexão ou tente novamente.',
                      });
                    }
                    return refresh(saved);
                  }}
                >
                  {(prefix) => (
                    <>
                      {change.action === 'reschedule' && (
                        <Field id={prefix + 'slot'} label="Novo horário">
                          <Select id={prefix + 'slot'} name="slot" defaultValue="" required>
                            <option value="" disabled>
                              Selecione
                            </option>
                            {change.slots.map((slot, index) => (
                              <option key={slot.startsAt} value={index}>
                                {formatServerInstant(slot.startsAt)} até{' '}
                                {formatServerInstant(slot.endsAt)}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}
                      <Reason prefix={prefix} label="Explique a decisão" />
                    </>
                  )}
                </ActionForm>
              )}
              <ActionForm
                label={`Recusar ${label.toLowerCase()}`}
                submit={async (fields) =>
                  refresh(
                    await agenda.decideChange(
                      company,
                      change.id,
                      false,
                      read(fields, 'reason'),
                      null,
                    ),
                  )
                }
              >
                {(prefix) => <Reason prefix={prefix} label="Explique a decisão" />}
              </ActionForm>
            </>
          )}
        </div>
      )}
      {!admin && eligible && !pending && (
        <details>
          <summary>Solicitar alteração da reunião</summary>
          <div className="tw:mt-3 tw:grid tw:gap-3">
            <p>A reunião continua no horário atual até a CALI aprovar a alteração.</p>
            <ActionForm
              label="Pedir cancelamento"
              submit={async (fields, id) =>
                refresh(
                  await agenda.requestChange(
                    company,
                    appointment,
                    id,
                    'cancel',
                    read(fields, 'reason'),
                    [],
                  ),
                )
              }
            >
              {(prefix) => <Reason prefix={prefix} label="Motivo do cancelamento" />}
            </ActionForm>
            <ActionForm
              label="Pedir remarcação"
              submit={async (fields, id) =>
                refresh(
                  await agenda.requestChange(
                    company,
                    appointment,
                    id,
                    'reschedule',
                    read(fields, 'reason'),
                    [1, 2].map((index) => ({
                      start: read(fields, `start${index}`),
                      end: read(fields, `end${index}`),
                    })),
                  ),
                )
              }
            >
              {(prefix) => (
                <>
                  <Reason prefix={prefix} label="Motivo da remarcação" />
                  <p>
                    Use o horário de Brasília. Informe duas opções em dias úteis, das 9h às 16h, com
                    a duração original e 48 horas em dias de semana de antecedência.
                  </p>
                  {options.map(({ id, number: index }) => (
                    <div key={id} className="tw:grid tw:gap-2 tw:wide:grid-cols-2">
                      <Field id={prefix + 'start' + index} label={`Início da opção ${index}`}>
                        <Input
                          id={prefix + 'start' + index}
                          name={`start${index}`}
                          type="datetime-local"
                          required
                        />
                      </Field>
                      <Field id={prefix + 'end' + index} label={`Fim da opção ${index}`}>
                        <Input
                          id={prefix + 'end' + index}
                          name={`end${index}`}
                          type="datetime-local"
                          required
                        />
                      </Field>
                    </div>
                  ))}
                </>
              )}
            </ActionForm>
          </div>
        </details>
      )}
    </>
  );
}
