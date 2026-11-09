import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import { createCompaniesService } from '../src/api/admin/companies/service';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { createMockHttpClient } from '../src/mocks/http/client';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';

async function openEditor(fail = false) {
  const service = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const update = vi.spyOn(service, 'updateBasics');
  if (fail) update.mockRejectedValue(new Error('Dados alterados. Recarregue a empresa.'));
  const cache = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/admin/clientes?companyId=${mockCompanyIds.Aurora}`] }),
    cache,
  );
  router.update({
    context: { queryClient: cache, session: null, access: null, companies: service },
  });
  await act(async () => {
    await router.load();
  });
  render(<App router={router} />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Editar dados da empresa' }, { timeout: 5000 }),
  );
  return { user, update };
}

describe('edição básica de empresa', () => {
  it('salva dados confirmados e atualiza lista/detalhe mantendo acessos', async () => {
    const { user, update } = await openEditor();
    await user.clear(screen.getByLabelText('Nome de apresentação'));
    await user.type(screen.getByLabelText('Nome de apresentação'), 'Aurora Revisada');
    await user.clear(screen.getByLabelText('Razão social'));
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(await screen.findByText('Dados da empresa salvos.')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Acessos · Aurora Revisada' })).toBeTruthy();
    expect(screen.getByText('contato1.empresa1@example.test')).toBeTruthy();
    expect(update).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Editar dados da empresa' }));
    expect((screen.getByLabelText('Razão social') as HTMLInputElement).value).toBe(
      'Aurora Revisada',
    );
  });
  it('cancelar descarta rascunho sem gravar; nome vazio não pode ser salvo', async () => {
    const { user, update } = await openEditor();
    await user.clear(screen.getByLabelText('Nome de apresentação'));
    await user.tab();
    expect(
      (screen.getByRole('button', { name: 'Salvar dados' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByText('Dados da empresa salvos.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Editar dados da empresa' }));
    expect((screen.getByLabelText('Nome de apresentação') as HTMLInputElement).value).toBe(
      'Aurora Tecnologia',
    );
  });
  it('falha mantém rascunho e não repete escrita; descarte explícito recarrega servidor', async () => {
    const { user, update } = await openEditor(true);
    await user.type(screen.getByLabelText('Razão social'), ' revisada');
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(await screen.findByText('Dados alterados. Recarregue a empresa.')).toBeTruthy();
    expect((screen.getByLabelText('Razão social') as HTMLInputElement).value).toBe(
      'Aurora Tecnologia Ltda. revisada',
    );
    expect(update).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Descartar rascunho e recarregar' }));
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Editar dados da empresa' })).toBeNull(),
    );
    expect(screen.queryByText('Dados da empresa salvos.')).toBeNull();
  });
});
