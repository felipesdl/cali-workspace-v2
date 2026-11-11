import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../../../../components/ds/button/Button';
import { Checkbox } from '../../../../components/ds/checkbox/Checkbox';
import { Field } from '../../../../components/ds/field/Field';
import { Input } from '../../../../components/ds/field/Controls';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Panel } from '../../../../components/ds/panel/Panel';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { formatServerInstant } from '../../../../lib/dates';
import { useWorkspaceSession } from '../../../../api/access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../../../../api/admin/companies/onboarding';
import { companyKeys } from '../../../../api/admin/companies/keys';

const accessSlots = ['primeiro', 'segundo', 'terceiro', 'quarto'] as const;

export function PreRegistrationAdmin({ company }: { company: string }) {
  const { preRegistration } = useRouteContext({ from: '__root__' });
  const access = useWorkspaceSession();
  const actor =
    access.phase === 'resolved' && access.access.status === 'ready'
      ? access.access.profile?.id
      : undefined;
  const cache = useQueryClient();
  const key = ['company-pre-registration', actor, company];
  const enabled = preRegistration && isPilotCompany(company);
  const result = useQuery({
    queryKey: key,
    queryFn:
      preRegistration && enabled && actor
        ? ({ signal }) => preRegistration.read(company, signal)
        : skipToken,
  });
  const [token, setToken] = useState<string>();
  const [recipients, setRecipients] = useState(1);
  const data = result.data;

  if (!preRegistration || !enabled) return null;
  const service = preRegistration;
  return (
    <Panel aria-label="Pré-cadastro" className="tw:grid tw:gap-3">
      <h2 className="tw:m-0 tw:text-section">Pré-cadastro</h2>
      {result.isPending && <FeedbackState kind="loading">Consultando pré-cadastro…</FeedbackState>}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Pré-cadastro indisponível nesta empresa.
        </FeedbackState>
      )}
      {result.isSuccess && !data?.submittedAt && (
        <ActionForm
          label="Gerar link"
          dialog={{ title: 'Gerar link para o cliente', trigger: 'Gerar link de pré-cadastro' }}
          submit={(_, id) => service.issue(company, id)}
          saved={setToken}
        >
          {() => (
            <p>
              O cliente terá sete dias para preencher os dados. Gerar outro link invalida o
              anterior.
            </p>
          )}
        </ActionForm>
      )}
      {token && !data?.submittedAt && (
        <Field id="pre-registration-link" label="Link para copiar e compartilhar">
          <Input
            id="pre-registration-link"
            value={new URL('/pre-cadastro/' + token, window.location.origin).href}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </Field>
      )}
      {data?.fields && (
        <>
          <dl className="tw:m-0 tw:grid tw:gap-2">
            <div>
              <dt>Empresa</dt>
              <dd className="tw:m-0">
                {data.fields.name} · {data.fields.legalName}
              </dd>
            </div>
            <div>
              <dt>Localidade</dt>
              <dd className="tw:m-0">
                {data.fields.city}/{data.fields.state}
              </dd>
            </div>
            <div>
              <dt>Contato</dt>
              <dd className="tw:m-0">
                {data.fields.contact} · {data.fields.email}
              </dd>
            </div>
          </dl>
          {data.releasedAt ? (
            <p>Ficha liberada em {formatServerInstant(data.releasedAt)}.</p>
          ) : (
            <ActionForm
              label="Salvar ficha e liberar acessos"
              dialog={{
                title: 'Salvar ficha e liberar acessos',
                trigger: 'Revisar liberação de acessos',
              }}
              submit={async (form, id) => {
                await service.release(
                  company,
                  id,
                  form.has('signed'),
                  Array.from({ length: recipients }, (_, index) => ({
                    name: String(form.get('name-' + index) ?? ''),
                    email: String(form.get('email-' + index) ?? ''),
                  })),
                );
                await Promise.all([
                  cache.invalidateQueries({ queryKey: key }),
                  cache.invalidateQueries({ queryKey: companyKeys.all(actor ?? '') }),
                ]);
              }}
            >
              {(prefix) => (
                <>
                  <p>Confira o plano contratado em Cadastro e a comprovação em Contrato.</p>
                  <Checkbox name="signed" required>
                    Conferi o contrato assinado e anexado à ficha.
                  </Checkbox>
                  {accessSlots.slice(0, recipients).map((slot, index) => (
                    <fieldset key={slot} className="tw:grid tw:gap-2">
                      <legend>Acesso {index + 1}</legend>
                      <Field id={prefix + 'name' + index} label="Nome">
                        <Input
                          id={prefix + 'name' + index}
                          name={'name-' + index}
                          required
                          maxLength={200}
                          defaultValue={index === 0 ? data.fields?.contact : undefined}
                        />
                      </Field>
                      <Field id={prefix + 'email' + index} label="E-mail">
                        <Input
                          id={prefix + 'email' + index}
                          name={'email-' + index}
                          type="email"
                          required
                          maxLength={254}
                          defaultValue={index === 0 ? data.fields?.email : undefined}
                        />
                      </Field>
                    </fieldset>
                  ))}
                  <div className="tw:flex tw:flex-wrap tw:gap-2">
                    {recipients < 4 && (
                      <Button variant="secondary" onClick={() => setRecipients(recipients + 1)}>
                        Adicionar acesso
                      </Button>
                    )}
                    {recipients > 1 && (
                      <Button variant="secondary" onClick={() => setRecipients(recipients - 1)}>
                        Remover último acesso
                      </Button>
                    )}
                  </div>
                </>
              )}
            </ActionForm>
          )}
        </>
      )}
    </Panel>
  );
}
