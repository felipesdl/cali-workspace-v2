import { Input, Select, TextArea } from '../ds/field/Controls';
import { FileInput } from '../ds/field/FileInput';
import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import {
  type RecordAction,
  type RecordReviewAction,
} from '../../api/shared/workspace/domain-operations';
import { Field } from '../ds/field/Field';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Button } from '../ds/button/Button';
import { Dialog } from '../ds/dialog/Dialog';
import { Checkbox } from '../ds/checkbox/Checkbox';
import { formatServerInstant } from '../../lib/dates';
import { SubjectHistory } from '../workspace/SubjectHistory';
import { ActionForm } from '../workspace/ActionForm';
import { RecordReviewActions } from './RecordReviewActions';
import { FileDownload } from '../documents/FileDownload';
import { workspaceSearch } from '../../api/shared/workspace/schemas';
import { isRecordStatus, recordStatusLabels } from '../workspace/workspace-labels';

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
      dialog={
        admin
          ? { title: 'Registrar contexto', trigger: 'Novo registro' }
          : { title: 'O que você precisa acompanhar?', trigger: 'Nova ocorrência' }
      }
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
          <p className="tw:m-0 tw:text-muted-copy">
            {admin
              ? 'Registre o contexto da ocorrência e indique se ela é apenas para a CALI.'
              : 'Conte o que aconteceu para a equipe CALI acompanhar o assunto com você.'}
          </p>
          <Field id={prefix + 'title'} label="Assunto">
            <Input id={prefix + 'title'} name="title" required minLength={2} maxLength={180} />
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
  stagedBatchesEnabled,
}: {
  prefix: string;
  admin: boolean;
  attachmentsEnabled?: boolean;
  imageAttachmentsEnabled?: boolean;
  attachmentBatchesEnabled?: boolean;
  stagedBatchesEnabled?: boolean;
}) {
  const batchLimit = stagedBatchesEnabled ? 'por arquivo' : 'no total';
  const attachmentLabel = attachmentBatchesEnabled
    ? `Anexos de até 10 MiB ${batchLimit} (opcional)`
    : 'Anexo de até 2 MiB (opcional)';
  return (
    <>
      <Field id={prefix + 'message'} label="Mensagem">
        <TextArea id={prefix + 'message'} name="message" required maxLength={6000} />
      </Field>
      {admin && <Checkbox name="internal">Somente para a CALI</Checkbox>}
      {attachmentsEnabled && (
        <Field id={prefix + 'attachment'} label={attachmentLabel}>
          <FileInput
            id={prefix + 'attachment'}
            name="attachment"
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
    staged?: boolean,
  ) {
    try {
      switch (command.action) {
        case 'open':
        case 'message':
        case 'change_status':
          return await operations.recordAction(company, id, command, files, batch, staged);
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
    <Dialog title={data?.title ?? 'Conversa da ocorrência'} layout="drawer" onDismiss={back}>
      <section
        className="tw:grid tw:min-w-0 tw:gap-3 tw:wrap-anywhere"
        aria-label="Conversa da ocorrência"
      >
        {detail.isPending && <p role="status">Carregando ocorrência…</p>}
        {detail.isError && (
          <FeedbackState kind="error" onRetry={() => void detail.refetch()}>
            Não foi possível carregar a ocorrência.
          </FeedbackState>
        )}
        {detail.isSuccess && !data && <p>Ocorrência indisponível.</p>}
        {data && (
          <>
            {admin && hourOperations && (
              <section aria-label="Horas da ocorrência" className="tw:grid tw:gap-2">
                {open && (
                  <ActionForm
                    label="Iniciar timer da ocorrência"
                    submit={async (_, request) => {
                      const timer = await hourOperations.startRecordTimer(company, request, record);
                      await cache.invalidateQueries({
                        queryKey: ['phase4-timers', actor, company],
                      });
                      return timer;
                    }}
                  />
                )}
                <Link to="/admin/horas" search={workspaceSearch.parse({ companyId: company })}>
                  Acompanhar timer e extrato em Horas
                </Link>
              </section>
            )}
            <SubjectHistory
              key={record}
              company={company}
              actor={actor}
              kind="record"
              id={record}
            />
            {data.messages.length ? (
              <ol className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
                {data.messages.map((message) => (
                  <li
                    key={message.id}
                    className={`tw:grid tw:w-fit tw:max-w-[92%] tw:gap-2 tw:rounded-panel tw:border tw:border-border-default tw:p-3 ${
                      message.author_role === 'client'
                        ? 'tw:justify-self-end tw:bg-[color-mix(in_srgb,var(--color-brand-burgundy)_8%,var(--surface-panel))]'
                        : 'tw:bg-ivory'
                    }`}
                  >
                    <strong className="tw:text-caption tw:text-brand">
                      {message.author_role === 'client'
                        ? 'Cliente'
                        : message.author_role === 'system'
                          ? 'Sistema'
                          : 'CALI'}
                      {message.visibility === 'internal' && ' · Mensagem interna'}
                    </strong>
                    <p className="tw:m-0 tw:whitespace-pre-line">{message.body}</p>
                    <time
                      dateTime={message.created_at}
                      className="tw:text-[11px] tw:text-muted-copy"
                    >
                      {formatServerInstant(message.created_at)}
                    </time>
                    {(
                      message.attachments ??
                      (message.attachment ? [{ ...message.attachment, position: undefined }] : [])
                    ).map((attachment) => (
                      <div className="tw:grid tw:gap-2" key={attachment.position ?? 1}>
                        <p>{attachment.fileName}</p>
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
                                  <TextArea
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
                    data.stagedBatchesEnabled,
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
                    stagedBatchesEnabled={data.stagedBatchesEnabled}
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
                  const next = fields.get('next');
                  if (typeof next !== 'string' || !isRecordStatus(next))
                    return Promise.reject(new Error('Selecione a situação.'));
                  return submit({ action: 'change_status', record, expected: status, next }, id);
                }}
              >
                {(prefix) => (
                  <Field id={prefix + 'state'} label="Nova situação">
                    <Select id={prefix + 'state'} name="next" required defaultValue="">
                      <option value="" disabled>
                        Selecione
                      </option>
                      {Object.entries(recordStatusLabels)
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
                    </Select>
                  </Field>
                )}
              </ActionForm>
            )}
          </>
        )}
      </section>
    </Dialog>
  );
}
