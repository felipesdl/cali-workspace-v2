import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { createHostedCompaniesService } from '../src/api/modules/companies/hosted';
import { type WorkspaceAccessState } from '../src/api/modules/access/session';
import { type CompanyAccount } from '../src/api/modules/companies/schemas';
import { companyKeys } from '../src/api/modules/companies/keys';
const actorId = '20000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000001';
const otherCompanyId = '10000000-0000-4000-8000-000000000002';
const company: CompanyAccount = {
  id: companyId,
  displayName: 'Empresa A sintética',
  legalName: 'Empresa A sintética LTDA',
  status: 'active',
};
function ready(): WorkspaceAccessState {
  return {
    status: 'ready',
    profile: { id: actorId, company_id: companyId, role: 'client', active: true },
    companyStatus: 'active',
    termsAccepted: true,
    terms: {
      version: 'qa-client',
      title: 'Termos sintéticos de teste',
      content: 'Conteúdo sintético exclusivo de teste.',
      contentHash: 'a'.repeat(64),
    },
  };
}
async function openApp(
  options: {
    entry?: string;
    initial?: WorkspaceAccessState;
    read?: () => Promise<CompanyAccount | null>;
  } = {},
) {
  const request = vi.fn(async () => {
    throw new Error('Transporte não esperado no teste de UI.');
  });
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    db: { schema: 'cali_workspace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: request },
  });
  const companies = createHostedCompaniesService(client);
  const account = vi
    .spyOn(companies, 'account')
    .mockImplementation(options.read ?? (async () => company));
  const list = vi.spyOn(companies, 'list');
  const accesses = vi.spyOn(companies, 'accesses');
  const source = {
    read: vi.fn(async () => options.initial ?? ready()),
    signOut: vi.fn(async () => {}),
  };
  const cache = createQueryClient();
  const session = createSessionController(source, cache);
  const history = createMemoryHistory({ initialEntries: [options.entry ?? '/cliente/empresa'] });
  const router = createAppRouter(history, cache, session);
  router.update({ context: { queryClient: cache, session, access: null, companies } });
  await act(async () => {
    await router.load();
  });
  render(
    <StrictMode>
      <App router={router} />
    </StrictMode>,
  );
  return {
    account,
    list,
    accesses,
    source,
    cache,
    session,
    history,
    router,
    user: userEvent.setup(),
  };
}
describe('consulta Cliente de empresa e termos', () => {
  it('deriva empresa da sessão; ignora seleção de URL e não consulta lista, convites ou gestão', async () => {
    const { account, list, accesses } = await openApp({
      entry: `/cliente/empresa?companyId=${otherCompanyId}`,
    });
    await screen.findByText(company.displayName);
    expect(account).toHaveBeenCalledWith(companyId, expect.any(AbortSignal));
    expect(list).not.toHaveBeenCalled();
    expect(accesses).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Editar dados' })).toBeNull();
    expect(screen.queryByText('Aurora Tecnologia')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Empresas e acessos' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Minha empresa' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
  it('navega entre início/empresa/termos, suporta Back/Forward e não cria aceite novo', async () => {
    const { user, history, source } = await openApp();
    await screen.findByText(company.displayName);
    await user.click(screen.getByRole('link', { name: 'Termos e privacidade' }));
    await screen.findByText('Conteúdo sintético exclusivo de teste.');
    expect(screen.getByText(/Versão qa-client/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aceitar e continuar' })).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe('workspace-title'));
    act(() => history.back());
    await screen.findByText(company.displayName);
    act(() => history.forward());
    await screen.findByText('Conteúdo sintético exclusivo de teste.');
    await user.click(screen.getByRole('link', { name: 'Início' }));
    await screen.findByRole('heading', { name: 'Seu Workspace' });
    expect(source.read).toHaveBeenCalledTimes(1);
  });
  it('falha de leitura mostra retry sem dados fictícios; linha ausente revalida e recupera consulta', async () => {
    const { account, user } = await openApp({
      read: async () => {
        throw new Error('Permissão interna sintética');
      },
    });
    await screen.findByText('Não foi possível consultar os dados da sua empresa. Tente novamente.');
    expect(screen.queryByText('Permissão interna sintética')).toBeNull();
    expect(screen.queryByText(company.displayName)).toBeNull();
    account.mockResolvedValueOnce(null).mockResolvedValue(company);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('button', { name: 'Revalidar acesso' });
    await user.click(screen.getByRole('button', { name: 'Revalidar acesso' }));
    await screen.findByText(company.displayName);
  });
  it('pausada mantém consulta; leitura bloqueada não exibe identidade mesmo com sessão antiga ready', async () => {
    const { account, cache } = await openApp({
      read: async () => ({ ...company, status: 'paused' }),
    });
    await screen.findByText('Sua conta está pausada. A consulta permanece disponível.');
    account.mockResolvedValue({
      ...company,
      displayName: 'Não mostrar esta identidade',
      status: 'blocked',
    });
    await act(async () => {
      await cache.invalidateQueries({ queryKey: companyKeys.clientAccount(actorId, companyId) });
    });
    await screen.findByText(
      'A consulta desta empresa está indisponível. Revalide seu acesso para continuar.',
    );
    expect(screen.queryByText('Não mostrar esta identidade')).toBeNull();
    expect(screen.queryByText(company.displayName)).toBeNull();
  });
  it('troca de vínculo cancela consulta antiga e resposta tardia não reaparece', async () => {
    let release: (value: CompanyAccount) => void = () => {
      throw new Error('Sem consulta');
    };
    const pending = new Promise<CompanyAccount>((resolve) => {
      release = resolve;
    });
    const { account, session, source, cache } = await openApp({ read: () => pending });
    await screen.findByText('Carregando os dados da sua empresa…');
    const signal = account.mock.calls[0][1];
    account.mockResolvedValue({
      ...company,
      id: otherCompanyId,
      displayName: 'Empresa B sintética',
      legalName: 'Razão B',
    });
    source.read.mockResolvedValue({
      ...ready(),
      profile: { id: actorId, role: 'client', active: true, company_id: otherCompanyId },
    });
    await act(async () => {
      await session.revalidate();
    });
    await screen.findByText('Empresa B sintética');
    expect(signal?.aborted).toBe(true);
    await act(async () => release(company));
    expect(screen.queryByText(company.displayName)).toBeNull();
    expect(cache.getQueryData(companyKeys.clientAccount(actorId, companyId))).toBeUndefined();
  });
  it('logout remove consulta e cache', async () => {
    const { session, cache, user } = await openApp();
    await screen.findByText(company.displayName);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Acesso indisponível' });
    expect(screen.queryByText(company.displayName)).toBeNull();
    expect(session.getSnapshot().phase).toBe('signed_out');
    expect(cache.getQueryData(companyKeys.clientAccount(actorId, companyId))).toBeUndefined();
  });
  it.each(['terms_required', 'blocked'] as const)(
    'guarda %s impede consulta e preserva retorno',
    async (status) => {
      const { account, router } = await openApp({
        initial: { ...ready(), status, termsAccepted: status !== 'terms_required' },
      });
      await screen.findByRole('heading', { name: 'Acesso indisponível' });
      expect(account).not.toHaveBeenCalled();
      expect(router.state.location.search.returnTo).toBe('/cliente/empresa');
    },
  );
  it('módulo sem integração mantém título/destino corretos e retorno ao início', async () => {
    const { user, account } = await openApp({ entry: '/cliente/horas' });
    await screen.findByRole('heading', { name: 'Horas' });
    expect(account).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }));
    await screen.findByRole('heading', { name: 'Seu Workspace' });
  });
  it('papel Admin não recebe a consulta Cliente por URL direta', async () => {
    const { account } = await openApp({
      initial: {
        ...ready(),
        profile: { id: actorId, role: 'admin', company_id: null, active: true },
      },
    });
    await screen.findByRole('heading', { name: 'Acesso indisponível' });
    expect(account).not.toHaveBeenCalled();
  });
  it('localiza módulos do Cliente por rótulo sem acentos e preserva as capacidades do menu', async () => {
    const { user } = await openApp({ entry: '/cliente' });
    await screen.findByRole('heading', { name: 'Seu Workspace' });
    const menu = screen.getByRole('button', { name: 'Menu principal' });
    await user.click(menu);
    const search = screen.getByRole('searchbox', { name: 'Buscar módulo' });
    await user.type(search, 'termos e privacidade');
    expect(screen.getByRole('link', { name: 'Termos e privacidade' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Minha empresa' })).toBeNull();
    await user.clear(search);
    await user.type(search, 'inicio');
    expect(screen.getByRole('link', { name: 'Início' })).toBeTruthy();
    await user.clear(search);
    await user.type(search, 'empresas e acessos');
    expect(screen.getByText('Nenhum módulo encontrado.')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(menu);
    await user.click(menu);
    expect(screen.getByRole('searchbox', { name: 'Buscar módulo' })).toHaveProperty('value', '');
  });
  it('rotas novas não simulam empresa autenticada no modo demonstrativo', async () => {
    const cache = createQueryClient();
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ['/cliente/empresa'] }),
      cache,
    );
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    await waitFor(() => expect(router.state.location.pathname).toBe('/cliente'));
    expect(screen.queryByRole('region', { name: 'Dados da minha empresa' })).toBeNull();
  });
});
