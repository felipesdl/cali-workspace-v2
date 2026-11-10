import { HostedBrand } from './components/HostedBrand';
import { HostedRegistration } from './components/HostedRegistration';
import { CompanyContractDocuments } from './components/CompanyContractDocuments';
import { CompanyRegistrationData } from './components/CompanyRegistrationData';
import { CompanyAdministration } from './components/CompanyAdministration';
import { useState } from 'react';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { adminPaths } from '../../../app/navigation';
import { useCompanyManagementAvailable } from '../../../api/admin/companies/hooks/useCompanyManagement';
import { CompanyBasics } from './components/CompanyBasics';
import { CompanyRegistration } from './components/CompanyRegistration';
import { CompanyAdhesions } from './components/CompanyAdhesions';
import { CompanyFilters } from './components/CompanyFilters';
import { CompaniesTable } from './components/CompaniesTable';
import { CompanyAccessPanel } from './components/CompanyAccessPanel';
import { HostedCompanyDrafts } from './components/HostedCompanyDrafts';
import { CompanyCycles } from './components/CompanyCycles';

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
        onSelect={(companyId) => void navigate({ search: { ...search, companyId } })}
      />
      {search.companyId && (
        <>
          <CompanyBasics
            key={`basics:${search.companyId}`}
            companyId={search.companyId}
            focusOnMount={createdCompanyId === search.companyId}
          />
          <HostedRegistration
            key={`hosted-registration:${search.companyId}`}
            companyId={search.companyId}
          />
          <HostedBrand key={`hosted-brand:${search.companyId}`} companyId={search.companyId} />
          <CompanyRegistrationData
            key={`registration-data:${search.companyId}`}
            companyId={search.companyId}
          />
          <CompanyAdministration
            key={`administration:${search.companyId}`}
            companyId={search.companyId}
          />
          <CompanyContractDocuments
            key={`contract-documents:${search.companyId}`}
            companyId={search.companyId}
          />
          <CompanyAdhesions key={`adhesions:${search.companyId}`} companyId={search.companyId} />
          <CompanyCycles key={`cycles:${search.companyId}`} companyId={search.companyId} />
          <CompanyAccessPanel
            key={`accesses:${search.companyId}`}
            companyId={search.companyId}
            canManage={canManage}
            onClose={() => void navigate({ search: { ...search, companyId: undefined } })}
          />
        </>
      )}
    </div>
  );
}
