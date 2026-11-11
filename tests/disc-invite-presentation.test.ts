import { describe, expect, it } from 'vitest';
import {
  inviteProgressLabel,
  inviteStatusLabel,
} from '../src/modules/admin/disc/invite-presentation';

describe('apresentação de convites DISC', () => {
  it('traduz todos os estados do contrato e preserva progresso explícito', () => {
    expect(
      (
        [
          'created',
          'queued',
          'sent',
          'opened',
          'started',
          'declined',
          'expired',
          'completed',
        ] as const
      ).map(inviteStatusLabel),
    ).toEqual([
      'Na fila',
      'Agendado',
      'Aguardando resposta',
      'Visualizado',
      'Parcial',
      'Recusou',
      'Expirado',
      'Respondido',
    ]);
    expect(inviteProgressLabel('started', 7)).toBe('Parou no bloco 7');
    expect(inviteProgressLabel('expired', 7)).toBe('Parou no bloco 7');
    expect(inviteProgressLabel('completed', 24)).toBeNull();
    expect(inviteProgressLabel('opened', 0)).toBeNull();
    expect(inviteProgressLabel('started', null)).toBeNull();
  });
});
