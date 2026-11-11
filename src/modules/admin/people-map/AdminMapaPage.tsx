import { useState } from 'react';
import { MapaJourneys } from './components/MapaJourneys';
import { MapaReview } from './components/MapaReview';
import { MapaReportSummary } from './components/MapaReportSummary';
import { MapaPartnerAssignment } from './components/MapaPartnerAssignment';
import { MapaPartnerOpinionQueue } from './components/MapaPartnerOpinionQueue';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { Button } from '../../../components/ds/button/Button';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';

const adminMapa = getRouteApi('/admin/mapa-de-people');

export function AdminMapaPage() {
  const { adminRead, domainOperations, adminMapaOpinions } = useRouteContext({ from: '__root__' });
  const search = adminMapa.useSearch();
  const navigate = adminMapa.useNavigate();
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const cache = useQueryClient();
  const update: Props['update'] = (change) => void navigate({ search: { ...search, ...change } });
  const [view, setView] = useState<'responses' | 'journeys'>('responses');
  const key = ['phase4-mapa', actor, companyId];
  const result = useQuery({
    queryKey: [...key, search.page],
    queryFn:
      view === 'responses' && admin && adminRead && companyId
        ? ({ signal }) => adminRead.mapa(companyId, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  return (
    <section className="tw:grid tw:gap-4" aria-label="Triagem do Mapa de People">
      <CompanySelect search={search} update={update} />
      {companyId && (
        <div className="tw:flex tw:flex-wrap tw:gap-2" role="group" aria-label="Visão do Mapa">
          <Button
            variant={view === 'responses' ? 'primary' : 'secondary'}
            aria-pressed={view === 'responses'}
            onClick={() => setView('responses')}
          >
            Respostas
          </Button>
          <Button
            variant={view === 'journeys' ? 'primary' : 'secondary'}
            aria-pressed={view === 'journeys'}
            onClick={() => setView('journeys')}
          >
            Jornada e acessos
          </Button>
        </div>
      )}
      {companyId && view === 'journeys' && (
        <MapaJourneys key={companyId} company={companyId} actor={actor} service={adminRead} />
      )}
      {!companyId && <FeedbackState kind="empty">Selecione uma empresa.</FeedbackState>}
      {companyId && view === 'responses' && result.isPending && (
        <FeedbackState kind="loading">Carregando registros…</FeedbackState>
      )}
      {view === 'responses' && result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar os registros.
        </FeedbackState>
      )}
      {companyId && view === 'responses' && result.data && (
        <>
          <MapaPartnerOpinionQueue company={companyId} service={adminMapaOpinions} />
          {result.data.entries.length === 0 && (
            <FeedbackState kind="empty">Nenhum registro vinculado nesta página.</FeedbackState>
          )}
          <ul className="tw:m-0 tw:grid tw:list-none tw:p-0">
            {result.data.entries.map((entry) => (
              <li key={entry.id} className="tw:border-line tw:grid tw:gap-2 tw:border-b tw:py-4">
                <MapaReview
                  entry={entry}
                  company={companyId}
                  operations={domainOperations}
                  saved={async () => {
                    await Promise.all([
                      cache.invalidateQueries({ queryKey: key }),
                      cache.invalidateQueries({
                        queryKey: ['phase4-mapa-report', actor, companyId, entry.id],
                      }),
                    ]);
                  }}
                />
                <MapaPartnerAssignment
                  company={companyId}
                  entry={entry}
                  service={adminMapaOpinions}
                />
                <MapaReportSummary
                  record={entry.id}
                  company={companyId}
                  actor={actor}
                  service={adminRead}
                />
              </li>
            ))}
          </ul>
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </section>
  );
}
