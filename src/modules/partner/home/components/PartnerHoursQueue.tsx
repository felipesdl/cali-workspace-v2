import { Input, Select, TextArea } from '../../../../components/ds/field/Controls';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PartnerPilot } from '../../../../api/partner/pilot';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { formatCalendarDate } from '../../../../lib/dates';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';

const statusLabels = { pending: 'Em análise', approved: 'Aprovada', rejected: 'Recusada' } as const;

export function PartnerHoursQueue({
  api,
  company,
  actor,
  admin,
}: {
  api: PartnerPilot;
  company: string;
  actor?: string;
  admin: boolean;
}) {
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ['partner-hour-requests', actor, company, admin, page],
    queryFn: ({ signal }) => api.hourRequests(company, admin, page, signal),
    refetchInterval: 30000,
  });
  const refresh = () => {
    void queue.refetch();
  };
  return (
    <section aria-label="Solicitações de horas Partner" className="tw:grid tw:gap-3">
      <h2 className="tw:text-section tw:font-semibold">Solicitações de horas Partner</h2>
      {!admin && (
        <ActionForm
          label="Enviar hora manual para revisão"
          saved={refresh}
          submit={(fields, request) =>
            api.submitHours(company, request, {
              day: String(fields.get('day') ?? ''),
              minutes: Number(fields.get('minutes')),
              description: String(fields.get('description') ?? ''),
              justification: String(fields.get('justification') ?? ''),
            })
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'day'} label="Data">
                <Input id={prefix + 'day'} name="day" type="date" required />
              </Field>
              <Field id={prefix + 'minutes'} label="Minutos">
                <Input
                  id={prefix + 'minutes'}
                  name="minutes"
                  type="number"
                  min={1}
                  max={1440}
                  required
                />
              </Field>
              <Field id={prefix + 'description'} label="Trabalho realizado">
                <TextArea
                  id={prefix + 'description'}
                  name="description"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </Field>
              <Field id={prefix + 'justification'} label="Justificativa">
                <TextArea
                  id={prefix + 'justification'}
                  name="justification"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {queue.isPending && <FeedbackState kind="loading">Carregando solicitações…</FeedbackState>}
      {queue.isError && (
        <FeedbackState kind="error" onRetry={refresh}>
          Não foi possível consultar as solicitações.
        </FeedbackState>
      )}
      {queue.isSuccess && (
        <>
          {queue.data.rows.length === 0 && (
            <FeedbackState kind="empty">Nenhuma solicitação nesta página.</FeedbackState>
          )}
          {queue.data.rows.length > 0 && (
            <ul className="tw:grid tw:gap-3">
              {queue.data.rows.map((row) => (
                <li
                  key={row.id}
                  className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
                >
                  <strong>{row.description}</strong>
                  <p>
                    {formatCalendarDate(row.day)} · {row.minutes} min · {statusLabels[row.status]}
                  </p>
                  {row.member_name && <p>{row.member_name}</p>}
                  <p>{row.justification}</p>
                  {!admin && row.recoverable && row.status === 'pending' && (
                    <ActionForm
                      label="Ajustar trecho recuperado"
                      saved={refresh}
                      submit={(fields, request) =>
                        api.adjustRecoveredHours(company, request, {
                          submission: row.id,
                          day: String(fields.get('day') ?? ''),
                          minutes: Number(fields.get('minutes')),
                          description: String(fields.get('description') ?? ''),
                          justification: String(fields.get('justification') ?? ''),
                        })
                      }
                    >
                      {(prefix) => (
                        <>
                          <p>
                            O cronômetro encerrou após inatividade. Revise o tempo antes da
                            aprovação.
                          </p>
                          <Field id={prefix + 'day'} label="Data do trabalho">
                            <Input
                              id={prefix + 'day'}
                              name="day"
                              type="date"
                              defaultValue={row.day}
                              required
                            />
                          </Field>
                          <Field id={prefix + 'minutes'} label="Duração correta em minutos">
                            <Input
                              id={prefix + 'minutes'}
                              name="minutes"
                              type="number"
                              min={1}
                              max={1440}
                              defaultValue={row.minutes}
                              required
                            />
                          </Field>
                          <Field id={prefix + 'description'} label="Trabalho realizado">
                            <TextArea
                              id={prefix + 'description'}
                              name="description"
                              minLength={3}
                              maxLength={1000}
                              defaultValue={row.description}
                              required
                            />
                          </Field>
                          <Field
                            id={prefix + 'justification'}
                            label="O que aconteceu com o cronômetro"
                          >
                            <TextArea
                              id={prefix + 'justification'}
                              name="justification"
                              minLength={3}
                              maxLength={1000}
                              defaultValue={row.justification}
                              required
                            />
                          </Field>
                        </>
                      )}
                    </ActionForm>
                  )}
                  {row.decision_note && <p>Decisão CALI · {row.decision_note}</p>}
                  {admin && row.status === 'pending' && (
                    <ActionForm
                      label="Registrar decisão de horas"
                      saved={refresh}
                      submit={(fields) =>
                        api.decideHours(
                          company,
                          row.id,
                          fields.get('decision') === 'approve',
                          String(fields.get('note') ?? ''),
                        )
                      }
                    >
                      {(prefix) => (
                        <>
                          <Field id={prefix + 'decision'} label="Decisão">
                            <Select
                              id={prefix + 'decision'}
                              name="decision"
                              required
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Selecione
                              </option>
                              <option value="approve">Aprovar</option>
                              <option value="reject">Recusar</option>
                            </Select>
                          </Field>
                          <Field id={prefix + 'note'} label="Motivo, obrigatório ao recusar">
                            <TextArea id={prefix + 'note'} name="note" maxLength={1000} />
                          </Field>
                        </>
                      )}
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
          <WorkspacePagination total={queue.data.total} page={page} change={setPage} />
        </>
      )}
    </section>
  );
}
