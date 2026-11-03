import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { type HostedAccessApi } from '../../api/modules/access/api';
import { type SessionState } from '../../app/session/controller';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { CodeInput } from './CodeInput';

const errorMessage = (error: Error) =>
  error instanceof z.ZodError
    ? 'Confira os campos informados.'
    : 'Não foi possível concluir. Confira os dados e tente novamente.';

export function CodeForm({
  api,
  onConfirmed,
}: {
  api: HostedAccessApi;
  onConfirmed: () => Promise<SessionState>;
}) {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const form = useForm({
    defaultValues: { email: '', code: '' },
    onSubmit: async ({ value }) => {
      setMessage('');
      try {
        if (sent) {
          await api.verifyCode(value.email, value.code);
          await onConfirmed();
        } else {
          await api.requestCode(value.email);
          setSent(true);
          setRetryAt(Date.now() + 120000);
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? errorMessage(error) : 'Não foi possível concluir o acesso.',
        );
      }
    },
  });
  return (
    <form
      className="tw:mt-4 tw:grid tw:gap-4"
      aria-label="Acesso por código"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p>
        {sent
          ? 'Se o e-mail estiver habilitado, o código chegará em instantes. Informe os seis dígitos.'
          : 'Informe seu e-mail cadastrado para receber um código de acesso.'}
      </p>
      <form.Field name="email">
        {(field) => (
          <Field id="access-email" label="E-mail">
            <input
              id="access-email"
              type="email"
              autoComplete="email"
              required
              value={field.state.value}
              disabled={sent}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </Field>
        )}
      </form.Field>
      {sent && (
        <form.Field name="code">
          {(field) => (
            <Field id="access-code" label="Código de acesso">
              <CodeInput id="access-code" value={field.state.value} onChange={field.handleChange} />
            </Field>
          )}
        </form.Field>
      )}
      {message && <p role="alert">{message}</p>}
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(pending) => (
          <>
            <Button type="submit" pending={pending}>
              {sent ? 'Confirmar código' : 'Receber código'}
            </Button>
            {sent && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  form.setFieldValue('code', '');
                  setSent(false);
                  setMessage('');
                }}
              >
                Usar outro e-mail
              </Button>
            )}
            {sent && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () => {
                  if (Date.now() < retryAt) {
                    setMessage('Aguarde dois minutos antes de solicitar outro código.');
                    return;
                  }
                  try {
                    setRetryAt(Date.now() + 120000);
                    await api.requestCode(form.state.values.email);
                    setMessage('Solicitação enviada. Confira seu e-mail.');
                  } catch {
                    setMessage('Não foi possível reenviar. Aguarde e tente novamente.');
                  }
                }}
              >
                Solicitar novo código
              </Button>
            )}
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
