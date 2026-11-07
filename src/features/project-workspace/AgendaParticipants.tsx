import { type AppointmentParticipant } from '../../api/modules/project-workspace/agenda';

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

export function AgendaParticipants({ people }: { people?: AppointmentParticipant[] }) {
  if (!people?.length) return null;
  return (
    <details>
      <summary>Participantes ({people.length})</summary>
      <ul>
        {people.map(({ id, name, role, status }) => (
          <li key={id}>
            {name ? name + ' · ' : ''}
            {roles[role]} · {responses[status]}
          </li>
        ))}
      </ul>
    </details>
  );
}
