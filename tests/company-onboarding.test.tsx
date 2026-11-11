import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createQueryClient } from '../src/api/query-client';
import { createCompaniesService, type CompaniesService } from '../src/api/admin/companies/service';
import { createMockHttpClient } from '../src/mocks/http/client';
import { createCompaniesMockAdapter } from '../src/mocks/adapters/companies';
import { mockCompanyIds } from '../src/mocks/fixtures/companies';

async function openApp(entry = '/admin/clientes', unavailable = false) {
  const original = createCompaniesService(createMockHttpClient(createCompaniesMockAdapter()));
  const service: CompaniesService = unavailable ? { ...original, management: null } : original;
  const cache = createQueryClient();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [entry] }), cache);
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
  await screen.findByRole('form', { name: 'Filtrar empresas' }, { timeout: 5000 });
  return { user: userEvent.setup(), service, router };
}
async function register(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Registrar adesão' }));
  await user.type(screen.getByLabelText('Referência da formalização'), 'Contrato sintético A');
  await user.click(screen.getByRole('button', { name: 'Registrar referência' }));
  await screen.findByText('Contrato sintético A');
  await user.click(screen.getByRole('button', { name: 'Conferir adesão' }));
  await user.selectOptions(screen.getByLabelText('Referência a comprovar'), 'Contrato sintético A');
  await user.type(
    screen.getByLabelText('Como a adesão foi conferida'),
    'Conferência sintética externa',
  );
  await user.click(
    screen.getByRole('checkbox', {
      name: 'Confirmo que conferi a formalização indicada para esta empresa.',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Confirmar comprovação' }));
  await screen.findByText(/Vigente para novas autorizações/);
}
async function add(user: ReturnType<typeof userEvent.setup>, email = 'novo@example.test') {
  await user.click(screen.getByRole('button', { name: 'Adicionar acesso' }));
  await user.type(screen.getByLabelText('Nome da pessoa'), 'Pessoa teste');
  await user.type(screen.getByLabelText('E-mail do acesso'), email);
  await user.click(screen.getByRole('button', { name: 'Confirmar autorização' }));
  await screen.findByRole('button', { name: `Revogar acesso de ${email}` });
}
describe('jornada demonstrativa de cadastro, adesão e gestão de acessos', () => {
  it('oferece uma única ação de acesso por empresa em uma tabela responsiva', async () => {
    const { user, router } = await openApp();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Aurora Tecnologia')).toBeTruthy();
    expect(within(table).getByText('CALI Full')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver acessos de Aurora Tecnologia' }));
    await screen.findByRole('heading', { name: 'Acessos · Aurora Tecnologia' });
    expect(router.state.location.search.companyId).toBe(mockCompanyIds.Aurora);
  });

  it('cadastra, exige adesão, autoriza, edita nome e revoga/reativa com histórico', async () => {
    const errors = vi.spyOn(console, 'error');
    const { user, router, service } = await openApp();
    await user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    await user.type(screen.getByLabelText('Nome de apresentação'), 'Orbe sintética');
    await user.click(screen.getByRole('button', { name: 'Confirmar cadastro' }));
    expect(await screen.findByRole('heading', { name: 'Ficha da empresa' })).toBeTruthy();
    expect(router.state.location.search.companyId).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('company-basics-title'));
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      (screen.getByRole('button', { name: 'Adicionar acesso' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Contrato' }));
    await register(user);
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    await add(user);
    await waitFor(() => expect(document.activeElement?.id).toBe('access-usage'));
    await user.click(screen.getByRole('button', { name: 'Editar nome de novo@example.test' }));
    await user.clear(screen.getByLabelText('Nome do acesso'));
    await user.type(screen.getByLabelText('Nome do acesso'), 'Pessoa corrigida');
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => expect(screen.queryByLabelText('Nome do acesso')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Revogar acesso de novo@example.test' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar alteração' }));
    expect(
      screen.getByRole('button', { name: 'Revogar acesso de novo@example.test' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Revogar acesso de novo@example.test' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar revogação' }));
    await user.click(
      await screen.findByRole('button', { name: 'Reautorizar acesso de novo@example.test' }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar reautorização' }));
    await screen.findByRole('button', { name: 'Revogar acesso de novo@example.test' });
    await user.click(screen.getByText('Histórico dos acessos'));
    expect(await screen.findByText('Autorização revogada · Pessoa corrigida')).toBeTruthy();
    const companyId = router.state.location.search.companyId;
    if (!companyId) throw new Error('Cadastro sem seleção');
    expect(await service.accesses(companyId)).toMatchObject([
      { email: 'novo@example.test', status: 'active', invitedOn: null, name: 'Pessoa corrigida' },
    ]);
    expect(errors).not.toHaveBeenCalled();
  }, 20000);

  it('quatro acessos equivalentes ocupam vagas; revogar preserva o registro e só libera uma vaga', async () => {
    const { user, service } = await openApp(`/admin/clientes?companyId=${mockCompanyIds.Aurora}`);
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    await screen.findByText('4 de 4 autorizações utilizadas');
    await user.click(screen.getByRole('tab', { name: 'Contrato' }));
    await register(user);
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      (screen.getByRole('button', { name: 'Adicionar acesso' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(
      screen.getByRole('button', { name: 'Revogar acesso de contato1.empresa1@example.test' }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar revogação' }));
    await screen.findByText('3 de 4 autorizações utilizadas');
    await add(user, 'quinto@example.test');
    expect(await screen.findByText('4 de 4 autorizações utilizadas')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Reautorizar acesso de contato1.empresa1@example.test',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(await service.accesses(mockCompanyIds.Aurora)).toHaveLength(5);
  }, 15000);

  it('cancelar cadastro não cria empresa', async () => {
    const { user, service } = await openApp();
    const management = service.management;
    if (!management) throw new Error('Sem gestão');
    const create = vi.spyOn(management, 'create');
    await user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    await user.type(screen.getByLabelText('Nome de apresentação'), 'Rascunho');
    await user.click(screen.getByRole('button', { name: 'Cancelar cadastro' }));
    expect(create).not.toHaveBeenCalled();
    expect(await service.list({ q: 'Rascunho', status: 'all' })).toEqual([]);
  });

  it('capacidade indisponível preserva consulta sem mostrar cadastro/adesão/gestão', async () => {
    const { user } = await openApp(`/admin/clientes?companyId=${mockCompanyIds.Aurora}`, true);
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      await screen.findByRole('heading', { name: 'Acessos · Aurora Tecnologia' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cadastrar empresa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar adesão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Adicionar acesso' })).toBeNull();
    expect(screen.getByText('contato1.empresa1@example.test')).toBeTruthy();
  });
  it('erro de referência mantém rascunho e não libera autorizações', async () => {
    const { user, service } = await openApp(`/admin/clientes?companyId=${mockCompanyIds.Norte}`);
    const management = service.management;
    if (!management) throw new Error('Sem gestão');
    const save = vi
      .spyOn(management, 'registerAdhesion')
      .mockRejectedValue(new Error('Registro indisponível.'));
    await user.click(screen.getByRole('tab', { name: 'Contrato' }));
    await user.click(await screen.findByRole('button', { name: 'Registrar adesão' }));
    await user.type(screen.getByLabelText('Referência da formalização'), 'Rascunho de referência');
    await user.click(screen.getByRole('button', { name: 'Registrar referência' }));
    expect(await screen.findByText('Registro indisponível.')).toBeTruthy();
    expect((screen.getByLabelText('Referência da formalização') as HTMLInputElement).value).toBe(
      'Rascunho de referência',
    );
    expect(save).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('tab', { name: 'Acessos' }));
    expect(
      (screen.getByRole('button', { name: 'Adicionar acesso' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('criação que termina depois de sair da página não restaura a rota anterior', async () => {
    const { user, service, router } = await openApp();
    const management = service.management;
    if (!management) throw new Error('Sem gestão');
    const original = management.create.bind(management);
    let release = () => {};
    vi.spyOn(management, 'create').mockImplementation(async (input) => {
      const result = await original(input);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return result;
    });
    await user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    await user.type(screen.getByLabelText('Nome de apresentação'), 'Criação pendente');
    await user.click(screen.getByRole('button', { name: 'Confirmar cadastro' }));
    act(() => {
      void router.navigate({ to: '/cliente/horas' });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/cliente/horas'));
    await act(async () => {
      release();
    });
    expect(router.state.location.pathname).toBe('/cliente/horas');
  });
});
