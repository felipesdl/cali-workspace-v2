import { type AppointmentParticipant } from '../../api/modules/project-workspace/agenda';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

const roles: Record<AppointmentParticipant['role'], string> = {
  admin: 'CALI',
  client: 'Cliente',
  external: 'Convidado',
};
const responses: Record<AppointmentParticipant['status'], string> = {
  pending: 'Resposta pendente',
  accepted: 'Confirmou presença',
  declined: 'Recusou',
  tentative: 'Presença a confirmar',
};

export function AgendaParticipants({
  people = [],
  changeGuest,
}: {
  people?: AppointmentParticipant[];
  changeGuest?: (
    request: string,
    guest: { id: string } | { name: string; email: string },
  ) => Promise<string>;
}) {
  if (!people.length && !changeGuest) return null;
  return (
    <details>
      <summary>Participantes ({people.length})</summary>
      <ul>
        {people.map(({ id, name, role, status, canRemove }) => (
          <li key={id}>
            {name ? name + ' · ' : ''}
            {roles[role]} · {responses[status]}
            {changeGuest && canRemove && (
              <ActionForm
                label="Retirar convidado"
                submit={(_, request) => changeGuest(request, { id })}
              />
            )}
          </li>
        ))}
      </ul>
      {changeGuest && (
        <ActionForm
          label="Adicionar convidado"
          submit={(fields, request) =>
            changeGuest(request, {
              name: String(fields.get('name') ?? ''),
              email: String(fields.get('email') ?? ''),
            })
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'name'} label="Nome do convidado">
                <input id={prefix + 'name'} name="name" minLength={2} maxLength={140} required />
              </Field>
              <Field id={prefix + 'email'} label="E-mail do convidado">
                <input id={prefix + 'email'} name="email" type="email" maxLength={254} required />
              </Field>
              <p>O convidado aparece na agenda do Workspace.</p>
            </>
          )}
        </ActionForm>
      )}
    </details>
  );
}
