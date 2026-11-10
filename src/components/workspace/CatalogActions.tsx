import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { Input, Select, TextArea } from '../ds/field/Controls';
import { PdfDownload } from '../documents/PdfDownload';
import { formatServerInstant } from '../../lib/dates';
import { useEffect, useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Checkbox } from '../ds/checkbox/Checkbox';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Field } from '../ds/field/Field';
import { ActionForm } from './ActionForm';
import { ReportCurationEditor } from '../reports/ReportCuration';
import { type ReportCuration } from '../../api/shared/workspace/report-curation';

type Scope = { company: string; actor?: string };
const read = (fields: FormData, name: string) => String(fields.get(name) ?? '');

function useCatalogActions({ company, actor }: Scope, module: string) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  return {
    operations: domainOperations,
    refresh: async (id: string) => {
      await cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, module] });
      if (module === 'notices')
        await cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'calendar'] });
      return id;
    },
  };
}

export function PublishNotice({ company, actor }: Scope) {
  const { operations, refresh } = useCatalogActions({ company, actor }, 'notices');
  if (!operations) return null;
  return (
    <ActionForm
      label="Publicar aviso para esta empresa"
      submit={async (fields, id) =>
        refresh(
          await operations.publishNotice(
            company,
            id,
            read(fields, 'category'),
            read(fields, 'title'),
            read(fields, 'body'),
            read(fields, 'day'),
          ),
        )
      }
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'category'} label="Categoria">
            <Select id={prefix + 'category'} name="category">
              <option value="comunicado">Comunicado</option>
              <option value="feriado">Feriado</option>
              <option value="atendimento">Atendimento</option>
            </Select>
          </Field>
          <Field id={prefix + 'title'} label="Título">
            <Input id={prefix + 'title'} name="title" maxLength={180} required />
          </Field>
          <Field id={prefix + 'body'} label="Mensagem">
            <TextArea id={prefix + 'body'} name="body" maxLength={6000} required />
          </Field>
          <Field id={prefix + 'day'} label="Data do aviso">
            <Input id={prefix + 'day'} name="day" type="date" required />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

export function NoticeItemAction({
  company,
  actor,
  id,
  status,
  editable,
  acknowledged,
}: Scope & {
  id: string;
  status: string | null;
  editable?: boolean;
  acknowledged?: boolean | null;
}) {
  const { operations, refresh } = useCatalogActions({ company, actor }, 'notices');
  if (!operations) return null;
  if (editable && (status === 'published' || status === 'archived'))
    return (
      <ActionForm
        label={status === 'published' ? 'Arquivar aviso' : 'Restaurar aviso'}
        submit={async () =>
          refresh(
            await operations.noticeState(
              company,
              id,
              status,
              status === 'published' ? 'archived' : 'published',
            ),
          )
        }
      />
    );
  if (typeof acknowledged !== 'boolean') return null;
  return (
    <ActionForm
      label={acknowledged ? 'Desfazer ciência do aviso' : 'Registrar ciência do aviso'}
      submit={async () =>
        refresh(await operations.noticeAcknowledgment(company, id, !acknowledged))
      }
    />
  );
}

export function CreateReportDraft({ company, actor }: Scope) {
  const { operations, refresh } = useCatalogActions({ company, actor }, 'reports');
  if (!operations) return null;
  return (
    <ActionForm
      label="Preparar rascunho mensal"
      submit={async (fields, id) =>
        refresh(
          await operations.createReport(
            company,
            id,
            read(fields, 'month') + '-01',
            read(fields, 'title'),
            read(fields, 'summary'),
          ),
        )
      }
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'month'} label="Mês do relatório">
            <Input id={prefix + 'month'} name="month" type="month" required />
          </Field>
          <Field id={prefix + 'title'} label="Título do relatório">
            <Input id={prefix + 'title'} name="title" maxLength={180} required />
          </Field>
          <ReportSummary prefix={prefix} />
        </>
      )}
    </ActionForm>
  );
}

function ReportSummary({ prefix, summary }: { prefix: string; summary?: string }) {
  return (
    <Field id={prefix + 'summary'} label="Resumo executivo">
      <TextArea
        id={prefix + 'summary'}
        name="summary"
        defaultValue={summary}
        maxLength={8000}
        required
      />
    </Field>
  );
}

