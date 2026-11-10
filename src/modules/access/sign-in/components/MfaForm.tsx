import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../../../components/ds/field/Controls';
import { type ReactNode } from 'react';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { useForm } from '@tanstack/react-form';
import { type HostedAccessApi } from '../../../../api/access/api';
import { Button } from '../../../../components/ds/button/Button';
import { Field } from '../../../../components/ds/field/Field';
import { CodeInput } from './CodeInput';
import { useMfaEnrollment } from '../hooks/useMfaEnrollment';
import { FormActions } from '../../../../components/ds/button/FormActions';

export function MfaForm({
  api,
  onConfirmed,
  audience = 'Admin',
  exitAction,
}: {
  api: HostedAccessApi;
  onConfirmed: () => Promise<void>;
  audience?: 'Admin' | 'Partner';
  exitAction?: ReactNode;
}) {
  const { factor, enrollment, loading, failed, message, setMessage, setEnrollment, retry, enroll } =
    useMfaEnrollment(api);
  const form = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      if (!factor) return;
      setMessage('');
      try {
        await api.verifyMfa(factor, value.code);
        setEnrollment(null);
        await onConfirmed();
      } catch {
        setMessage('Não foi possível confirmar o autenticador. Confira o código.');
      }
    },
  });
  if (loading)
    return (
      <>
        <FeedbackState kind="loading">Consultando autenticador…</FeedbackState>
        {exitAction && <FormActions className="tw:mt-3">{exitAction}</FormActions>}
      </>
    );
  if (failed)
    return (
      <>
        <FeedbackState kind="error">Não foi possível consultar o autenticador.</FeedbackState>
        <FormActions className="tw:mt-3">
          <Button onClick={retry}>Tentar novamente</Button>
          {exitAction}
        </FormActions>
      </>
    );
  return (
    <div className="tw:mt-4 tw:grid tw:gap-4">
      <p>
        {audience} exige confirmação pelo aplicativo autenticador. Falha nesta etapa mantém o acesso
        bloqueado.
      </p>
      {!factor && (
        <FormActions>
          <Button pending={loading} onClick={() => void enroll()}>
            Configurar autenticador
          </Button>
          {exitAction}
        </FormActions>
      )}
      {enrollment && (
        <div className="tw:grid tw:gap-3">
          <p>Leia o QR code no seu aplicativo autenticador e confirme o código abaixo.</p>
          <img
            src={enrollment.qrCode}
            alt="QR code para configurar seu autenticador CALI"
            width={220}
            height={220}
          />
          <Field id="totp-secret" label="Chave para configuração manual">
            <Input
              id="totp-secret"
              type="password"
              readOnly
              autoComplete="off"
              value={enrollment.secret}
            />
          </Field>
        </div>
      )}
      {factor && (
        <form
          className="tw:grid tw:gap-4"
          aria-label="Confirmação do autenticador"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="code">
            {(field) => (
              <Field id="mfa-code" label="Código do autenticador">
                <CodeInput
                  id="mfa-code"
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoFocus
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => (
              <FormActions>
                <Button type="submit" pending={pending}>
                  Confirmar autenticador
                </Button>
                {exitAction}
              </FormActions>
            )}
          </form.Subscribe>
        </form>
      )}
      {message && <FeedbackMessage tone="error">{message}</FeedbackMessage>}
    </div>
  );
}
