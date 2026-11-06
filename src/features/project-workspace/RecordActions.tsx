import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import {
  type RecordAction,
  type RecordReviewAction,
} from '../../api/modules/project-workspace/domain-operations';
import { Field } from '../../components/ds/field/Field';
import { Button } from '../../components/ds/button/Button';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';
import { RecordReviewActions } from './RecordReviewActions';

const states = {
  in_progress: 'Em atendimento',
  waiting_client: 'Aguardando Cliente',
  standby: 'Em espera',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
} as const;

type Scope = { company: string; actor?: string; admin: boolean };

export function OpenRecord({
  company,
  actor,
  admin,
  select,
}: Scope & { select: (id: string) => void }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  if (!domainOperations) return null;
  const operations = domainOperations;
  return (
    <ActionForm
      label="Abrir ocorrência"
      saved={select}
      submit={async (fields, id) => {
        await operations.recordAction(company, id, {
          action: 'open',
          record: id,
          title: String(fields.get('title') ?? ''),
          body: String(fields.get('message') ?? ''),
          internal: admin && fields.has('internal'),
        });
        await cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'records'] });
        return id;
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'title'} label="Assunto">
            <input id={prefix + 'title'} name="title" required minLength={2} maxLength={180} />
          </Field>
          <MessageFields prefix={prefix} admin={admin} />
        </>
      )}
    </ActionForm>
  );
}

function MessageFields({ prefix, admin }: { prefix: string; admin: boolean }) {
  return (
    <>
      <Field id={prefix + 'message'} label="Mensagem">
        <textarea id={prefix + 'message'} name="message" required maxLength={6000} />
      </Field>
      {admin && (
        <label className="tw:flex tw:items-center tw:gap-2">
          <input type="checkbox" name="internal" /> Somente para a CALI
        </label>
      )}
    </>
  );
}

export function RecordConversation({
  company,
  actor,
  admin,
  record,
  back,
}: Scope & { record: string; back: () => void }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const key = ['phase4-record', actor, company, record];
  const detail = useQuery({
    queryKey: [...key, page],
    queryFn: domainOperations
      ? ({ signal }) => domainOperations.readRecord(company, record, page, signal)
      : skipToken,
  });
  if (!domainOperations) return null;
  const operations = domainOperations;
  async function submit(command: RecordAction | RecordReviewAction, id: string) {
    try {
      switch (command.action) {
        case 'open':
        case 'message':
        case 'change_status':
          return await operations.recordAction(company, id, command);
        default:
          return await operations.reviewRecord(company, id, command);
      }
    } finally {
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'records'] }),
      ]);
    }
  }
  const data = detail.data;
  const status = data?.status;
  const open = status !== 'cancelled' && status !== 'completed';
  return (
    <section className="tw:grid tw:gap-3" aria-label="Conversa da ocorrência">
      <div>
        <Button variant="secondary" onClick={back}>
          Voltar às ocorrências
        </Button>
      </div>
      {detail.isPending && <p role="status">Carregando ocorrência…</p>}
      {detail.isError && <p role="alert">Não foi possível carregar a ocorrência.</p>}
      {detail.isSuccess && !data && <p>Ocorrência indisponível.</p>}
      {data && (
        <>
          <h2 className="tw:text-section">{data.title}</h2>
          {data.messages.length ? (
            <ol className="tw:grid tw:gap-3">
              {data.messages.map((message) => (
                <li
                  key={message.id}
                  className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
                >
                  <p>
                    {message.author_role === 'client'
                      ? 'Cliente'
                      : message.author_role === 'system'
                        ? 'Sistema'
                        : 'CALI'}{' '}
                    · {formatServerInstant(message.created_at)}
                    {message.visibility === 'internal' && ' · Interna'}
                  </p>
                  <p className="tw:break-words tw:whitespace-pre-line">{message.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhuma mensagem nesta página.</p>
          )}
          <div className="tw:flex tw:gap-2">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={data.messages.length < 25}
              onClick={() => setPage(page + 1)}
            >
              Mais antigas
            </Button>
          </div>
          {open && (admin || status !== 'standby') && (
            <ActionForm
              label="Registrar mensagem"
              submit={(fields, id) =>
                submit(
                  {
                    action: 'message',
                    record,
                    body: String(fields.get('message') ?? ''),
                    internal: admin && fields.has('internal'),
                  },
                  id,
                )
              }
              saved={() => setPage(1)}
            >
              {(prefix) => <MessageFields prefix={prefix} admin={admin} />}
            </ActionForm>
          )}
          {data.visibility === 'client' && (
            <RecordReviewActions
              admin={admin}
              record={record}
              status={status}
              feedback={data.feedback}
              reopen={data.reopen}
              submit={submit}
            />
          )}
          {admin && status && (open || data.reopen?.status !== 'pending') && (
            <ActionForm
              label={open ? 'Atualizar situação' : 'Reabrir pela CALI'}
              submit={(fields, id) => {
                const next = Object.entries(states).find(
                  ([name]) => name === fields.get('next'),
                )?.[0];
                if (!next || !isState(next))
                  return Promise.reject(new Error('Selecione a situação.'));
                return submit({ action: 'change_status', record, expected: status, next }, id);
              }}
            >
              {(prefix) => (
                <Field id={prefix + 'state'} label="Nova situação">
                  <select id={prefix + 'state'} name="next" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {Object.entries(states)
                      .filter(
                        ([key]) =>
                          key !== status &&
                          (open || key === 'in_progress') &&
                          (data.reopen?.status !== 'pending' || key !== 'in_progress'),
                      )
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </ActionForm>
          )}
        </>
      )}
    </section>
  );
}

function isState(value: string): value is keyof typeof states {
  return Object.prototype.hasOwnProperty.call(states, value);
}
