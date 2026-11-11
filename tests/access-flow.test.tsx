import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { companiesService } from '../src/api/admin/companies/api';
import { type HostedAccessApi } from '../src/api/access/api';
import { acceptCurrentTermsSchema, type WorkspaceAccessState } from '../src/api/access/session';

function fixture(fail = false, signedOut = false) {
  let accepted = false;
  const read = async (): Promise<WorkspaceAccessState> =>
    signedOut
      ? {
          status: 'signed_out',
          profile: null,
          companyStatus: null,
          terms: null,
          termsAccepted: false,
        }
      : {
          status: accepted ? 'ready' : 'terms_required',
          profile: {
            id: '20000000-0000-4000-8000-000000000001',
            company_id: null,
            role: 'admin',
            active: true,
          },
          companyStatus: null,
          termsAccepted: accepted,
          terms: {
            version: 'test-only',
            contentHash: 'a'.repeat(64),
            title: 'Termos sintéticos',
            content: 'Documento exclusivo do teste.',
          },
        };
  const acceptTerms = vi.fn(async (input: Parameters<HostedAccessApi['acceptTerms']>[0]) => {
    acceptCurrentTermsSchema.parse(input);
    if (fail) throw Error('falha de servidor');
    accepted = true;
  });
  const api: HostedAccessApi = {
    read,
    acceptTerms,
    signOut: async () => {},
    requestCode: async () => {},
    verifyCode: async () => {},
    factors: async () => [],
    enrollMfa: async () => ({ id: '', qrCode: '', secret: '' }),
    verifyMfa: async () => {},
    completeCallback: async () => {},
    subscribe: () => () => {},
  };
  const cache = createQueryClient();
  const session = createSessionController(api, cache);
  const router = createAppRouter(
    createMemoryHistory({
      initialEntries: ['/acesso?reason=terms_required&returnTo=%2Fadmin%2Fclientes'],
    }),
    cache,
    session,
    { access: api, companies: companiesService },
  );
  return { router, acceptTerms, session, api };
}

describe('aceite explícito na jornada de acesso', () => {
  it('recupera os termos indisponíveis sem pedir novo código para a sessão atual', async () => {
    const { router, api } = fixture();
    const read = api.read;
    let unavailable = true;
    api.read = async (signal) => {
      const current = await read(signal);
      if (!unavailable) return current;
      unavailable = false;
      return { ...current, status: 'terms_unavailable', terms: null };
    };
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);

    expect(
      await screen.findByText('Os termos estão indisponíveis no momento. Tente novamente.'),
    ).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Acesso por código' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('button', { name: 'Aceitar e continuar' })).toBeTruthy();
  });

  it('envia somente versão/hash e entra apenas após confirmação de servidor', async () => {
    const { router, acceptTerms } = fixture();
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    const check = await screen.findByRole('checkbox');
    const button = screen.getByRole('button', { name: 'Aceitar e continuar' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(check);
    fireEvent.click(button);
    await waitFor(() =>
      expect(acceptTerms).toHaveBeenCalledWith({
        version: 'test-only',
        contentHash: 'a'.repeat(64),
      }),
    );
    expect(
      await screen.findByRole('form', { name: 'Filtrar empresas' }, { timeout: 5000 }),
    ).toBeTruthy();
  });
  it('falha de gravação mantém termos e não abre os dados', async () => {
    const { router } = fixture(true);
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar e continuar' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Não foi possível registrar o aceite. Tente novamente.',
    );
    expect(screen.queryByRole('form', { name: 'Filtrar empresas' })).toBeNull();
  });
});

