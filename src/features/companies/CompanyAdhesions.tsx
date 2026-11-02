import { useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { registerWorkspaceAdhesionSchema } from '../../api/modules/access/adhesion';
import {
  useCompanyAdhesions,
  useCompanyManagementAvailable,
  useRegisterCompanyAdhesion,
} from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';

function AdhesionForm({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const register = useRegisterCompanyAdhesion();
  const form = useForm({
    defaultValues: { evidenceReference: '' },
    validators: {
      onChange: registerWorkspaceAdhesionSchema.pick({ evidenceReference: true }),
      onSubmit: registerWorkspaceAdhesionSchema.pick({ evidenceReference: true }),
    },
    onSubmit: async ({ value }) => {
      try {
        await register.mutateAsync({ requestId, companyId, ...value });
        onClose();
      } catch {
        /* Rascunho preservado; nenhum aceite jurídico é criado. */
      }
    },
  });
  return (
    <form
      aria-label="Registrar referência de adesão"
      className="tw:mt-4 tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="evidenceReference">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <Field id="adhesion-reference" label="Referência da formalização" error={error}>
              <input
                id="adhesion-reference"
                autoFocus
                required
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                disabled={register.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'adhesion-reference-error' : 'adhesion-help'}
              />
            </Field>
          );
        }}
      </form.Field>
      <p id="adhesion-help" className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Informe onde a formalização pode ser conferida. O registro da referência não valida o
        documento nem substitui o aceite individual dos termos.
      </p>
      {register.isError && <p role="alert">{register.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || register.isPending}>
              Registrar referência
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={register.isPending} onClick={onClose}>
          Cancelar registro
        </Button>
      </div>
    </form>
  );
}
function AdhesionPanel({ companyId }: { companyId: string }) {
  const adhesions = useCompanyAdhesions(companyId);
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section
      aria-labelledby="adhesions-title"
      aria-busy={adhesions.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="adhesions-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-brand"
      >
        Adesão da empresa
      </h2>
      {adhesions.isPending && <p role="status">Carregando referências…</p>}
      {adhesions.isError && (
        <div role="alert">
          <p>Não foi possível confirmar a adesão. Novas autorizações permanecem indisponíveis.</p>
          <Button variant="secondary" onClick={() => void adhesions.refetch()}>
            Recarregar referências
          </Button>
        </div>
      )}
      {adhesions.isSuccess && (
        <>
          {adhesions.data.length === 0 ? (
            <p>Nenhuma referência registrada. Registre a adesão antes de autorizar acessos.</p>
          ) : (
            <ol className="tw:my-4 tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
              {adhesions.data.map((item) => (
                <li key={item.id}>
                  <strong>{item.evidenceReference}</strong>
                  <div className="tw:text-caption tw:text-muted-copy">
                    Admin demonstrativo · {formatServerInstant(item.recordedAt)}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!open && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Registrar adesão
            </Button>
          )}
        </>
      )}
      {open && (
        <AdhesionForm
          companyId={companyId}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => heading.current?.focus());
          }}
        />
      )}
    </section>
  );
}
export function CompanyAdhesions({ companyId }: { companyId: string }) {
  return useCompanyManagementAvailable() ? <AdhesionPanel companyId={companyId} /> : null;
}
