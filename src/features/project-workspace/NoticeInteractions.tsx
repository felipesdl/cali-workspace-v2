import { Select, TextArea } from '../../components/ds/field/Controls';
import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type NoticeReaction } from '../../api/modules/project-workspace/domain-operations';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

const reactions = [
  { value: 'like', label: 'Gostei' },
  { value: 'love', label: 'Adorei' },
  { value: 'clap', label: 'Aplausos' },
] as const satisfies ReadonlyArray<{ value: NoticeReaction; label: string }>;

export function NoticeInteractions({
  company,
  actor,
  notice,
}: {
  company: string;
  actor?: string;
  notice: string;
}) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const key = ['phase4-notice-interactions', actor, company, notice];
  const result = useQuery({
    queryKey: [...key, page],
    queryFn:
      open && domainOperations
        ? ({ signal }) => domainOperations.noticeInteractions(company, notice, page, signal)
        : skipToken,
  });
  if (!domainOperations) return null;
  const operations = domainOperations;
  const data = result.data;
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="tw:cursor-pointer">Comentários e reações</summary>
      {open && (
        <div className="tw:mt-3 tw:grid tw:gap-3">
          {result.isPending && <FeedbackState kind="loading">Carregando interações…</FeedbackState>}
          {result.isError && (
            <FeedbackState kind="error" onRetry={() => void result.refetch()}>
              Não foi possível carregar as interações deste aviso.
            </FeedbackState>
          )}
          {data && (
            <>
              <p>
                {reactions.map(({ value, label }) => label + ': ' + data.totals[value]).join(' · ')}
              </p>
              <ActionForm
                key={data.ownReaction ?? 'none'}
                label="Salvar reação"
                submit={async (fields) => {
                  try {
                    return await operations.reactNotice(
                      company,
                      notice,
                      data.ownReaction,
                      String(fields.get('reaction') ?? ''),
                    );
                  } finally {
                    await cache.invalidateQueries({ queryKey: key });
                  }
                }}
              >
                {(prefix) => (
                  <Field id={prefix + 'reaction'} label="Sua reação">
                    <Select
                      id={prefix + 'reaction'}
                      name="reaction"
                      defaultValue={data.ownReaction ?? ''}
                    >
                      <option value="">Sem reação</option>
                      {reactions.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </ActionForm>
              {data.comments.length ? (
                <ol className="tw:grid tw:gap-2">
                  {data.comments.map((comment) => (
                    <li key={comment.id}>
                      <p>
                        {comment.authorRole === 'admin' ? 'CALI' : 'Cliente'} ·{' '}
                        {formatServerInstant(comment.createdAt)}
                      </p>
                      <p className="tw:break-words tw:whitespace-pre-line">{comment.body}</p>
                      {comment.hidden && <p>Oculto para o Cliente</p>}
                      {data.canModerate && (
                        <details key={comment.moderationVersion ?? 'unmoderated'}>
                          <summary className="tw:cursor-pointer">Moderar comentário</summary>
                          <ActionForm
                            label={comment.hidden ? 'Restaurar comentário' : 'Ocultar comentário'}
                            submit={async (fields, request) => {
                              try {
                                return await operations.moderateNoticeComment(
                                  company,
                                  notice,
                                  request,
                                  comment,
                                  String(fields.get('reason') ?? ''),
                                );
                              } finally {
                                await cache.invalidateQueries({ queryKey: key });
                              }
                            }}
                          >
                            {(prefix) => (
                              <Field id={prefix + 'reason'} label="Motivo da moderação">
                                <TextArea
                                  id={prefix + 'reason'}
                                  name="reason"
                                  required
                                  minLength={5}
                                  maxLength={1000}
                                />
                              </Field>
                            )}
                          </ActionForm>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Nenhum comentário nesta página.</p>
              )}
              {(page > 1 || data.comments.length === 25) && (
                <div className="tw:flex tw:gap-2">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={data.comments.length < 25}
                    onClick={() => setPage(page + 1)}
                  >
                    Mais antigos
                  </Button>
                </div>
              )}
              <ActionForm
                label="Publicar comentário"
                submit={async (fields, request) => {
                  const id = await operations.commentNotice(
                    company,
                    notice,
                    request,
                    String(fields.get('body') ?? ''),
                  );
                  setPage(1);
                  await cache.invalidateQueries({ queryKey: key });
                  return id;
                }}
              >
                {(prefix) => (
                  <Field id={prefix + 'body'} label="Comentário para esta empresa">
                    <TextArea id={prefix + 'body'} name="body" required maxLength={2000} />
                  </Field>
                )}
              </ActionForm>
            </>
          )}
        </div>
      )}
    </details>
  );
}
