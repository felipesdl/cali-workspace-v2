import {
  CommercialDraftEditor,
  CreateCommercialDraft,
  EmailCommercialOffer,
  SendCommercialOffer,
} from './components/CommercialDraftEditor';
import { CommercialResults } from '../../../components/workspace/AdminReadResults';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';

const adminCommercial = getRouteApi('/admin/propostas');

function AdminCommercial({ search, update }: Props) {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const result = useQuery({
    queryKey: ['phase4-commercial', actor, companyId, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.commercial(companyId, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect search={search} update={update} />
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando propostas…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar as propostas.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <CommercialResults
              entries={result.data.entries}
              email={
                domainOperations && import.meta.env.VITE_CALI_PHASE4_COMMERCIAL_EMAIL === 'true'
                  ? (proposal, expected) => (
                      <EmailCommercialOffer
                        company={companyId}
                        proposal={proposal}
                        expected={expected}
                        service={adminRead}
                      />
                    )
                  : undefined
              }
              send={
                domainOperations
                  ? (proposal, expected) => (
                      <SendCommercialOffer
                        company={companyId}
                        actor={actor}
                        proposal={proposal}
                        expected={expected}
                        service={adminRead}
                      />
                    )
                  : undefined
              }
              create={
                domainOperations
                  ? (opportunity) => (
                      <CreateCommercialDraft
                        company={companyId}
                        actor={actor}
                        opportunity={opportunity}
                        service={adminRead}
                      />
                    )
                  : undefined
              }
              editor={
                domainOperations
                  ? (proposal) => (
                      <CommercialDraftEditor
                        company={companyId}
                        actor={actor}
                        proposal={proposal}
                        service={adminRead}
                      />
                    )
                  : undefined
              }
            />
          ) : (
            <FeedbackState kind="empty">
              Nenhuma proposta ou oportunidade vinculada a esta empresa nesta página.
            </FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminCommercialPage() {
  const search = adminCommercial.useSearch();
  const navigate = adminCommercial.useNavigate();
  return (
    <AdminCommercial
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
