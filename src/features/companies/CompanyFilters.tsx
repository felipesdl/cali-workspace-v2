import { companyFilterSchema, companyStatus } from '../../api/modules/companies/schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { companyStatusLabels } from './presentation';
import { useCompanyFilters } from './hooks/useCompanyFilters';

export function CompanyFilters() {
  const { form, clear } = useCompanyFilters();
  return (
    <form
      className="tw:grid tw:grid-cols-[minmax(160px,1fr)_minmax(150px,220px)_auto] tw:items-end tw:gap-4 tw:compact:grid-cols-2 tw:mobile:grid-cols-1"
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
                  {companyStatusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </form.Field>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:compact:col-span-full tw:compact:justify-start">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={isSubmitting}>
              Aplicar filtros
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" onClick={clear}>
          Limpar
        </Button>
      </div>
    </form>
  );
}
