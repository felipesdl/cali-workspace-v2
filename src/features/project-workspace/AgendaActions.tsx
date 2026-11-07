import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';
import { AgendaChangeActions } from './AgendaChangeActions';
import { AgendaExtras } from './AgendaExtras';
import { AgendaParticipants } from './AgendaParticipants';
import { appointmentStatusLabel } from './workspace-labels';

const read = (fields: FormData, name: string) => String(fields.get(name) ?? '');

export function AgendaActions({
  company,
  actor,
  admin,
}: {
  company: string;
  actor?: string;
  admin: boolean;
}) {
  const { agendaOperations } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['phase4-appointments', actor, company];
  const result = useQuery({
    queryKey: [...key, page],
    queryFn: agendaOperations
      ? ({ signal }) => agendaOperations.list(company, page, signal)
      : skipToken,
  });
  if (!agendaOperations) return null;
  const agenda = agendaOperations;
  async function refresh(id: string) {
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'calendar'] }),
    ]);
    return id;
  }
  return (
    <section aria-label="Solicitações de agenda" className="tw:grid tw:gap-3">
      <h2 className="tw:text-section">Solicitações de agenda</h2>
      {!admin && (
        <ActionForm
          label="Solicitar encontro do contrato"
          submit={async (fields, id) => {
            const first = { start: read(fields, 'start1'), end: read(fields, 'end1') };
            const second = { start: read(fields, 'start2'), end: read(fields, 'end2') };
            return refresh(
              await agenda.request(company, id, {
                mode: read(fields, 'mode') === 'in_person' ? 'in_person' : 'remote',
                title: read(fields, 'title'),
                purpose: read(fields, 'purpose'),
                location: read(fields, 'location'),
                slots: second.start || second.end ? [first, second] : [first],
              }),
            );
          }}
          saved={() => setPage(1)}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'title'} label="Assunto">
                <input id={prefix + 'title'} name="title" minLength={2} maxLength={160} required />
              </Field>
              <Field id={prefix + 'purpose'} label="Finalidade">
                <textarea id={prefix + 'purpose'} name="purpose" maxLength={2000} />
              </Field>
              <Field id={prefix + 'mode'} label="Formato">
                <select id={prefix + 'mode'} name="mode">
                  <option value="remote">Online</option>
                  <option value="in_person">Presencial</option>
                </select>
              </Field>
              <Field id={prefix + 'location'} label="Endereço para encontro presencial">
                <input id={prefix + 'location'} name="location" maxLength={400} />
              </Field>
              <p>Use o horário de Brasília. Encontro presencial precisa de duas opções.</p>
              {[
                { id: 'primary', index: 1 },
                { id: 'secondary', index: 2 },
              ].map(({ id, index }) => (
                <div key={id} className="tw:grid tw:grid-cols-2 tw:gap-3">
                  <Field id={prefix + 'start' + index} label={`Início da opção ${index}`}>
                    <input
                      id={prefix + 'start' + index}
                      name={`start${index}`}
                      type="datetime-local"
                      required={index === 1}
                    />
                  </Field>
                  <Field id={prefix + 'end' + index} label={`Fim da opção ${index}`}>
                    <input
                      id={prefix + 'end' + index}
                      name={`end${index}`}
                      type="datetime-local"
                      required={index === 1}
                    />
                  </Field>
                </div>
              ))}
            </>
          )}
        </ActionForm>
      )}
      {result.isPending && <p role="status">Carregando solicitações…</p>}
      {result.isError && <p role="alert">Não foi possível consultar as solicitações.</p>}
      {result.data?.map((item) => {
        const offer = admin && item.status === 'submitted';
        const confirm = !admin && item.status === 'client_review';
        const options = offer ? item.requested_slots : item.admin_proposed_slots;
        return (
          <article
            key={item.id}
            className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4"
          >
            <h3>{item.title}</h3>
            <p>
              {appointmentStatusLabel(item.status)} ·{' '}
              {item.request_mode === 'remote' ? 'Online' : 'Presencial'}
            </p>
            {item.meetingAt && item.status !== 'cancelled' && (
              <p>{formatServerInstant(item.meetingAt)} (Brasília)</p>
            )}
            <AgendaParticipants people={item.participants} />
            <AgendaChangeActions
              company={company}
              appointment={item.id}
              admin={admin}
              eligible={Boolean(item.canRequestChange)}
              active={item.status === 'confirmed'}
              change={item.latestChange}
              agenda={agenda}
              refresh={refresh}
            />
            {item.admin_note && <p className="tw:break-words">{item.admin_note}</p>}
            {item.sync_status && (
              <p>
                Sincronização externa:{' '}
                {item.sync_status === 'pending' ? 'Aguardando integração' : item.sync_status}
              </p>
            )}
            {(offer || confirm) && options.length > 0 && (
              <ActionForm
                label={offer ? 'Oferecer horário' : 'Confirmar horário'}
                submit={async (fields) =>
                  refresh(
                    await agenda.respond(
                      company,
                      item.id,
                      offer ? 'offer' : 'confirm',
                      Number(fields.get('index')),
                      read(fields, 'note'),
                    ),
                  )
                }
              >
                {(prefix) => (
                  <>
                    <Field id={prefix + 'index'} label="Horário">
                      <select id={prefix + 'index'} name="index" required defaultValue="">
                        <option value="" disabled>
                          Selecione
                        </option>
                        {options.map((slot, index) => (
                          <option key={slot.startsAt + slot.endsAt} value={index}>
                            {formatServerInstant(slot.startsAt)} até{' '}
                            {formatServerInstant(slot.endsAt)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {offer && <AppointmentNote prefix={prefix} />}
                  </>
                )}
              </ActionForm>
            )}
            {offer && (
              <ActionForm
                label="Recusar solicitação"
                submit={async (fields) =>
                  refresh(
                    await agenda.respond(company, item.id, 'decline', null, read(fields, 'note')),
                  )
                }
              >
                {(prefix) => <AppointmentNote prefix={prefix} />}
              </ActionForm>
            )}
          </article>
        );
      })}
      {result.isSuccess && (page > 1 || result.data.length === 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={result.data.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
      <AgendaExtras company={company} actor={actor} agenda={agenda} />
    </section>
  );
}

function AppointmentNote({ prefix }: { prefix: string }) {
  return (
    <Field id={prefix + 'note'} label="Observação">
      <textarea id={prefix + 'note'} name="note" maxLength={2000} />
    </Field>
  );
}
