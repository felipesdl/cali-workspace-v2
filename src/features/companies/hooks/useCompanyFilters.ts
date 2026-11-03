import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { companiesRoute } from '../../../app/router';
import { companyFilterSchema } from '../../../api/modules/companies/schemas';

export function useCompanyFilters() {
  const search = companiesRoute.useSearch();
  const navigate = useNavigate({ from: '/admin/clientes' });
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
  function clear() {
    form.reset({ q: '', status: 'all' });
    void navigate({ search: { q: '', status: 'all', companyId: undefined } });
  }
  return { form, clear };
}