export function ReportDraftActions({
  company,
  actor,
  id,
  status,
  expected,
  summary,
  curation,
  released,
}: Scope & {
  id: string;
  status: string | null;
  expected: string;
  summary: string | null;
  curation?: ReportCuration | null;
  released: boolean;
}) {
  const { operations, refresh } = useCatalogActions({ company, actor }, 'reports');
  const cache = useQueryClient();
  const approvalsKey = ['phase4-report-approvals', actor, company, id];
  const editable = status === 'draft' || status === 'review';
  const approved = status === 'approved' || released;
  const approvals = useQuery({
    queryKey: approvalsKey,
    queryFn:
      operations && (editable || approved)
        ? ({ signal }) => operations.reportApprovals(company, id, signal)
        : skipToken,
  });
  if (!operations || (!editable && !approved)) return null;
  const reportOperations = operations;
  type Action = Parameters<typeof reportOperations.updateReport>[3];
  async function update(action: Action, text?: string) {
    const result = await reportOperations.updateReport(company, id, expected, action, text);
    await Promise.all([refresh(result), cache.invalidateQueries({ queryKey: approvalsKey })]);
    return result;
  }
  return (
    <div className="tw:grid tw:gap-2">
      {editable && (
        <>
          <ActionForm
            label="Salvar resumo executivo"
            submit={(fields) => update('edit', read(fields, 'summary'))}
          >
            {(prefix) => <ReportSummary prefix={prefix} summary={summary ?? ''} />}
          </ActionForm>
          {curation && (
            <ReportCurationEditor
              key={expected}
              sections={curation}
              save={async (sections) =>
                refresh(await reportOperations.curateReport(company, id, expected, sections))
              }
            />
          )}
          <ActionForm
            label={status === 'draft' ? 'Iniciar revisão interna' : 'Aprovar versão interna'}
            submit={() => update(status === 'draft' ? 'review' : 'approve')}
          />
        </>
      )}
      {approvals.isError && (
        <FeedbackState kind="error" onRetry={() => void approvals.refetch()}>
          Não foi possível consultar o histórico de aprovação.
        </FeedbackState>
      )}
      {Boolean(approvals.data?.length) && (
        <details>
          <summary>Histórico das últimas aprovações</summary>
          <ul>
            {approvals.data?.map((item) => (
              <li key={item.version}>
                Versão {item.version} · {formatServerInstant(item.approvedAt)}
                {item.protocol && ` · ${item.protocol}`}
                {item.pdfReady && (
                  <PdfDownload
                    download={(signal) =>
                      reportOperations.reportPdf(company, id, item.version, signal)
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {approved && Boolean(approvals.data?.length) && (
        <ActionForm
          label="Reabrir aprovação interna"
          submit={(fields) => update('reopen', read(fields, 'reason'))}
        >
          {(prefix) => (
            <Field id={prefix + 'reason'} label="Motivo da reabertura">
              <TextArea
                id={prefix + 'reason'}
                name="reason"
                minLength={3}
                maxLength={4000}
                required
              />
            </Field>
          )}
        </ActionForm>
      )}
    </div>
  );
}

export function ReportPublicationActions({
  company,
  actor,
  id,
  version,
  pdfReady,
  published,
  admin,
  previouslyReleased,
  acknowledgmentAvailable,
  acknowledged,
}: Scope & {
  id: string;
  version: number;
  pdfReady: boolean;
  published: boolean;
  admin: boolean;
  previouslyReleased: boolean;
  acknowledgmentAvailable: boolean;
  acknowledged: boolean;
}) {
  const { operations, refresh } = useCatalogActions({ company, actor }, 'reports');
  const cache = useQueryClient();
  const [lastAction, setLastAction] = useState<{
    version: number;
    kind: 'generate' | 'release' | 'acknowledge';
  }>();
  const receipt = useRef<HTMLParagraphElement>(null);
  const completed = lastAction?.version === version ? lastAction.kind : undefined;
  const message =
    completed === 'generate' && pdfReady
      ? 'PDF da revisão pronto para baixar.'
      : completed === 'release' && published
        ? 'Relatório publicado no Workspace.'
        : acknowledged
          ? 'Ciência registrada nesta revisão.'
          : '';
  useEffect(() => {
    if (message && completed && document.activeElement === document.body) {
      receipt.current?.focus();
    }
  }, [completed, message]);

  if (!operations) return null;
  return (
    <div className="tw:grid tw:gap-2">
      {pdfReady && (
        <PdfDownload
          key={version}
          download={(signal) => operations.reportPdf(company, id, version, signal)}
        />
      )}
      {admin && !published && !pdfReady && (
        <ActionForm
          label="Gerar PDF da revisão"
          submit={async () => {
            setLastAction(undefined);
            const result = await operations.generateReportPdf(company, id, version);
            await Promise.all([
              refresh(result),
              cache.invalidateQueries({
                queryKey: ['phase4-report-approvals', actor, company, id],
              }),
            ]);
            setLastAction({ version, kind: 'generate' });
            return result;
          }}
        />
      )}
      {admin && !published && pdfReady && (
        <ActionForm
          label="Publicar no Workspace"
          submit={async (fields) => {
            setLastAction(undefined);
            const result = await refresh(
              await operations.releaseReport(
                company,
                id,
                version,
                previouslyReleased && fields.get('requestAck') === 'on',
              ),
            );
            setLastAction({ version, kind: 'release' });
            return result;
          }}
        >
          {(prefix) =>
            previouslyReleased ? (
              <Checkbox id={prefix + 'requestAck'} name="requestAck">
                Solicitar nova ciência
              </Checkbox>
            ) : (
              <p>A primeira publicação solicita ciência ao Cliente.</p>
            )
          }
        </ActionForm>
      )}
      {!admin && acknowledgmentAvailable && !acknowledged && (
        <ActionForm
          label="Registrar ciência desta revisão"
          submit={async () => {
            setLastAction(undefined);
            const result = await refresh(
              await operations.acknowledgeReportRelease(company, id, version),
            );
            setLastAction({ version, kind: 'acknowledge' });
            return result;
          }}
        />
      )}
      {message && (
        <FeedbackMessage ref={receipt} tone="success" tabIndex={-1}>
          {message}
        </FeedbackMessage>
      )}
    </div>
  );
}
