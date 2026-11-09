import { SatisfactionResults } from './components/SatisfactionResults';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';

const adminSatisfaction = getRouteApi('/admin/satisfacao');

function AdminSatisfaction({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
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