describe('continuidade antes da autenticação', () => {
  it('permite sair de uma sessão bloqueada sem perfil e voltar ao formulário', async () => {
    const { router, api } = fixture();
    api.read = async () => ({
      status: 'blocked',
      profile: null,
      companyStatus: null,
      terms: null,
      termsAccepted: false,
    });
    api.signOut = vi.fn(async () => {});
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    expect(api.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole('textbox', { name: 'E-mail' })).toBeTruthy();
  });

  it('revalidação ao voltar do e-mail preserva etapa e código digitado', async () => {
    const { router, session, api } = fixture(false, true);
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'E-mail' }), {
      target: { value: 'fixture@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código de acesso' }));
    const code = await screen.findByRole('textbox', { name: 'Código de acesso' });
    fireEvent.change(code, { target: { value: '012345' } });
    const originalRead = api.read;
    let finish = () => {};
    api.read = (signal) =>
      new Promise((resolve) => {
        finish = () => {
          void originalRead(signal).then(resolve);
        };
      });
    const pending = { task: Promise.resolve(session.getSnapshot()) };
    await act(async () => {
      pending.task = session.revalidate();
    });
    await act(async () => {
      finish();
      await pending.task;
    });
    expect(screen.getByRole('textbox', { name: 'Código de acesso' })).toHaveProperty(
      'value',
      '012345',
    );
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveProperty(
      'value',
      'fixture@example.test',
    );
  });
});

describe('composição e ciclo de vida após extração', () => {
  it('mudança de versão não reaproveita checkbox marcado para outro conteúdo', async () => {
    const { router, api, session, acceptTerms } = fixture();
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    const checkbox = await screen.findByRole('checkbox');
    checkbox.focus();
    await userEvent.setup().keyboard(' ');
    expect(checkbox).toHaveProperty('checked', true);
    const previous = await api.read(new AbortController().signal);
    api.read = async () => ({
      ...previous,
      terms: {
        version: 'test-only-v2',
        contentHash: 'b'.repeat(64),
        title: 'Nova versão sintética',
        content: 'Outro conteúdo de teste.',
      },
    });
    await act(async () => {
      await session.revalidate();
    });
    expect(await screen.findByText(/Versão test-only-v2/)).toBeTruthy();
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
    expect(
      screen.getByRole('button', { name: 'Aceitar e continuar' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('MFA mantém bloqueio após falha de leitura e permite retry explícito', async () => {
    const { router, api } = fixture();
    const previous = await api.read(new AbortController().signal);
    api.read = async () => ({ ...previous, status: 'mfa_required' });
    const factors = vi
      .fn<HostedAccessApi['factors']>()
      .mockRejectedValueOnce(new Error('falha simulada'))
      .mockResolvedValueOnce([{ id: 'factor-test', verified: true }]);
    api.factors = factors;
    api.verifyMfa = vi.fn(async () => {
      throw new Error('código simulado inválido');
    });
    await act(async () => {
      await router.load();
    });
    render(<App router={router} />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Não foi possível consultar o autenticador.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    const code = await screen.findByRole('textbox', { name: 'Código do autenticador' });
    fireEvent.change(code, { target: { value: '012345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar autenticador' }));
    expect(
      await screen.findByText('Não foi possível confirmar o autenticador. Confira o código.'),
    ).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Filtrar empresas' })).toBeNull();
    expect(factors).toHaveBeenCalledTimes(2);
    expect(api.verifyMfa).toHaveBeenCalledWith('factor-test', '012345');
  });

  it('callback com falha mantém recuperação', async () => {
    const { router, api } = fixture();
    api.completeCallback = vi.fn(async () => {
      throw new Error('callback simulado inválido');
    });
    await act(async () => {
      await router.navigate({ to: '/auth/callback', search: { code: 'synthetic-code' } });
    });
    render(<App router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Não foi possível concluir o acesso' }),
    ).toBeTruthy();
    const retry = screen.getByRole('link', { name: 'Solicitar novo código' });
    expect(api.completeCallback).toHaveBeenCalledWith('synthetic-code');
    await userEvent.click(retry);
    await waitFor(() => expect(router.state.location.pathname).toBe('/acesso'));
    expect(router.state.location.search).toEqual({ reason: 'signed_out', returnTo: '/cliente' });
    expect(api.completeCallback).toHaveBeenCalledTimes(1);
  });

  it('callback bem-sucedido retorna aos termos sem liberar a empresa antes do aceite', async () => {
    const { router, api } = fixture();
    api.completeCallback = vi.fn(async () => {});
    await act(async () => {
      await router.navigate({ to: '/auth/callback', search: { code: 'synthetic-code' } });
    });
    render(<App router={router} />);
    expect(await screen.findByRole('checkbox')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/acesso');
    expect(screen.queryByRole('form', { name: 'Filtrar empresas' })).toBeNull();
    expect(api.completeCallback).toHaveBeenCalledWith('synthetic-code');
  });
});
