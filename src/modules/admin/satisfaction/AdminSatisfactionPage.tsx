import { SatisfactionResults } from './components/SatisfactionResults';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';
import { useAdminOverviewSnapshot } from '../../../api/admin/workspace/useAdminOverviewSnapshot';
import { currentBrasiliaMonth } from '../../../lib/dates';
import { SatisfactionSummary } from './components/SatisfactionSummary';
import { SatisfactionRequestsPanel } from './components/SatisfactionRequestsPanel';
import { Field } from '../../../components/ds/field/Field';
import { Select } from '../../../components/ds/field/Controls';
import { MonthSelect } from '../../../components/workspace/WorkspaceMonthSelect';

const adminSatisfaction = getRouteApi('/admin/satisfacao');

function AdminSatisfaction({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const month = search.month ?? currentBrasiliaMonth();
  const requestMonth = search.satisfactionPeriod === 'all' ? null : month;
  const overview = useAdminOverviewSnapshot(
    search.companyId,
    search.month ?? currentBrasiliaMonth(),
  );
  const cache = useQueryClient();
  const key = ['phase4-satisfaction', actor, companyId];
  const result = useQuery({
    queryKey: [...key, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.satisfaction(companyId, search.page, signal)
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
              })
            }
          >
            <option value="month">Mês selecionado</option>
            <option value="all">Todo o período</option>
          </Select>
        </Field>
        {requestMonth && <MonthSelect month={requestMonth} update={update} />}
      </div>
      <SatisfactionRequestsPanel
        key={JSON.stringify([actor, search.companyId, requestMonth])}
        service={service}
        company={search.companyId ?? null}
        month={requestMonth}
        actor={actor}
        canClose={Boolean(domainOperations && companyId && companyId === search.companyId)}
      />
      {overview.available && overview.query.isPending && (
        <FeedbackState kind="loading">Consultando o resumo de satisfação…</FeedbackState>
      )}
      {overview.available && overview.query.isError && (
        <FeedbackState kind="error" onRetry={() => void overview.query.refetch()}>
          Não foi possível consultar o resumo de satisfação.
        </FeedbackState>
      )}
      {overview.query.isSuccess && overview.query.data && (
        <SatisfactionSummary
          value={overview.query.data.satisfaction}
          accountSelected={Boolean(search.companyId)}
        />
      )}
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando avaliações…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar as avaliações.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <SatisfactionResults
              entries={result.data.entries}
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
          <Pages total={result.data.total} search={search} update={update} />
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
