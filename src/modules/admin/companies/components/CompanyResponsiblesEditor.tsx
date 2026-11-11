import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field } from '../../../../components/ds/field/Field';
import { Select } from '../../../../components/ds/field/Controls';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { type AdminReadService } from '../../../../api/admin/workspace/admin-read';

export function CompanyResponsiblesEditor({
  company,
  service,
}: {
  company: string;
  service: AdminReadService;
}) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['company-responsibles', company],
    queryFn: ({ signal }) => service.responsibleOptions(company, signal),
  });
  const save = useMutation({
    mutationFn: ({ admin, partner }: { admin: string; partner: string | null }) => {
      if (!query.data) throw new Error('Atualize as designações antes de salvar.');
      return service.saveResponsibles(company, query.data.updatedAt, admin, partner);
    },
    onSuccess: async () => cache.invalidateQueries({ queryKey: ['company-responsibles', company] }),
  });
  if (query.isPending)
    return <FeedbackState kind="loading">Consultando designações…</FeedbackState>;
  if (query.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void query.refetch()}>
        Não foi possível consultar as designações da conta.
      </FeedbackState>
    );
  const value = query.data;
  return (
    <form
      className="tw:grid tw:max-w-2xl tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const admin = String(form.get('caliAdmin') ?? '');
        if (!admin) return;
        void save.mutateAsync({ admin, partner: String(form.get('partner') ?? '') || null });
      }}
    >
      <p className="tw:m-0 tw:text-muted-copy">
        Essas pessoas aparecem como contatos responsáveis no início do cliente. O parceiro
        disponível precisa estar ativo e já vinculado a esta empresa.
      </p>
      <Field id="company-cali-responsible" label="Responsável CALI">
        <Select
          id="company-cali-responsible"
          name="caliAdmin"
          defaultValue={value.caliAdminId ?? ''}
          required
        >
          <option value="">Selecione uma pessoa</option>
          {value.admins.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="company-partner-responsible" label="Parceiro de apoio">
        <Select
          id="company-partner-responsible"
          name="partner"
          defaultValue={value.partnerStaffId ?? ''}
        >
          <option value="">Sem parceiro designado</option>
          {value.partners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      {save.isError && (
        <p role="alert" className="tw:text-danger tw:m-0">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="tw:m-0">
          Designações salvas.
        </p>
      )}
      <Button type="submit" pending={save.isPending}>
        Salvar responsáveis
      </Button>
    </form>
  );
}
