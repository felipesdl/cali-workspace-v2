import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Panel } from '../../../components/ds/panel/Panel';
import { Field } from '../../../components/ds/field/Field';
import { Input } from '../../../components/ds/field/Controls';
import { ActionForm } from '../../../components/workspace/ActionForm';

const route = getRouteApi('/pre-cadastro/$token');

export function PreRegistrationPage() {
  const { token } = route.useParams();
  const { preRegistration } = useRouteContext({ from: '__root__' });
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="tw:mx-auto tw:grid tw:max-w-xl tw:gap-4 tw:p-4">
      <Panel className="tw:grid tw:gap-4">
        <h1 className="tw:text-title tw:m-0 tw:text-brand">Pré-cadastro da empresa</h1>
        {submitted ? (
          <p role="status">Dados enviados. A CALI vai completar a ficha e liberar os acessos.</p>
        ) : !preRegistration || !z.uuid().safeParse(token).success ? (
          <p>Link indisponível. Solicite um novo link à CALI.</p>
        ) : (
          <ActionForm
            label="Enviar dados da empresa"
            submit={(data) =>
              preRegistration.submit(token, {
                name: String(data.get('name') ?? ''),
                legalName: String(data.get('legalName') ?? ''),
                city: String(data.get('city') ?? ''),
                state: String(data.get('state') ?? ''),
                contact: String(data.get('contact') ?? ''),
                email: String(data.get('email') ?? ''),
              })
            }
            saved={() => setSubmitted(true)}
          >
            {(id) => (
              <>
                <p className="tw:m-0">
                  A CALI usa estes dados para completar a ficha da empresa e conferir os acessos.
                </p>
                <Field id={id + 'name'} label="Nome da empresa">
                  <Input
                    name="name"
                    id={id + 'name'}
                    required
                    maxLength={200}
                    autoComplete="organization"
                  />
                </Field>
                <Field id={id + 'legal'} label="Razão social">
                  <Input name="legalName" id={id + 'legal'} required maxLength={200} />
                </Field>
                <Field id={id + 'city'} label="Cidade">
                  <Input
                    name="city"
                    id={id + 'city'}
                    required
                    maxLength={200}
                    autoComplete="address-level2"
                  />
                </Field>
                <Field id={id + 'state'} label="UF">
                  <Input
                    name="state"
                    id={id + 'state'}
                    required
                    pattern="[A-Za-z]{2}"
                    maxLength={2}
                    autoComplete="address-level1"
                  />
                </Field>
                <Field id={id + 'contact'} label="Pessoa de contato">
                  <Input
                    name="contact"
                    id={id + 'contact'}
                    required
                    maxLength={200}
                    autoComplete="name"
                  />
                </Field>
                <Field id={id + 'email'} label="E-mail de trabalho">
                  <Input
                    name="email"
                    id={id + 'email'}
                    required
                    maxLength={254}
                    type="email"
                    autoComplete="email"
                  />
                </Field>
              </>
            )}
          </ActionForm>
        )}
      </Panel>
    </main>
  );
}
