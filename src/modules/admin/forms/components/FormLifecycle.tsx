import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormLifecycle as Lifecycle } from '../../../../api/admin/forms/lifecycle';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { Checkbox } from '../../../../components/ds/checkbox/Checkbox';
import { Input } from '../../../../components/ds/field/Controls';
import { Field } from '../../../../components/ds/field/Field';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../../lib/dates';

export function FormOptions({
  service,
  company,
  form,
  title,
  actor,
}: {
  service: Lifecycle;
  company: string;
  form: string;
  title: string;
  actor?: string;
}) {
  const cache = useQueryClient();
  const key = ['form-options', actor, company, form];
  const options = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => service.options(company, form, signal),
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['phase4-forms', actor, company] }),
      cache.invalidateQueries({ queryKey: ['form-trash', actor, company] }),
    ]);
  }
  return (
    <details className="tw:grid tw:gap-3">
      <summary className="tw:cursor-pointer tw:font-semibold">Configurações e lixeira</summary>
      <div className="tw:mt-3 tw:grid tw:gap-3">
        {options.isPending && (
          <FeedbackState kind="loading">Consultando configurações…</FeedbackState>
        )}
        {options.isError && (
          <FeedbackState kind="error" onRetry={() => void options.refetch()}>
            {options.error.message}
          </FeedbackState>
        )}
        {options.data && (
          <>
            <ActionForm
              key={options.data.updatedAt}
              label="Salvar confirmação por e-mail"
              submit={async (fields) => {
                const result = await service.configure(
                  company,
                  form,
                  options.data.updatedAt,
                  fields.get('confirmation') === 'on',
                );
                await refresh();
                return result;
              }}
            >
              {(prefix) => (
                <Checkbox
                  id={prefix + 'confirmation'}
                  name="confirmation"
                  defaultChecked={options.data.confirmEmail}
                >
                  Enviar cópia das respostas para o e-mail informado no formulário.
                </Checkbox>
              )}
            </ActionForm>
            <ActionForm
              label="Mover formulário para lixeira"
              submit={async (fields) => {
                const result = await service.remove(
                  company,
                  form,
                  options.data.updatedAt,
                  String(fields.get('title') ?? ''),
                );
                await refresh();
                return result;
              }}
            >
              {(prefix) => (
                <Field id={prefix + 'title'} label={`Digite “${title}” para confirmar`}>
                  <Input id={prefix + 'title'} name="title" required autoComplete="off" />
                  <span>
                    O link deixa de receber respostas. A restauração fica disponível por 30 dias.
                  </span>
                </Field>
              )}
            </ActionForm>
          </>
        )}
      </div>
    </details>
  );
}

export function FormTrash({
  service,
  company,
  actor,
}: {
  service: Lifecycle;
  company: string;
  actor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const key = ['form-trash', actor, company];
  const trash = useQuery({
    queryKey: [...key, page],
    queryFn: ({ signal }) => service.trash(company, page, signal),
    enabled: open,
  });
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="tw:rounded-control tw:border tw:border-border-default tw:p-4"
    >
      <summary className="tw:cursor-pointer tw:font-semibold">Lixeira de formulários</summary>
      <div className="tw:mt-4 tw:grid tw:gap-3">
        <p className="tw:m-0">
          Itens excluídos há menos de 30 dias. Formulários restaurados voltam com a coleta
          encerrada.
        </p>
        {trash.isPending && <FeedbackState kind="loading">Consultando lixeira…</FeedbackState>}
        {trash.isError && (
          <FeedbackState kind="error" onRetry={() => void trash.refetch()}>
            {trash.error.message}
          </FeedbackState>
        )}
        {trash.data?.length === 0 && <p>Nenhum item nesta página.</p>}
        {trash.data?.map((item) => (
          <article
            key={item.id}
            className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4"
          >
            <h3 className="tw:m-0">{item.title}</h3>
            <p className="tw:m-0">
              {item.kind === 'form' ? 'Formulário' : 'Respostas'} · {item.responseCount} resposta(s)
              · {formatServerInstant(item.deletedAt)}
            </p>
            <ActionForm
              label="Restaurar item"
              submit={async () => {
                const id = await service.restore(company, item.id);
                await Promise.all([
                  cache.invalidateQueries({ queryKey: key }),
                  cache.invalidateQueries({ queryKey: ['phase4-forms', actor, company] }),
                ]);
                return id;
              }}
            >
              {(prefix) => (
                <Checkbox id={prefix + item.id} required>
                  Confirmo a restauração deste item.
                </Checkbox>
              )}
            </ActionForm>
          </article>
        ))}
        {(page > 1 || trash.data?.length === 25) && (
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={trash.data?.length !== 25}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
