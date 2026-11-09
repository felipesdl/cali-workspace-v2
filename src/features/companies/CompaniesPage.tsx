import { HostedBrand } from './HostedBrand';
import { HostedRegistration } from './HostedRegistration';
import { CompanyContractDocuments } from './CompanyContractDocuments';
import { CompanyRegistrationData } from './CompanyRegistrationData';
import { CompanyAdministration } from './CompanyAdministration';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { companiesRoute } from '../../app/router';
import { useCompanyManagementAvailable } from '../../api/modules/companies/hooks/useCompanyManagement';
import { CompanyBasics } from './CompanyBasics';
import { CompanyRegistration } from './CompanyRegistration';
import { CompanyAdhesions } from './CompanyAdhesions';
import { CompanyFilters } from './CompanyFilters';
import { CompaniesTable } from './CompaniesTable';
import { CompanyAccessPanel } from './CompanyAccessPanel';
import { HostedCompanyDrafts } from './HostedCompanyDrafts';
import { CompanyCycles } from './CompanyCycles';

export function CompaniesPage() {
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const canManage = useCompanyManagementAvailable();
  const search = companiesRoute.useSearch();
  const navigate = useNavigate({ from: '/admin/clientes' });
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
