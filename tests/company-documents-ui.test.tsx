import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import { createCompaniesService } from '../src/api/modules/companies/service';
import { createMockHttpClient } from '../src/mocks/http/client';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());
async function openApp(unavailable = false) {
  const original = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const service = unavailable ? { ...original, management: null } : original;
  const cache = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/admin/clientes?companyId=${mockCompanyIds.Norte}`] }),
    cache,
  );
  router.update({
    context: { queryClient: cache, session: null, access: null, companies: service },
  });
  await act(async () => {
    await router.load();
  });
  render(
    <StrictMode>
      <App router={router} />
    </StrictMode>,
  );
  await screen.findByRole('heading', { name: 'Acessos · Norte Digital' }, { timeout: 5000 });
  return { service, user: userEvent.setup() };
}
const syntheticFile = () =>
  new File(['%PDF-1.4 sintético'], 'sintetico.pdf', { type: 'application/pdf' });
describe('interface de contratos e aditivos', () => {
  it('anexa, versiona, cancela e retira preservando histórico/foco', async () => {
    const { user, service } = await openApp();
    await user.click(await screen.findByRole('button', { name: 'Anexar contrato ou aditivo' }));
    await user.upload(screen.getByLabelText('Arquivo do documento'), syntheticFile());
    await user.click(screen.getByRole('button', { name: 'Confirmar anexo' }));
    await screen.findByText('sintetico.pdf · versão 1');
    await waitFor(() => expect(document.activeElement?.id).toBe('contract-documents-title'));
    await user.click(screen.getByRole('button', { name: 'Nova versão de sintetico.pdf' }));
    expect(
      (screen.getByRole('button', { name: 'Retirar sintetico.pdf' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancelar anexo' }));
    await user.click(screen.getByRole('button', { name: 'Nova versão de sintetico.pdf' }));
    await user.upload(screen.getByLabelText('Arquivo do documento'), syntheticFile());
    await user.click(screen.getByRole('button', { name: 'Confirmar anexo' }));
    await screen.findByText('sintetico.pdf · versão 2');
    await user.click(screen.getByText('Versões anteriores de sintetico.pdf'));
    expect(screen.getByRole('button', { name: 'Baixar sintetico.pdf, versão 1' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retirar sintetico.pdf' }));
    await user.type(screen.getByLabelText('Motivo da retirada'), 'Documento substituído');
    await user.click(screen.getByRole('button', { name: 'Confirmar retirada' }));
    await screen.findByText('Motivo da retirada: Documento substituído');
    await user.click(screen.getByText('Histórico dos arquivos'));
    const panel = screen.getByRole('region', { name: 'Contratos e aditivos' });
    expect(within(panel).getByText(/Documento retirado/)).toBeTruthy();
    expect(await service.management?.documents.list(mockCompanyIds.Norte)).toHaveLength(2);
  }, 15000);
  it('erro mantém arquivo/data, bloqueia cancelamento pendente e não cria arquivo em falha', async () => {
    const { user, service } = await openApp();
    if (!service.management) throw new Error('Sem gestão');
    const attach = vi
      .spyOn(service.management.documents, 'attach')
      .mockRejectedValueOnce(new Error('Anexo indisponível.'));
    await user.click(await screen.findByRole('button', { name: 'Anexar contrato ou aditivo' }));
    await user.type(screen.getByLabelText('Data do documento'), '2026-11-03');
    await user.upload(screen.getByLabelText('Arquivo do documento'), syntheticFile());
    await user.click(screen.getByRole('button', { name: 'Confirmar anexo' }));
    await screen.findByText('Anexo indisponível.');
    expect(screen.getByText(/Selecionado: sintetico.pdf/)).toBeTruthy();
    expect((screen.getByLabelText('Data do documento') as HTMLInputElement).value).toBe(
      '2026-11-03',
    );
    let rejectPending: (reason: Error) => void = () => {
      throw new Error('Sem solicitação');
    };
    attach.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectPending = reject;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar anexo' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Cancelar anexo' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    await act(async () => rejectPending(new Error('Falha preservada.')));
    await user.click(screen.getByRole('button', { name: 'Cancelar anexo' }));
    expect(await service.management.documents.list(mockCompanyIds.Norte)).toEqual([]);
  });
  it('capacidade hospedada indisponível não expõe gestão de arquivos', async () => {
    await openApp(true);
    expect(screen.queryByRole('region', { name: 'Contratos e aditivos' })).toBeNull();
  });
});
