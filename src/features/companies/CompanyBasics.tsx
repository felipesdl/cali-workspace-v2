import { useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useCompanyQuery } from '../../api/modules/companies/hooks/useCompanyQuery';
import { useUpdateCompanyBasics } from '../../api/modules/companies/hooks/useUpdateCompanyBasics';
import { companyBasicFieldsSchema, type CompanyDetails } from '../../api/modules/companies/schemas';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';

function CompanyBasicsEditor({
  company,
  onClose,
  onReload,
}: {
  company: CompanyDetails;
  onClose: (saved: boolean) => void;
  onReload: () => void;
}) {
  const [expected] = useState(() => ({
    displayName: company.displayName,
    legalName: company.legalName,
  }));
  const update = useUpdateCompanyBasics();
  const form = useForm({
    defaultValues: expected,
    validators: { onChange: companyBasicFieldsSchema, onSubmit: companyBasicFieldsSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync({ companyId: company.id, expected, values: value });
        onClose(true);
      } catch {
        // A mutation preserva o erro; o formulário mantém o rascunho sem repetir gravação.
      }
    },
  });
  return (
    <form
      aria-label="Editar dados da empresa"
      className="tw:grid tw:gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1">
        {(
          [
            ['displayName', 'Nome de apresentação'],
            ['legalName', 'Razão social'],
          ] as const
        ).map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              const id = `company-${name}`;
              return (
                <Field id={id} label={label} error={error}>
                  <input
                    id={id}
                    name={name}
                    autoFocus={name === 'displayName'}
                    autoComplete="off"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    disabled={update.isPending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error
                        ? `${id}-error`
                        : name === 'legalName'
                          ? 'company-legal-help'
                          : undefined
                    }
                    required={name === 'displayName'}
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>
      <p id="company-legal-help" className="tw:m-0 tw:text-caption tw:text-muted-copy">
        Se a razão social ficar em branco, será usado o nome de apresentação.
      </p>
      {update.isError && (
        <div role="alert">
          <p>{update.error.message}</p>
          <Button variant="secondary" onClick={onReload}>
            Descartar rascunho e recarregar
          </Button>
        </div>
      )}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, submitting]) => (
            <Button type="submit" disabled={!canSubmit} pending={submitting || update.isPending}>
              Salvar dados
            </Button>
          )}
        </form.Subscribe>
        <Button variant="secondary" disabled={update.isPending} onClick={() => onClose(false)}>
          Cancelar edição
        </Button>
      </div>
    </form>
  );
}

export function CompanyBasics({ companyId }: { companyId: string }) {
  const company = useCompanyQuery(companyId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <section
      aria-labelledby="company-basics-title"
      aria-busy={company.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="company-basics-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-4 tw:text-section tw:font-bold tw:text-brand"
      >
        Dados da empresa
      </h2>
      {company.isPending && <p role="status">Carregando dados da empresa…</p>}
      {company.isError && (
        <div role="alert">
          <p>Não foi possível carregar os dados da empresa.</p>
          <Button variant="secondary" onClick={() => void company.refetch()}>
            Recarregar dados
          </Button>
        </div>
      )}
      {company.data &&
        (editing ? (
          <CompanyBasicsEditor
            company={company.data}
            onClose={(confirmed) => {
              setEditing(false);
              setSaved(confirmed);
              requestAnimationFrame(() => heading.current?.focus());
            }}
            onReload={() => {
              setEditing(false);
              setSaved(false);
              void company.refetch();
            }}
          />
        ) : (
          <>
            <dl className="tw:grid tw:grid-cols-2 tw:gap-4 tw:mobile:grid-cols-1 tw:[&_dd]:m-0 tw:[&_dd]:wrap-anywhere tw:[&_dt]:text-caption tw:[&_dt]:text-muted-copy">
              <div>
                <dt>Nome de apresentação</dt>
                <dd>{company.data.displayName}</dd>
              </div>
              <div>
                <dt>Razão social</dt>
                <dd>{company.data.legalName || 'Não informada'}</dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              Editar dados da empresa
            </Button>
          </>
        ))}
      {saved && <p role="status">Dados da empresa salvos.</p>}
    </section>
  );
}
