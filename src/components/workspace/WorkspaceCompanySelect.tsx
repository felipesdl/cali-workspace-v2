import { Select } from '../ds/field/Controls';
import { useCompaniesQuery } from '../../api/admin/companies/hooks/useCompaniesQuery';
import { isPilotCompany } from '../../api/admin/companies/onboarding';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Field } from '../ds/field/Field';
import { type Props } from './workspace-presentation';

export function CompanySelect({ search, update }: Props) {
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  if (companies.isPending)
    return <FeedbackState kind="loading">Carregando empresas…</FeedbackState>;
  if (companies.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void companies.refetch()}>
        Não foi possível carregar as empresas.
      </FeedbackState>
    );
  return (
    <Field id="operations-company" label="Empresa de homologação">
      <Select
        id="operations-company"
        value={search.companyId ?? ''}
        onChange={(event) =>
          update({
            companyId: event.currentTarget.value || undefined,
            project: undefined,
            projectView: undefined,
            delivery: undefined,
            task: undefined,
            record: undefined,
            report: undefined,
            reportView: undefined,
            page: 1,
          })
        }
      >
        <option value="">Selecione a empresa</option>
        {companies.data
          .filter((company) => isPilotCompany(company.id))
          .map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
      </Select>
    </Field>
  );
}
