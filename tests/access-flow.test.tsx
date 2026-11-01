import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { companiesService } from '../src/api/modules/companies/api';
import { type HostedAccessApi } from '../src/api/modules/access/api';
import {
  acceptCurrentTermsSchema,
  type WorkspaceAccessState,
} from '../src/api/modules/access/session';

function fixture(fail = false) {
  let accepted = false;
  const read = async (): Promise<WorkspaceAccessState> => ({
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
  });
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
  return { router, acceptTerms };
}

describe('aceite explícito na jornada de acesso', () => {
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
