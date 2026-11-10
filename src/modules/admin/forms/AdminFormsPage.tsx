import { FormAdministration } from './components/FormAdministration';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useProjectWorkspaceScope } from '../../../components/workspace/useProjectWorkspaceScope';
import { CompanySelect } from '../../../components/workspace/WorkspaceCompanySelect';

const adminForms = getRouteApi('/admin/formularios');

export function AdminFormsPage() {
  const search = adminForms.useSearch();
  const navigate = adminForms.useNavigate();
  const { companyId, actor, admin } = useProjectWorkspaceScope(search);
  const { domainOperations } = useRouteContext({ from: '__root__' });
  if (!admin || !domainOperations) return null;
  return (
    <div className="tw:grid tw:gap-4">
      <CompanySelect
        search={search}
        update={(change) => void navigate({ search: { ...search, ...change } })}
      />
      {companyId ? (
        <FormAdministration key={companyId} company={companyId} actor={actor} />
      ) : (
        <p>Selecione uma empresa.</p>
      )}
    </div>
  );
}
