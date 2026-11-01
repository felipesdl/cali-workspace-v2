import { useEffect, useState, useSyncExternalStore } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { type HostedAccessApi } from '../../api/modules/access/api';
import { type SessionState, type SessionController } from '../../app/session/controller';
import { safeReturnPath } from '../../app/session/guard';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';

const errorMessage = (error: Error) =>
  error instanceof z.ZodError
    ? 'Confira os campos informados.'
    : 'Não foi possível concluir. Confira os dados e tente novamente.';

export function AccessFlow({
  api,
  session,
  returnTo,
}: {
  api: HostedAccessApi;
  session: SessionController;
  returnTo: string;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [agreedKey, setAgreedKey] = useState<string | null>(null);
  const access = state.phase === 'resolved' ? state.access : null;
  useEffect(() => {
    void session.resolve();
  }, [session]);
  useEffect(() => {
    if (access?.status !== 'ready') return;
    const target = safeReturnPath(returnTo);
    const ownPrefix = access.profile?.role === 'admin' ? '/admin' : '/cliente';
    const destination =
      target.split(/[/?]/)[1] === ownPrefix.slice(1)
        ? target
        : ownPrefix === '/admin'
          ? '/admin/clientes'
          : '/cliente';
    void navigate({ to: destination, replace: true });
  }, [access, navigate, returnTo]);
  const acceptanceKey =
    access?.profile && access.terms
      ? `${access.profile.id}:${access.terms.version}:${access.terms.contentHash}`
      : null;
  const agreed = Boolean(acceptanceKey && agreedKey === acceptanceKey);

  async function accept() {
    if (!access?.terms || !agreed || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await api.acceptTerms({
        version: access.terms.version,
        contentHash: access.terms.contentHash,
      });
      await session.refresh();
    } catch {
      setMessage('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  const status = access?.status;
  return (
    <main className="tw:grid tw:min-h-screen tw:place-items-center tw:bg-ivory tw:p-6 tw:text-body tw:text-copy tw:mobile:p-4">
      <section
        className="tw:box-border tw:w-full tw:max-w-2xl tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-6 tw:mobile:p-4"
        aria-labelledby="access-title"
        aria-busy={busy || state.phase === 'loading'}
      >
        <p className="tw:mb-6 tw:font-bold tw:tracking-widest tw:text-brand">CALI · WORKSPACE</p>
        <h1 id="access-title" className="tw:text-section tw:font-bold tw:text-brand">
          {status === 'terms_required'
            ? 'Termos de uso e privacidade'
            : status === 'mfa_required'
              ? 'Confirme seu acesso Admin'
              : 'Acesse seu Workspace'}
        </h1>
        {state.phase === 'loading' || state.phase === 'idle' ? (
          <p role="status">Confirmando acesso…</p>
        ) : state.phase === 'error' ? (
          <div role="alert">
            <p>Não foi possível confirmar seu acesso.</p>
            <Button onClick={() => void session.refresh()}>Tentar novamente</Button>
          </div>
        ) : status === 'blocked' ? (
          <p role="alert">Seu acesso está indisponível. Entre em contato com a CALI.</p>
        ) : status === 'mfa_required' ? (
          <MfaForm api={api} onConfirmed={() => session.refresh()} />
        ) : status === 'terms_required' && access?.terms ? (
          <>
            <p>Leia os documentos antes de continuar. Versão {access.terms.version}.</p>
            <div
              className="tw:my-4 tw:max-h-96 tw:overflow-auto tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:leading-note tw:wrap-anywhere"
              tabIndex={0}
              aria-label="Termos de uso e política de privacidade"
            >
              {access.terms.content.split('\n').map((line, lineNumber) => (
                <p key={`${access.terms?.version}-line-${lineNumber}`} className="tw:my-2">
                  {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
            <label className="tw:my-4 tw:flex tw:items-start tw:gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreedKey(e.target.checked ? acceptanceKey : null)}
              />
              Li e aceito os termos de uso e a política de privacidade.
            </label>
            <Button disabled={!agreed} pending={busy} onClick={() => void accept()}>
              Aceitar e continuar
            </Button>
          </>
        ) : status === 'ready' ? (
          <p role="status">Abrindo seu Workspace…</p>
        ) : (
          <CodeForm api={api} onConfirmed={() => session.refresh()} />
        )}
        {message && <p role="alert">{message}</p>}
        {access?.profile && (
          <div className="tw:mt-6">
            <Button variant="secondary" onClick={() => void session.signOut()}>
              Sair
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}

function CodeForm({
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
              <input
                id="access-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
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

function MfaForm({
  api,
  onConfirmed,
}: {
  api: HostedAccessApi;
  onConfirmed: () => Promise<SessionState>;
}) {
  const [factor, setFactor] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Awaited<
    ReturnType<HostedAccessApi['enrollMfa']>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .factors()
      .then((factors) => {
        if (active) setFactor((factors.find((f) => f.verified) ?? factors[0])?.id ?? null);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, revision]);
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
  if (loading) return <p role="status">Consultando autenticador…</p>;
  if (failed)
    return (
      <div role="alert">
        <p>Não foi possível consultar o autenticador.</p>
        <Button
          onClick={() => {
            setLoading(true);
            setFailed(false);
            setRevision((v) => v + 1);
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  return (
    <div className="tw:mt-4 tw:grid tw:gap-4">
      <p>
        Admin exige confirmação pelo aplicativo autenticador. Falha nesta etapa mantém o acesso
        bloqueado.
      </p>
      {!factor && (
        <Button
          pending={loading}
          onClick={async () => {
            setLoading(true);
            setMessage('');
            try {
              const result = await api.enrollMfa();
              setEnrollment(result);
              setFactor(result.id);
            } catch {
              setMessage('Não foi possível configurar o autenticador. Tente novamente.');
            } finally {
              setLoading(false);
            }
          }}
        >
          Configurar autenticador
        </Button>
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
            <input
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
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => (
              <Button type="submit" pending={pending}>
                Confirmar autenticador
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
