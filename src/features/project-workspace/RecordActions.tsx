import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import {
  type RecordAction,
  type RecordReviewAction,
} from '../../api/modules/project-workspace/domain-operations';
import { Field } from '../../components/ds/field/Field';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';
import { RecordReviewActions } from './RecordReviewActions';
import { FileDownload } from './FileDownload';
import { workspaceSearch } from '../../api/modules/project-workspace/schemas';

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

function MessageFields({
  prefix,
  admin,
  attachmentsEnabled,
  imageAttachmentsEnabled,
  attachmentBatchesEnabled,
}: {
  prefix: string;
  admin: boolean;
  attachmentsEnabled?: boolean;
  imageAttachmentsEnabled?: boolean;
  attachmentBatchesEnabled?: boolean;
}) {
  return (
    <>
      <Field id={prefix + 'message'} label="Mensagem">
        <textarea id={prefix + 'message'} name="message" required maxLength={6000} />
      </Field>
      {admin && <Checkbox name="internal">Somente para a CALI</Checkbox>}
      {attachmentsEnabled && (
        <Field
          id={prefix + 'attachment'}
          label={
            attachmentBatchesEnabled
              ? 'Anexos de até 10 MiB no total (opcional)'
              : 'Anexo de até 2 MiB (opcional)'
          }
        >
          <input
            id={prefix + 'attachment'}
            name="attachment"
            type="file"
            multiple={attachmentBatchesEnabled}
            accept={
              attachmentBatchesEnabled
                ? '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx'
                : imageAttachmentsEnabled
                  ? '.pdf,.png,.jpg,.jpeg,.webp'
                  : '.pdf'
            }
          />
          <span>
            {attachmentBatchesEnabled
              ? 'Até cinco arquivos. PDF, PNG, JPEG, WebP, Word, Excel ou PowerPoint.'
              : imageAttachmentsEnabled
                ? 'PDF, PNG, JPEG ou WebP.'
                : 'PDF.'}
          </span>
        </Field>
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
  const { domainOperations, hourOperations } = useRouteContext({ from: '__root__' });
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
  async function submit(
    command: RecordAction | RecordReviewAction,
    id: string,
    files?: File[],
    batch?: boolean,
  ) {
    try {
      switch (command.action) {
        case 'open':
        case 'message':
        case 'change_status':
          return await operations.recordAction(company, id, command, files, batch);
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
          {admin && hourOperations && (
            <section aria-label="Horas da ocorrência" className="tw:grid tw:gap-2">
              {open && (
                <ActionForm
                  label="Iniciar timer da ocorrência"
                  submit={async (_, request) => {
                    const timer = await hourOperations.startRecordTimer(company, request, record);
                    await cache.invalidateQueries({ queryKey: ['phase4-timers', actor, company] });
                    return timer;
                  }}
                />
              )}
              <Link to="/admin/horas" search={workspaceSearch.parse({ companyId: company })}>
                Acompanhar timer e extrato em Horas
              </Link>
            </section>
          )}
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
                  {(
                    message.attachments ??
                    (message.attachment ? [{ ...message.attachment, position: undefined }] : [])
                  ).map((attachment) => (
                    <div className="tw:grid tw:gap-2" key={attachment.position ?? 1}>
                      <p className="tw:break-words">{attachment.fileName}</p>
                      <FileDownload
                        label="Baixar anexo"
                        download={(signal) =>
                          operations.recordAttachment(
                            company,
                            record,
                            message.id,
                            signal,
                            attachment.position,
                          )
                        }
                      />
                      {attachment.canWithdraw && (
                        <details>
                          <summary className="tw:cursor-pointer">Retirar anexo</summary>
                          <ActionForm
                            label="Confirmar retirada do anexo"
                            submit={async (fields) => {
                              const result = await operations.withdrawRecordAttachment(
                                company,
                                record,
                                message.id,
                                String(fields.get('reason') ?? ''),
                                attachment.position,
                              );
                              await cache.invalidateQueries({ queryKey: key });
                              return result;
                            }}
                          >
                            {(prefix) => (
                              <Field id={prefix + 'reason'} label="Motivo da retirada">
                                <textarea
                                  id={prefix + 'reason'}
                                  name="reason"
                                  required
                                  minLength={3}
                                  maxLength={1000}
                                />
                              </Field>
                            )}
                          </ActionForm>
                        </details>
                      )}
                    </div>
                  ))}
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
              submit={(fields, id) => {
                const attachments = fields
                  .getAll('attachment')
                  .filter((file): file is File => file instanceof File && file.name !== '');
                return submit(
                  {
                    action: 'message',
                    record,
                    body: String(fields.get('message') ?? ''),
                    internal: admin && fields.has('internal'),
                  },
                  id,
                  attachments,
                  data.attachmentBatchesEnabled,
                );
              }}
              saved={() => setPage(1)}
            >
              {(prefix) => (
                <MessageFields
                  prefix={prefix}
                  admin={admin}
                  attachmentsEnabled={data.attachmentsEnabled}
                  imageAttachmentsEnabled={data.imageAttachmentsEnabled}
                  attachmentBatchesEnabled={data.attachmentBatchesEnabled}
                />
              )}
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
