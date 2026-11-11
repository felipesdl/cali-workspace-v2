import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type PartnerReportDraftService } from '../../../../api/partner/report-drafts';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { Input, TextArea } from '../../../../components/ds/field/Controls';
import { WorkspacePagination } from '../../../../components/workspace/WorkspacePagination';
import { currentBrasiliaMonth } from '../../../../lib/dates';
import { formatOverviewMonth } from '../../../admin/overview/components/overview-format';

const panel =
  'tw:grid tw:min-w-0 tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

export function PartnerReportDraftsPanel({
  service,
  company,
  actor,
}: {
  service: PartnerReportDraftService;
  company: string;
  actor: string;
}) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [draftId, setDraftId] = useState('');
  const [expected, setExpected] = useState<string | null>(null);
  const [month, setMonth] = useState(currentBrasiliaMonth().slice(0, 7));
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const queryKey = ['partner-report-drafts', actor, company, page] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => service.listPartner(company, page, signal),
  });
  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const monthStart = `${month}-01`;
      return service.savePartner(company, {
        id: draftId,
        expected,
        month: monthStart,
        title,
        summary,
        submit,
      });
    },
    onSuccess: async () => {
      setTitle('');
      setSummary('');
      setMonth(currentBrasiliaMonth().slice(0, 7));
      setFormOpen(false);
      await cache.invalidateQueries({ queryKey: ['partner-report-drafts', actor, company] });
    },
  });

  function startNew() {
    setDraftId(crypto.randomUUID());
    setExpected(null);
    setMonth(currentBrasiliaMonth().slice(0, 7));
    setTitle('');
    setSummary('');
    setFormOpen(true);
  }

  function edit(draft: NonNullable<typeof query.data>['rows'][number]) {
    setDraftId(draft.id);
    setExpected(draft.updatedAt);
    setMonth(draft.month.slice(0, 7));
    setTitle(draft.title);
    setSummary(draft.summary);
    setFormOpen(true);
  }

  return (
    <section className={panel} aria-labelledby="partner-report-drafts-title">
      <header className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
        <div>
          <h2 id="partner-report-drafts-title" className="tw:m-0 tw:text-section tw:font-semibold">
            Preparar relatório
          </h2>
          <p className="tw:mt-1 tw:mb-0 tw:text-caption tw:text-muted-copy">
            Informe mês, título e resumo. A CALI revisa o material e prepara a versão interna antes
            de qualquer liberação ao cliente.
          </p>
        </div>
        {!formOpen && (
          <Button variant="secondary" onClick={startNew}>
            Novo rascunho
          </Button>
        )}
      </header>

      {formOpen && (
        <form
          className="tw:grid tw:gap-3 tw:border-t tw:border-border-default tw:pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(false);
          }}
        >
          <Field id="partner-report-month" label="Mês de referência">
            <Input
              id="partner-report-month"
              type="month"
              required
              value={month}
              onChange={(event) => setMonth(event.currentTarget.value)}
            />
          </Field>
          <Field id="partner-report-title" label="Título">
            <Input
              id="partner-report-title"
              maxLength={180}
              required
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </Field>
          <Field id="partner-report-summary" label="Resumo para revisão da CALI">
            <TextArea
              id="partner-report-summary"
              maxLength={8000}
              required
              value={summary}
              onChange={(event) => setSummary(event.currentTarget.value)}
            />
          </Field>
          {save.isError && (
            <p role="alert" className="tw:text-danger tw:m-0">
              {save.error.message}
            </p>
          )}
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button type="submit" variant="secondary" pending={save.isPending}>
              Salvar rascunho
            </Button>
            <Button type="button" pending={save.isPending} onClick={() => save.mutate(true)}>
              Enviar para revisão da CALI
            </Button>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
          </div>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            O envio encaminha este texto à CALI para revisão. Ele não é publicado nem enviado ao
            cliente.
          </p>
        </form>
      )}

      {query.isPending ? (
        <FeedbackState kind="loading">Consultando seus rascunhos…</FeedbackState>
      ) : query.isError ? (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível consultar seus rascunhos.
        </FeedbackState>
      ) : query.data.rows.length ? (
        <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
          {query.data.rows.map((draft) => (
            <li
              key={draft.id}
              className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-3"
            >
              <div className="tw:flex tw:flex-wrap tw:items-baseline tw:justify-between tw:gap-2">
                <strong>{draft.title}</strong>
                <span className="tw:text-caption tw:text-muted-copy">
                  {formatOverviewMonth(draft.month)} ·{' '}
                  {draft.status === 'draft'
                    ? 'Rascunho'
                    : draft.status === 'submitted'
                      ? 'Em revisão da CALI'
                      : draft.status === 'returned'
                        ? 'Devolvido para ajuste'
                        : 'Preparado para revisão Admin'}
                </span>
              </div>
              <p className="tw:m-0 tw:whitespace-pre-line">{draft.summary}</p>
              {draft.decisionNote && <p className="tw:m-0">{draft.decisionNote}</p>}
              {(draft.status === 'draft' || draft.status === 'returned') && (
                <Button variant="secondary" onClick={() => edit(draft)}>
                  Editar rascunho
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <FeedbackState kind="empty">Nenhum rascunho preparado.</FeedbackState>
      )}
      {query.isSuccess && (
        <WorkspacePagination total={query.data.total} page={page} change={setPage} />
      )}
    </section>
  );
}
