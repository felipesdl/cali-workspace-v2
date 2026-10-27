import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { companiesRoute } from '../../app/router';
import { useCompaniesQuery } from '../../api/modules/companies/hooks/useCompaniesQuery';
import { useCompanyAccessesQuery } from '../../api/modules/companies/hooks/useCompanyAccessesQuery';
import { useCompanyQuery } from '../../api/modules/companies/hooks/useCompanyQuery';
import { companyFilterSchema, companyStatus } from '../../api/modules/companies/schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatCalendarDate } from '../../lib/dates';
import './companies.css';

const statusLabels = {
  all: 'Todas as situações',
  active: 'Ativa',
  paused: 'Pausada',
  blocked: 'Bloqueada',
  closed: 'Encerrada',
} as const;

export function CompaniesPage() {
  const search = companiesRoute.useSearch();
  const navigate = useNavigate({ from: '/admin/clientes' });
  const companies = useCompaniesQuery({ q: search.q, status: search.status });
  const accesses = useCompanyAccessesQuery(search.companyId);
  const selectedCompany = useCompanyQuery(search.companyId);
  const form = useForm({
    defaultValues: { q: search.q, status: search.status },
    validators: { onChange: companyFilterSchema, onSubmit: companyFilterSchema },
    onSubmit: async ({ value }) => {
      const filters = companyFilterSchema.parse(value);
      await navigate({ search: { ...filters, companyId: undefined } });
    },
  });

  useEffect(() => {
    form.reset({ q: search.q, status: search.status });
  }, [form, search.q, search.status]);

  return (
    <div className="companies-page">
      <form
        className="companies-filters"
        aria-label="Filtrar empresas"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="q">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <Field id="company-search" label="Nome da empresa" error={error}>
                <input
                  id="company-search"
                  name={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'company-search-error' : undefined}
                  autoComplete="off"
                />
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="status">
          {(field) => (
            <Field id="company-status" label="Situação">
              <select
                id="company-status"
                name={field.name}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(companyFilterSchema.shape.status.parse(event.target.value))
                }
                onBlur={field.handleBlur}
              >
                {(['all', ...Object.values(companyStatus)] as const).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <div className="companies-filter-actions">
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit} pending={isSubmitting}>
                Aplicar filtros
              </Button>
            )}
          </form.Subscribe>
          <Button
            variant="secondary"
            onClick={() => {
              form.reset({ q: '', status: 'all' });
              void navigate({ search: { q: '', status: 'all', companyId: undefined } });
            }}
          >
            Limpar
          </Button>
        </div>
      </form>

      <section
        className="companies-list"
        aria-labelledby="companies-title"
        aria-busy={companies.isFetching}
      >
        <h2 id="companies-title">Empresas</h2>
        {companies.isPending && <p role="status">Carregando empresas…</p>}
        {companies.isError && (
          <div role="alert">
            <p>Não foi possível carregar as empresas.</p>
            <Button variant="secondary" onClick={() => void companies.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {companies.isSuccess && companies.data.length === 0 && (
          <p>Nenhuma empresa encontrada com estes filtros.</p>
        )}
        {companies.isSuccess && companies.data.length > 0 && (
          <div
            className="companies-table-scroll"
            role="region"
            aria-label="Tabela de empresas; role horizontalmente para ver todas as colunas"
            tabIndex={0}
          >
            <table>
              <caption className="companies-caption">
                {companies.data.length}{' '}
                {companies.data.length === 1 ? 'empresa no resultado' : 'empresas no resultado'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Cadastro</th>
                  <th scope="col">Acessos</th>
                </tr>
              </thead>
              <tbody>
                {companies.data.map((company) => (
                  <tr key={company.id}>
                    <th scope="row">{company.displayName}</th>
                    <td>{company.plan === 'full' ? 'CALI Full' : 'CALI Partner'}</td>
                    <td>{statusLabels[company.status]}</td>
                    <td>{formatCalendarDate(company.createdOn)}</td>
                    <td>
                      <Button
                        variant="secondary"
                        aria-label={`Ver acessos de ${company.displayName}`}
                        onClick={() =>
                          void navigate({ search: { ...search, companyId: company.id } })
                        }
                      >
                        Ver acessos
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {companies.isSuccess && companies.data.length > 0 && (
          <p className="companies-scroll-hint">
            Role a tabela para ver todas as colunas e acessos.
          </p>
        )}
      </section>

      {search.companyId && (
        <section
          className="companies-accesses"
          aria-labelledby="accesses-title"
          aria-busy={accesses.isFetching}
        >
          <div className="companies-section-head">
            <div>
              <h2 id="accesses-title">
                Acessos{selectedCompany.data ? ` · ${selectedCompany.data.displayName}` : ''}
              </h2>
              <p>Até quatro acessos Cliente equivalentes por empresa.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void navigate({ search: { ...search, companyId: undefined } })}
            >
              Fechar acessos
            </Button>
          </div>
          {accesses.isPending && <p role="status">Carregando acessos…</p>}
          {accesses.isError && (
            <p role="alert">Não foi possível carregar os acessos desta empresa.</p>
          )}
          {accesses.isSuccess && accesses.data.length === 0 && <p>Nenhum acesso nesta empresa.</p>}
          {accesses.isSuccess && accesses.data.length > 0 && (
            <ul className="companies-access-list">
              {accesses.data.map((access) => (
                <li key={access.id}>
                  <strong>{access.name}</strong>
                  <span>{access.email}</span>
                  <span>
                    {access.status === 'active' ? 'Ativo' : 'Revogado'} · Convite em{' '}
                    {formatCalendarDate(access.invitedOn)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="companies-demo-note">
        Demonstração local com dados fictícios. Cadastro, convites e alterações reais serão
        disponibilizados após a integração e validação de acesso.
      </p>
    </div>
  );
}
