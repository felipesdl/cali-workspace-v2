import { FormDraftEditor, NewFormDraft } from './FormDraftEditor';
import { FormTriage } from './FormTriage';
import { FileDownload } from './FileDownload';
import { PdfDownload } from './PdfDownload';
import { formatServerInstant } from '../../lib/dates';
import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';
import { ReportCurationEditor } from './ReportCuration';
import { type ReportCuration } from '../../api/modules/project-workspace/report-curation';

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
            <select id={prefix + 'category'} name="category">
              <option value="comunicado">Comunicado</option>
              <option value="feriado">Feriado</option>
              <option value="atendimento">Atendimento</option>
            </select>
          </Field>
          <Field id={prefix + 'title'} label="Título">
            <input id={prefix + 'title'} name="title" maxLength={180} required />
          </Field>
          <Field id={prefix + 'body'} label="Mensagem">
            <textarea id={prefix + 'body'} name="body" maxLength={6000} required />
          </Field>
          <Field id={prefix + 'day'} label="Data do aviso">
            <input id={prefix + 'day'} name="day" type="date" required />
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
            <input id={prefix + 'month'} name="month" type="month" required />
          </Field>
          <Field id={prefix + 'title'} label="Título do relatório">
            <input id={prefix + 'title'} name="title" maxLength={180} required />
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
      <textarea
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
              <textarea
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
            const result = await operations.generateReportPdf(company, id, version);
            await Promise.all([
              refresh(result),
              cache.invalidateQueries({
                queryKey: ['phase4-report-approvals', actor, company, id],
              }),
            ]);
            return result;
          }}
        />
      )}
      {admin && !published && pdfReady && (
        <ActionForm
          label="Publicar no Workspace"
          submit={async (fields) =>
            refresh(
              await operations.releaseReport(
                company,
                id,
                version,
                previouslyReleased && fields.get('requestAck') === 'on',
              ),
            )
          }
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
      {!admin && acknowledgmentAvailable && (
        <ActionForm
          label="Registrar ciência desta revisão"
          submit={async () =>
            refresh(await operations.acknowledgeReportRelease(company, id, version))
          }
        />
      )}
      {!admin && acknowledged && <p role="status">Ciência registrada nesta revisão.</p>}
    </div>
  );
}

export function FormAdministration({ company, actor }: Scope) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const [page, setPage] = useState(1);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const cache = useQueryClient();
  const key = ['phase4-forms', actor, company];
  const forms = useQuery({
    queryKey: [...key, page],
    queryFn: domainOperations
      ? ({ signal }) => domainOperations.forms(company, page, signal)
      : skipToken,
  });
  if (!domainOperations) return null;
  const operations = domainOperations;
  return (
    <section aria-label="Formulários da empresa" className="tw:grid tw:gap-3">
      <NewFormDraft
        company={company}
        actor={actor}
        operations={operations}
        saved={() => setPage(1)}
      />
      {forms.isPending && <p role="status">Carregando formulários…</p>}
      {forms.isError && <p role="alert">Não foi possível consultar os formulários.</p>}
      {forms.data?.length === 0 && <p>Nenhum formulário nesta página.</p>}
      {forms.data?.map((form) => (
        <article
          key={form.id}
          className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4"
        >
          <h2>{form.title}</h2>
          <p>
            {form.slug} · {form.responses} resposta(s) ·{' '}
            {form.status === 'open' ? 'Aberto' : form.status === 'draft' ? 'Rascunho' : 'Fechado'}
          </p>
          {form.publicTextLink && (
            <Link to="/f/$slug" params={{ slug: form.slug }} className="tw:underline">
              Abrir link público de resposta
            </Link>
          )}
          {form.status === 'draft' && form.responses === 0 && (
            <FormDraftEditor company={company} actor={actor} id={form.id} operations={operations} />
          )}
          {form.responses > 0 && (
            <Button
              variant="secondary"
              aria-expanded={selectedForm === form.id}
              onClick={() => setSelectedForm(selectedForm === form.id ? null : form.id)}
            >
              {selectedForm === form.id ? 'Fechar triagem' : 'Acompanhar respostas'}
            </Button>
          )}
          {form.textExportAvailable && form.responses > 0 && (
            <FileDownload
              label="Exportar Excel"
              download={async (signal) => {
                const result = await operations.formExport(company, form.id, signal);
                const { formSpreadsheet } = await import('./form-spreadsheet');
                return formSpreadsheet(result);
              }}
            />
          )}
          {selectedForm === form.id && (
            <FormTriage company={company} actor={actor} form={form.id} operations={operations} />
          )}
          <ActionForm
            key={form.status}
            label={form.status === 'open' ? 'Encerrar formulário' : 'Abrir coleta por link público'}
            submit={async (fields) => {
              const id =
                form.status === 'open'
                  ? await operations.closeForm(company, form.id)
                  : await operations.openPublicForm(
                      company,
                      form.id,
                      form.status,
                      fields.get('publicLinkConfirmed') === 'on',
                    );
              await cache.invalidateQueries({ queryKey: key });
              return id;
            }}
          >
            {form.status !== 'open'
              ? (prefix) => (
                  <Checkbox id={prefix + 'public'} name="publicLinkConfirmed" required>
                    Entendo que qualquer pessoa com o link poderá responder sem entrar no Workspace.
                  </Checkbox>
                )
              : undefined}
          </ActionForm>
        </article>
      ))}
      {forms.isSuccess && (page > 1 || forms.data.length === 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={forms.data.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
