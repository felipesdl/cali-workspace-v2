import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { type ClientDriveService } from '../src/api/client/drive';
import { ClientDrive } from '../src/modules/client/documents/components/ClientDrive';

it('mostra conexão Drive e ação de cópia no acervo do Cliente', async () => {
  const fileId = '10000000-0000-4000-8000-000000000001';
  const service = {
    status: vi.fn(async () => ({
      connected: true,
      connection: {
        id: '20000000-0000-4000-8000-000000000001',
        accountEmail: 'cliente@example.test',
        rootFolderName: 'CALI',
        status: 'connected',
      },
      jobs: [],
    })),
    files: vi.fn(async () => [
      {
        id: fileId,
        title: 'Relatório aprovado',
        deliveryId: null,
        deliveryTitle: null,
        source: 'document' as const,
      },
    ]),
    authorize: vi.fn(async () => 'https://accounts.google.com/authorize'),
    copyFile: vi.fn(async () => ({
      status: 'synced' as const,
      url: 'https://drive.google.com/file/d/file-1',
    })),
    copyFolder: vi.fn(async () => ({
      status: 'synced' as const,
      url: 'https://drive.google.com/drive/folders/folder-1',
      copied: 1,
      failed: 0,
    })),
    disconnect: vi.fn(async () => undefined),
    exchange: vi.fn(async () => undefined),
  } satisfies ClientDriveService;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={cache}>
      <ClientDrive service={service} company="company-1" actor="actor-1" />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByText(
      'cliente@example.test. Você escolhe quais versões copiar para o Drive da empresa.',
    ),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar Relatório aprovado' }));
  expect(await screen.findByText('Cópia concluída no Google Drive.')).toBeTruthy();
  expect(service.copyFile).toHaveBeenCalledWith(fileId, 'document');
});
