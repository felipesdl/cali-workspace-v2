import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { usePilotReservations } from '../../api/modules/companies/hooks/usePilotReservations';
import { pilotInviteFields } from '../../api/modules/companies/pilot-reservations';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

export function PilotInviteReservation({ companyId }: { companyId: string }) {
  const { available, query, reserve, cancel } = usePilotReservations(companyId);
  const [request, setRequest] = useState<{ key: string; id: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const form = useForm({
    defaultValues: { name: '', email: '' },
    validators: { onSubmit: pilotInviteFields },
    onSubmit: async ({ value }) => {
      const values = pilotInviteFields.parse(value);
      const key = JSON.stringify(values);
      const next = request?.key === key ? request : { key, id: crypto.randomUUID() };
      setRequest(next);
      try {
        await reserve.mutateAsync({ requestId: next.id, values });
        form.reset();
        setRequest(undefined);
      } catch {
        // A mensagem da operação e os dados digitados ficam na ficha.
      }
    },
  });
  if (!available) return null;
  return (
    <section aria-labelledby={id} className="tw:mt-4 tw:grid tw:gap-3">
      <h3 id={id} className="tw:m-0 tw:text-body tw:font-bold">
        Reservar acesso de teste
      </h3>
      <p className="tw:m-0">A pessoa convidada solicita o código na página de acesso.</p>
      {query.isPending && <FeedbackState kind="loading">Carregando reservas…</FeedbackState>}
      {query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível consultar as reservas.
        </FeedbackState>
      )}
      {query.data && query.data.length > 0 && (
        <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
          {query.data.map((invite) => (
            <li key={invite.id} className="tw:grid tw:gap-2 tw:wrap-anywhere">
              <span>
                {invite.name} · {invite.email} · Aguardando primeiro acesso
              </span>
              <div className="tw:flex tw:flex-wrap tw:gap-2">
                {selected === invite.id ? (
                  <>
                    <Button
                      pending={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(invite.id, {
                          onSuccess: () => {
                            setSelected(null);
                            reserve.reset();
                          },
                        })
                      }
                    >
                      Confirmar cancelamento
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={cancel.isPending}
                      onClick={() => setSelected(null)}
                    >
                      Manter reserva
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={cancel.isPending}
                    onClick={() => {
                      cancel.reset();
                      setSelected(invite.id);
                    }}
                  >
                    Cancelar reserva
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {cancel.isError && <FeedbackState kind="error">{cancel.error.message}</FeedbackState>}
      <form
        className="tw:grid tw:gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {(['name', 'email'] as const).map((name) => (
          <form.Field name={name} key={name}>
            {(field) => {
              const fieldId = `${id}-${name}`;
              const error = field.state.meta.errors[0]?.message;
              return (
                <Field
                  id={fieldId}
                  label={name === 'name' ? 'Nome do cliente' : 'E-mail de teste aprovado'}
                  error={error}
                >
                  <input
                    id={fieldId}
                    type={name === 'email' ? 'email' : 'text'}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                    aria-invalid={Boolean(error)}
                    disabled={reserve.isPending}
                    required
                  />
                </Field>
              );
            }}
          </form.Field>
        ))}
        {reserve.isError && <FeedbackState kind="error">{reserve.error.message}</FeedbackState>}
        {reserve.isSuccess && <p role="status">Vaga reservada. Aguardando primeiro acesso.</p>}
        <Button type="submit" className="tw:justify-self-start" pending={reserve.isPending}>
          Reservar vaga
        </Button>
      </form>
    </section>
  );
}
