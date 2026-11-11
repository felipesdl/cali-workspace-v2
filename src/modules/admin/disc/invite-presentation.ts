import { type DiscInvite } from '../../../api/shared/disc/schemas';

const inviteStatus: Record<DiscInvite['state'], string> = {
  created: 'Na fila',
  queued: 'Agendado',
  sent: 'Aguardando resposta',
  opened: 'Visualizado',
  started: 'Parcial',
  declined: 'Recusou',
  expired: 'Expirado',
  completed: 'Respondido',
};

export function inviteStatusLabel(state: DiscInvite['state']) {
  return inviteStatus[state];
}

export function inviteProgressLabel(state: DiscInvite['state'], lastBlock: number | null) {
  return (state === 'started' || state === 'expired') && lastBlock
    ? `Parou no bloco ${lastBlock}`
    : null;
}
