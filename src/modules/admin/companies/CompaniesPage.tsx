import { CompanySheet } from './components/CompanySheet';
import { useState } from 'react';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { adminPaths } from '../../../app/navigation';
import { useCompanyManagementAvailable } from '../../../api/admin/companies/hooks/useCompanyManagement';
import { CompanyRegistration } from './components/CompanyRegistration';
import { CompanyFilters } from './components/CompanyFilters';
import { CompaniesTable } from './components/CompaniesTable';
import { HostedCompanyDrafts } from './components/HostedCompanyDrafts';

const companiesRoute = getRouteApi(adminPaths.accounts);

export function CompaniesPage() {
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const canManage = useCompanyManagementAvailable();
  const search = companiesRoute.useSearch();
  const navigate = companiesRoute.useNavigate();
  const router = useRouter();
  return (
    <div data-feature="companies" className="tw:grid tw:gap-4 tw:text-body tw:text-copy">
      {canManage && (
        <p
          role="note"
          className="tw:m-0 tw:border-l-2 tw:border-brand tw:pl-4 tw:text-caption tw:leading-note"
        >
          Demonstração local: cadastros, referências e autorizações ficam somente na memória desta
          sessão. Recarregar a página descarta essas alterações. Nenhuma conta de autenticação é
          criada e nenhum convite é enviado.
        </p>
      )}
      <CompanyRegistration
        key={`registration:${search.companyId ?? 'new-company'}`}
        onCreated={async (companyId) => {
          // O resultado pode chegar depois de a URL mudar e antes de o formulário desmontar.
          if (router.state.location.pathname.replace(/\/$/, '') !== adminPaths.accounts) return;
          setCreatedCompanyId(companyId);
          await navigate({ search: { q: '', status: 'all', companyId } });
        }}
      />
      <HostedCompanyDrafts
        selectedCompanyId={search.companyId}
        openCompany={(companyId) => void navigate({ search: { q: '', status: 'all', companyId } })}
      />
      <CompanyFilters />
      <CompaniesTable
        filters={{ q: search.q, status: search.status }}
        onSelect={(companyId) =>
          void navigate({ search: { ...search, companyId, tab: 'Acessos' } })
        }
      />
      {search.companyId && (
        <CompanySheet
          key={search.companyId}
          companyId={search.companyId}
          focusOnMount={createdCompanyId === search.companyId}
          canManage={canManage}
          tab={search.tab ?? 'Cadastro'}
          onTab={(tab) => void navigate({ search: { ...search, tab }, replace: true })}
          onClose={() =>
            void navigate({ search: { ...search, companyId: undefined, tab: undefined } })
          }
        />
      )}
    </div>
  );
}
