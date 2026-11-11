import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AuditResults } from '../src/modules/admin/audit/components/AuditResults';

it('agrupa a auditoria pelo dia de Brasília e preserva a identificação dos eventos', () => {
  render(
    <AuditResults
      entries={[
        {
          id: 'first',
          at: '2026-11-11T02:45:00Z',
          event: 'report_pdf_generated',
          entity: 'report',
          objectId: null,
          actorName: 'Pessoa CALI',
          revision: 2,
          protocol: 'REL-002',
        },
        {
          id: 'second',
          at: '2026-11-10T22:00:00Z',
          event: 'report_approve',
          entity: 'report',
          objectId: null,
          actorName: 'Pessoa CALI',
          revision: null,
          protocol: null,
        },
        {
          id: 'third',
          at: '2026-11-10T21:00:00Z',
          event: 'commercial_proposal_resent',
          entity: 'commercial_proposal',
          objectId: null,
          actorName: 'Pessoa CALI',
          revision: 3,
          protocol: 'PROP-003',
        },
      ]}
    />,
  );

  expect(screen.getByRole('heading', { name: /10 de novembro de 2026/ })).toBeTruthy();
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  const [pdf, approval] = screen.getAllByRole('listitem');
  expect(within(pdf).getByText('23:45').getAttribute('datetime')).toBe('2026-11-11T02:45:00Z');
  expect(within(pdf).getByText('REL-002')).toBeTruthy();
  expect(within(pdf).getByText('Revisão 2')).toBeTruthy();
  expect(within(approval).getByText('Aprovou relatório')).toBeTruthy();
  expect(screen.getByText('Reenviou proposta pelo Workspace')).toBeTruthy();
});
