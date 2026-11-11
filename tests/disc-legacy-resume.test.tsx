import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { createHostedDisc } from '../src/api/shared/disc/service';
import { createQueryClient } from '../src/api/query-client';
import { createWorkspaceClient } from '../src/api/supabase';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const token = '10000000-0000-4000-8000-000000000020';
const originalKey = `cali-perfil:${token}`;
const migratedKey = `cali-disc:draft:avaliacao-qa:${token}`;

afterEach(() => {
  window.localStorage.removeItem(originalKey);
  window.localStorage.removeItem(migratedKey);
});

it('abre o mesmo convite e retoma a etapa e escolhas gravadas no formato da V1', async () => {
  window.localStorage.setItem(
    originalKey,
    JSON.stringify({
      stepIndex: 4,
      consent: true,
      person: { job: 'Analista', name: 'Nome no rascunho', email: 'rascunho@example.test' },
      natural: { '1': { mais: 'D', menos: 'I' } },
      pressure: {},
    }),
  );
  const service = createHostedDisc(
    createWorkspaceClient('https://qa.invalid', 'sb_publishable_test'),
  );
  const read = vi.spyOn(service, 'readLegacyPublic').mockResolvedValue({
    state: 'started',
    title: 'Avaliação de teste',
    organization: null,
    person_name: 'Pessoa de teste',
    deadline_at: null,
    last_block: 1,
  });
  const history = createMemoryHistory({ initialEntries: [`/perfil/avaliacao-qa?c=${token}`] });
  const router = createAppRouter(history, createQueryClient());
  router.update({ context: { ...router.options.context, disc: service } });
  render(<App router={router} />);

  expect(await screen.findByRole('heading', { name: 'Avaliação de teste' })).toBeTruthy();
  expect(read).toHaveBeenCalledWith('avaliacao-qa', token, expect.any(AbortSignal));
  expect(
    screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuenow')),
  ).toEqual(['1', '1']);
  await waitFor(() => {
    const migrated = window.localStorage.getItem(migratedKey);
    expect(migrated).toContain('"natural:1":{"b":1,"mais":"D","menos":"I"}');
    expect(migrated).not.toContain('rascunho@example.test');
  });
});
