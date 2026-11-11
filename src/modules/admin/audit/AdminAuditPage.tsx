import { Input } from '../../../components/ds/field/Controls';
import { AuditResults } from './components/AuditResults';
import { AdminDailyPreview } from './components/AdminDailyPreview';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../components/ds/field/Field';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';
import { Pages } from '../../../components/workspace/WorkspacePages';
import { type Props } from '../../../components/workspace/workspace-presentation';

const adminAudit = getRouteApi('/admin/auditoria');

function AdminAudit({ search, update }: Props) {
  const { adminRead } = useRouteContext({ from: '__root__' });
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const month = search.month ?? null;
  const result = useQuery({
    queryKey: ['phase4-audit', actor, companyId, month, search.page],
    queryFn:
      admin && adminRead && companyId
        ? ({ signal }) => adminRead.audit(companyId, month, search.page, signal)
        : skipToken,
  });
  if (!admin || !adminRead) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <AdminDailyPreview actor={actor} />
      <div className="tw:grid tw:min-w-0 tw:items-end tw:gap-2 tw:min-[601px]:grid-cols-[minmax(0,280px)_minmax(0,200px)]">
        <CompanySelect search={search} update={update} />
        <Field id="audit-month" label="Mês da auditoria">
          <Input
            id="audit-month"
            type="month"
            value={month?.slice(0, 7) ?? ''}
            onChange={(event) =>
              update({
                month: event.currentTarget.value ? `${event.currentTarget.value}-01` : undefined,
                page: 1,
              })
            }
          />
        </Field>
      </div>
      {!companyId ? (
        <p>Selecione uma empresa.</p>
      ) : result.isPending ? (
        <FeedbackState kind="loading">Carregando eventos…</FeedbackState>
      ) : result.isError ? (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar a auditoria.
        </FeedbackState>
      ) : (
        <>
          {result.data.entries.length ? (
            <AuditResults entries={result.data.entries} />
          ) : (
            <FeedbackState kind="empty">Nenhum evento nesta página.</FeedbackState>
          )}
          <Pages total={result.data.total} search={search} update={update} />
        </>
      )}
    </div>
  );
}

export function AdminAuditPage() {
  const search = adminAudit.useSearch();
  const navigate = adminAudit.useNavigate();
  return (
    <AdminAudit
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
