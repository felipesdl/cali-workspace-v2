import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';
import { createSessionController } from '../src/app/session/controller';
import { createQueryClient } from '../src/api/query-client';
import { type WorkspaceAccessState } from '../src/api/modules/access/session';

const companyA = '9c5ab148-78b8-4410-9338-58c44222a5db';
const companyB = '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';

it('abre o projeto Cliente pelo vínculo autenticado e trata ID indisponível sem fallback', async () => {
  const unavailable = '10000000-0000-4000-8000-000000000001';
  const client: WorkspaceAccessState = {
    status: 'ready',
    profile: {
      id: '20000000-0000-4000-8000-000000000001',
      company_id: companyA,
      role: 'client',
      active: true,
    },
    companyStatus: 'active',
    termsAccepted: true,
    terms: {
      version: 'qa-phase4',
      title: 'Termos sintéticos',
      content: 'Conteúdo sintético de teste.',
      contentHash: 'a'.repeat(64),
    },
  };
  const detail = vi.fn(async () => null);
  const list = vi.fn(async () => ({ companyId: companyA, total: 0, projects: [] }));
  const cache = createQueryClient();
  const session = createSessionController(
    { read: async () => client, signOut: async () => {} },
    cache,
  );
  const router = createAppRouter(
    createMemoryHistory({
      initialEntries: [`/cliente/entregaveis?companyId=${companyB}&project=${unavailable}`],
    }),
    cache,
    session,
  );
  router.update({
    context: {
      ...router.options.context,
      projectWorkspace: {
        detail,
        list,
        catalog: async () => {
          throw new Error('Consulta inesperada');
        },
        hours: async () => {
          throw new Error('Consulta inesperada');
        },
      },
    },
  });
  await act(async () => {
    await router.load();
  });
  render(<App router={router} />);
  expect(await screen.findByText('Projeto indisponível.')).toBeTruthy();
  expect(detail).toHaveBeenCalledExactlyOnceWith(
    companyA,
    unavailable,
    'deliverables',
    1,
    expect.any(AbortSignal),
  );
  expect(list).not.toHaveBeenCalled();
  expect(screen.queryByText('Empresa de homologação')).toBeNull();
});

it('registra ciência da revisão publicada na empresa da sessão e atualiza o documento', async () => {
  const documentId = '30000000-0000-4000-8000-000000000001';
  const revisionId = '30000000-0000-4000-8000-000000000002';
  const client: WorkspaceAccessState = {
    status: 'ready',
    profile: {
      id: '20000000-0000-4000-8000-000000000001',
      company_id: companyA,
      role: 'client',
      active: true,
    },
    companyStatus: 'active',
    termsAccepted: true,
    terms: {
      version: 'qa-phase4',
      title: 'Termos sintéticos',
      content: 'Conteúdo sintético de teste.',
      contentHash: 'a'.repeat(64),
    },
  };
  let acknowledged = false;
  const list = vi.fn(async () => [
    {
      id: documentId,
      title: 'Documento de teste',
      number: 2,
      fileName: 'teste.pdf',
      revisionId,
      publishedRevision: revisionId,
      acknowledged,
    },
  ]);
  const acknowledge = vi.fn(async () => {
    acknowledged = true;
    return revisionId;
  });
  const unexpected = async () => {
    throw new Error('Operação inesperada');
  };
  const cache = createQueryClient();
  const session = createSessionController(
    { read: async () => client, signOut: async () => {} },
    cache,
  );
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [`/cliente/documentos?companyId=${companyB}`] }),
    cache,
    session,
  );
  router.update({
    context: {
      ...router.options.context,
      projectWorkspace: {
        detail: unexpected,
        list: unexpected,
        hours: unexpected,
        catalog: async () => ({
          companyId: companyA,
          module: 'documents',
          month: null,
          entries: [],
          total: 0,
        }),
      },
      documentOperations: {
        list,
        acknowledge,
        delivery: unexpected,
        addDelivery: unexpected,
        history: unexpected,
        add: unexpected,
        publication: unexpected,
        download: unexpected,
      },
    },
  });
  await act(async () => {
    await router.load();
  });
  render(<App router={router} />);
  expect(await screen.findByText('Documento de teste')).toBeTruthy();
  expect(list).toHaveBeenCalledWith(companyA, 1, expect.any(AbortSignal));
  await userEvent.click(screen.getByRole('button', { name: 'Registrar ciência desta revisão' }));
  expect(acknowledge).toHaveBeenCalledExactlyOnceWith(companyA, documentId, revisionId);
  expect(await screen.findByText('Ciência registrada para esta revisão.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Salvar novo documento' })).toBeNull();
});
