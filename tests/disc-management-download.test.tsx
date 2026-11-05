import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscManagement } from '../src/api/modules/disc/schemas';
import { ManagementReport } from '../src/features/disc/ManagementReport';

const { downloadMutation, useDiscDownload } = vi.hoisted(() => {
  const downloadMutation = vi.fn();
  return { downloadMutation, useDiscDownload: vi.fn() };
});

vi.mock('../src/api/modules/disc/hooks', () => ({ useDiscDownload }));

const report: DiscManagement = {
  id: '1577c6df-08ed-45d1-bd45-0f1603ba043b',
  title: 'Leitura DISC',
  organization: 'Empresa sintética',
  goal: null,
  note: null,
  moment: null,
  sector: null,
  mode: 'qualitative',
  sample_size: null,
  distribution: null,
  quantitative: null,
  qualitative: { dominant: 'Leitura do grupo.', pressure: 'Leitura sob pressão.' },
  approved_at: '2026-11-05T12:00:00Z',
  released_at: '2026-11-05T12:00:00Z',
  protocol: 'DISC-TESTE',
  signer: null,
  revision: 2,
};

describe('DISC management PDF download boundary', () => {
  beforeEach(() => {
    downloadMutation
      .mockReset()
      .mockResolvedValue(new Blob(['synthetic-pdf'], { type: 'application/pdf' }));
    useDiscDownload.mockReturnValue({
      mutateAsync: downloadMutation,
      isPending: false,
      isError: false,
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:disc-management'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it.each(['client', 'admin'] as const)(
    'downloads the management report for %s without an individual result id',
    async (audience) => {
      const user = userEvent.setup();
      render(
        <ManagementReport
          report={report}
          audience={audience}
          campaignId="4c0ce414-90bf-4cf0-a61f-514ecdeea972"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Baixar PDF aprovado' }));

      expect(useDiscDownload).toHaveBeenCalledWith(audience);
      expect(downloadMutation).toHaveBeenCalledWith({
        campaignId: '4c0ce414-90bf-4cf0-a61f-514ecdeea972',
        resultId: null,
      });
    },
  );
});
