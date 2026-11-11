import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import { createCompaniesService } from '../src/api/admin/companies/service';
import { createMockHttpClient } from '../src/mocks/http/client';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';
beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto);
  // O fluxo começa na ficha. A transformação do módulo lazy não faz parte desse teste.
  await import('../src/modules/admin/companies/CompaniesPage');
});
afterAll(() => vi.unstubAllGlobals());
async function openApp(withDocument = false) {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const management = service.management;
  if (!management) throw new Error('Sem gestão');
  const companyId = mockCompanyIds.Norte;
  const reference = await management.registerAdhesion({
    requestId: crypto.randomUUID(),
    companyId,
    evidenceReference: 'Formalização sintética Q',
  });
  const document = withDocument
    ? await management.documents.attach(
        {
          requestId: crypto.randomUUID(),
          companyId,
          documentType: 'contract',
          documentDate: null,
          documentId: null,
          expectedVersionId: null,
        },
        new File(['PDF sintético'], 'prova.pdf', { type: 'application/pdf' }),
      )
    : null;
  const cache = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({
      initialEntries: [`/admin/clientes?companyId=${companyId}&tab=Contrato`],
    }),
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
  await screen.findByRole('button', { name: 'Conferir adesão' });
  return { management, reference, document, user: userEvent.setup(), service, router };
}
async function draft(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Conferir adesão' }));
  await user.selectOptions(
    screen.getByLabelText('Referência a comprovar'),
    'Formalização sintética Q',
  );
  await user.type(screen.getByLabelText('Como a adesão foi conferida'), 'Conferência sintética');
}
const confirmation = 'Confirmo que conferi a formalização indicada para esta empresa.';
describe('interface de comprovação administrativa', () => {
  it('referência não libera acesso; exige confirmação ligada ao rascunho e retirada preserva histórico', async () => {
    const { user, management } = await openApp();
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      ((await screen.findByRole('button', { name: 'Adicionar acesso' })) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Contrato' }));
    await draft(user);
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.type(screen.getByLabelText('Como a adesão foi conferida'), ' revisada');
    expect((screen.getByRole('checkbox', { name: confirmation }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Confirmar comprovação',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.click(screen.getByRole('button', { name: 'Confirmar comprovação' }));
    await screen.findByText(/Vigente para novas autorizações/);
    await waitFor(() => expect(document.activeElement?.id).toBe('adhesion-evidence-title'));
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      ((await screen.findByRole('button', { name: 'Adicionar acesso' })) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await user.click(screen.getByRole('tab', { name: 'Contrato' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Retirar comprovação de Formalização sintética Q',
      }),
    );
    await user.type(
      screen.getByLabelText('Motivo da retirada da comprovação'),
      'Referência revisada',
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar retirada da comprovação' }));
    await screen.findByText(/Comprovação retirada/);
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      ((await screen.findByRole('button', { name: 'Adicionar acesso' })) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(await management.evidence.list(mockCompanyIds.Norte)).toMatchObject([
      { status: 'retracted', retraction: { reason: 'Referência revisada' } },
    ]);
  });
  it('versão alterada depois da seleção recusa confirmação e mantém observação', async () => {
    const { user, management, document } = await openApp(true);
    if (!document) throw new Error('Sem documento');
    await draft(user);
    await user.selectOptions(screen.getByLabelText('Arquivo vinculado (opcional)'), document.id);
    await management.documents.attach(
      {
        requestId: crypto.randomUUID(),
        companyId: document.companyId,
        documentType: document.documentType,
        documentDate: null,
        documentId: document.documentId,
        expectedVersionId: document.id,
      },
      new File(['Outra versão'], 'novo.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.click(screen.getByRole('button', { name: 'Confirmar comprovação' }));
    await screen.findByText('O documento mudou ou foi retirado. Confira a versão corrente.');
    expect(
      (screen.getByLabelText('Como a adesão foi conferida') as HTMLTextAreaElement).value,
    ).toBe('Conferência sintética');
    expect(await management.evidence.list(mockCompanyIds.Norte)).toEqual([]);
  });
  it('pendência bloqueia cancelamento; falha preserva rascunho e trocar empresa descarta formulário', async () => {
    const { user, management } = await openApp();
    let rejectPending: (reason: Error) => void = () => {
      throw new Error('Sem solicitação');
    };
    vi.spyOn(management.evidence, 'confirm').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectPending = reject;
        }),
    );
    await draft(user);
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.click(screen.getByRole('button', { name: 'Confirmar comprovação' }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Cancelar comprovação',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    await act(async () => rejectPending(new Error('Conferência indisponível.')));
    await screen.findByText('Conferência indisponível.');
    expect(
      (screen.getByLabelText('Como a adesão foi conferida') as HTMLTextAreaElement).value,
    ).toBe('Conferência sintética');
    await user.click(screen.getByRole('button', { name: 'Ver acessos de Aurora Tecnologia' }));
    await screen.findByRole('heading', { name: 'Acessos · Aurora Tecnologia' });
    expect(screen.queryByRole('form', { name: 'Conferir adesão da empresa' })).toBeNull();
    expect(await management.evidence.list(mockCompanyIds.Norte)).toEqual([]);
  });
});
