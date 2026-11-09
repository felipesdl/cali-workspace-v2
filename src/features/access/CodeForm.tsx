import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { useState, type ReactNode } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { type HostedAccessApi } from '../../api/modules/access/api';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { CodeInput } from './CodeInput';
import { AccessActions } from './AccessActions';

const errorMessage = (error: Error) =>
  error instanceof z.ZodError
    ? 'Confira os campos informados.'
    : 'Não foi possível concluir. Confira os dados e tente novamente.';

export function CodeForm({
  api,
  onConfirmed,
  codeLength = 6,
  qa = false,
  exitAction,
}: {
  api: Pick<HostedAccessApi, 'verifyCode'> & Partial<Pick<HostedAccessApi, 'requestCode'>>;
  onConfirmed: () => void | Promise<void>;
  codeLength?: 6 | 8;
  qa?: boolean;
  exitAction?: ReactNode;
}) {
  const [sent, setSent] = useState(false);
  const verifyOnly = !api.requestCode;
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [retryAt, setRetryAt] = useState(0);
  const form = useForm({
    defaultValues: { email: '', code: '' },
    onSubmit: async ({ value }) => {
      setMessage(undefined);
      try {
        if (sent || verifyOnly) {
          await api.verifyCode(value.email, value.code);
          await onConfirmed();
        } else {
          await api.requestCode?.(value.email);
          setSent(true);
          setRetryAt(Date.now() + 120000);
        }
      } catch (error) {
        setMessage({
          tone: 'error',
          text:
            error instanceof Error
              ? qa && !(error instanceof z.ZodError)
                ? error.message
                : errorMessage(error)
              : 'Não foi possível concluir o acesso.',
        });
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
        {verifyOnly
          ? 'Informe o e-mail e o código da conta de homologação.'
          : sent
            ? `Se o e-mail estiver habilitado, o código chegará em instantes. Informe os ${codeLength} dígitos.`
            : 'Informe seu e-mail cadastrado para receber um código de acesso.'}
      </p>
      <form.Field name="email">
        {(field) => (
          <Field id="access-email" label="E-mail">
            <Input
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
      {(sent || verifyOnly) && (
        <form.Field name="code">
          {(field) => (
            <Field id="access-code" label="Código de acesso">
              <CodeInput
                id="access-code"
                value={field.state.value}
                onChange={field.handleChange}
                length={codeLength}
                autoFocus={sent}
              />
            </Field>
          )}
        </form.Field>
      )}
      {message && <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage>}
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(pending) => (
          <>
            <AccessActions>
              <Button type="submit" pending={pending}>
                {sent || verifyOnly ? 'Confirmar código' : 'Receber código'}
              </Button>
              {exitAction}
            </AccessActions>
            {sent && (
              <AccessActions>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    form.setFieldValue('code', '');
                    setSent(false);
                    setMessage(undefined);
                  }}
                >
                  Usar outro e-mail
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    if (Date.now() < retryAt) {
                      setMessage({
                        tone: 'error',
                        text: 'Aguarde dois minutos antes de solicitar outro código.',
                      });
                      return;
                    }
                    try {
                      setRetryAt(Date.now() + 120000);
                      await api.requestCode?.(form.state.values.email);
                      setMessage({
                        tone: 'success',
                        text: 'Solicitação enviada. Confira seu e-mail.',
                      });
                    } catch {
                      setMessage({
                        tone: 'error',
                        text: 'Não foi possível reenviar. Aguarde e tente novamente.',
                      });
                    }
                  }}
                >
                  Solicitar novo código
                </Button>
              </AccessActions>
            )}
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
