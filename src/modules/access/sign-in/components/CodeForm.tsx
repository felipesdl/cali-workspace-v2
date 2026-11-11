import { KeyRound, Mail, Send } from 'lucide-react';
import { requestAccessCodeSchema } from '../../../../api/access/schemas';
import { AccessHelp } from './AccessHelp';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../../../components/ds/field/Controls';
import { useState, type ReactNode } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { type HostedAccessApi } from '../../../../api/access/api';
import { Button } from '../../../../components/ds/button/Button';
import { Field } from '../../../../components/ds/field/Field';
import { CodeInput } from './CodeInput';
import { FormActions } from '../../../../components/ds/button/FormActions';

const errorMessage = (error: Error) =>
  error instanceof z.ZodError
    ? 'Confira os campos informados.'
    : 'Não foi possível concluir. Confira os dados e tente novamente.';

export function CodeForm({
  api,
  onConfirmed,
  codeLength = 6,
  qa = false,
  branded = false,
  exitAction,
}: {
  api: Pick<HostedAccessApi, 'verifyCode'> & Partial<Pick<HostedAccessApi, 'requestCode'>>;
  onConfirmed: () => void | Promise<void>;
  codeLength?: 6 | 8;
  qa?: boolean;
  branded?: boolean;
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
  const verifying = sent || verifyOnly;
  const intro = verifyOnly
    ? 'Informe o e-mail e o código da conta de homologação.'
    : sent
      ? `Se o e-mail estiver habilitado, o código chegará em instantes. Informe os ${codeLength} dígitos.`
      : 'Informe o e-mail cadastrado. Você receberá um código numérico de uso único, sem senha para memorizar.';
  const primary = verifying ? 'Entrar no Workspace' : 'Enviar código de acesso';
  return (
    <form
      className={branded ? 'cali-access-form' : 'tw:mt-4 tw:grid tw:gap-4'}
      aria-label="Acesso por código"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {branded && (
        <header>
          <div className="cali-access-steps" aria-hidden="true">
            <span className="active" />
            <span className={verifying ? 'active' : undefined} />
          </div>
          <p className="cali-access-kicker">ACESSO SEGURO · ETAPA {verifying ? 2 : 1} DE 2</p>
          <h1 id="access-title">{verifying ? 'Digite seu código.' : 'Entre no seu Workspace.'}</h1>
        </header>
      )}
      <p className={branded ? 'cali-access-copy' : undefined}>{intro}</p>
      <form.Field name="email">
        {(field) => (
          <Field id="access-email" label="E-mail">
            <div className={branded ? 'cali-access-input' : undefined}>
              {branded && <Mail size={18} aria-hidden="true" />}
              <Input
                id="access-email"
                type="email"
                autoComplete="email"
                required
                value={field.state.value}
                disabled={sent}
                placeholder={branded ? 'voce@empresa.com.br' : undefined}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          </Field>
        )}
      </form.Field>
      {verifying && (
        <form.Field name="code">
          {(field) => (
            <Field id="access-code" label="Código de acesso">
              <div className={branded ? 'cali-access-input' : undefined}>
                {branded && <KeyRound size={18} aria-hidden="true" />}
                <CodeInput
                  id="access-code"
                  value={field.state.value}
                  onChange={field.handleChange}
                  length={codeLength}
                  autoFocus={sent}
                />
              </div>
            </Field>
          )}
        </form.Field>
      )}
      {message && <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage>}
      <form.Subscribe
        selector={(s) => ({ pending: s.isSubmitting, email: s.values.email, code: s.values.code })}
      >
        {({ pending, email, code }) => (
          <>
            <FormActions>
              <Button
                type="submit"
                className={branded ? 'cali-access-submit' : undefined}
                pending={pending}
                disabled={
                  branded &&
                  (!requestAccessCodeSchema.safeParse({ action: 'request', email }).success ||
                    (verifying && code.length !== codeLength))
                }
              >
                {branded &&
                  (verifying ? (
                    <KeyRound size={18} aria-hidden="true" />
                  ) : (
                    <Send size={18} aria-hidden="true" />
                  ))}
                {pending && branded
                  ? 'Aguarde…'
                  : branded
                    ? primary
                    : verifying
                      ? 'Confirmar código'
                      : 'Receber código'}
              </Button>
              {exitAction}
            </FormActions>
            {sent && (
              <FormActions className={branded ? 'cali-access-secondary-actions' : undefined}>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    form.setFieldValue('code', '');
                    setSent(false);
                    setMessage(undefined);
                  }}
                >
                  {branded ? 'Trocar e-mail' : 'Usar outro e-mail'}
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
                  {branded ? 'Reenviar código' : 'Solicitar novo código'}
                </Button>
              </FormActions>
            )}
          </>
        )}
      </form.Subscribe>
      {branded && <AccessHelp />}
    </form>
  );
}
