import { SatisfactionResults } from './components/SatisfactionResults';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';
import { currentBrasiliaMonth } from '../../../lib/dates';
import { SatisfactionSummary } from './components/SatisfactionSummary';
import { SatisfactionRequestsPanel } from './components/SatisfactionRequestsPanel';
import { Field } from '../../../components/ds/field/Field';
import { Select } from '../../../components/ds/field/Controls';
import { MonthSelect } from '../../../components/workspace/WorkspaceMonthSelect';
import { SatisfactionExport } from './components/SatisfactionExport';
import { useCompaniesQuery } from '../../../api/admin/companies/hooks/useCompaniesQuery';

const adminSatisfaction = getRouteApi('/admin/satisfacao');

function AdminSatisfaction({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const month = search.month ?? currentBrasiliaMonth();
  const requestMonth = search.satisfactionPeriod === 'all' ? null : month;
  const cache = useQueryClient();
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  const key = ['phase4-satisfaction', actor, companyId];
  const period = useQuery({
    queryKey: [...key, 'period', requestMonth, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.satisfactionPeriod(companyId, requestMonth, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  const service = adminRead;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect search={search} update={update} />
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <Field id="satisfaction-request-period" label="Período das solicitações">
          <Select
            id="satisfaction-request-period"
            value={search.satisfactionPeriod ?? 'month'}
            onChange={(event) =>
              update({
                satisfactionPeriod: event.currentTarget.value === 'all' ? 'all' : undefined,
                page: 1,
              })
            }
          >
            <option value="month">Mês selecionado</option>
            <option value="all">Todo o período</option>
          </Select>
        </Field>
        {requestMonth && (
          <MonthSelect month={requestMonth} update={(change) => update({ ...change, page: 1 })} />
        )}
      </div>
      <SatisfactionRequestsPanel
        key={JSON.stringify([actor, search.companyId, requestMonth])}
        service={service}
        company={search.companyId ?? null}
        month={requestMonth}
        actor={actor}
        canClose={Boolean(domainOperations && companyId && companyId === search.companyId)}
      />
      {companyId && (
        <SatisfactionExport
          company={companyId}
          companyName={
            companies.data?.find((company) => company.id === companyId)?.displayName ??
            'Empresa selecionada'
          }
          month={requestMonth}
          service={service}
        />
      )}
      {companyId && period.isPending && (
        <FeedbackState kind="loading">Consultando o resumo de satisfação…</FeedbackState>
      )}
      {companyId && period.isError && (
        <FeedbackState kind="error" onRetry={() => void period.refetch()}>
          Não foi possível consultar o resumo de satisfação.
        </FeedbackState>
      )}
      {companyId && period.isSuccess && period.data && (
        <SatisfactionSummary value={period.data} accountSelected={Boolean(search.companyId)} />
      )}
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : period.isPending ? (
        <FeedbackState kind="loading">Carregando avaliações…</FeedbackState>
      ) : period.isError ? (
        <FeedbackState kind="error" onRetry={() => void period.refetch()}>
          Não foi possível consultar as avaliações.
        </FeedbackState>
      ) : (
        <>
          {period.data.entries.length ? (
            <SatisfactionResults
              entries={period.data.entries}
              save={
                domainOperations
                  ? async (entry, theme, note) => {
                      try {
                        return await service.saveFollowup(companyId, entry, theme, note);
                      } finally {
                        await Promise.all([
                          cache.invalidateQueries({ queryKey: key }),
                          cache.invalidateQueries({ queryKey: ['phase4-audit', actor, companyId] }),
                        ]);
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <FeedbackState kind="empty">Nenhuma avaliação de 1 a 3 nesta página.</FeedbackState>
          )}
          <Pages total={period.data.attentionTotal} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminSatisfactionPage() {
  const search = adminSatisfaction.useSearch();
  const navigate = adminSatisfaction.useNavigate();
  return (
    <AdminSatisfaction
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
