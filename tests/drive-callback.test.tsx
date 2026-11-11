import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { createClientDrive } from '../src/api/client/drive';
import { createQueryClient } from '../src/api/query-client';
import { createWorkspaceClient } from '../src/api/supabase';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

function openCallback(purpose: 'drive' | 'calendar') {
  const service = createClientDrive(
    createWorkspaceClient('https://qa.invalid', 'sb_publishable_test'),
  );
  const exchange = vi.spyOn(service, 'exchange').mockResolvedValue(undefined);
  const state = `${btoa(JSON.stringify({ purpose })).replace(/=+$/, '')}.fixture`;
  const history = createMemoryHistory({
    initialEntries: [`/oauth/google/callback?code=fixture&state=${state}`],
  });
  const router = createAppRouter(history, createQueryClient());
  router.update({ context: { ...router.options.context, clientDrive: service } });
  render(<App router={router} />);
  return { exchange, state };
}

describe('callback OAuth da V2', () => {
  it('mantém o retorno do Calendar fora do exchange do Drive', async () => {
    const { exchange } = openCallback('calendar');
    expect(
      await screen.findByText('Esta conexão não está disponível neste ambiente.'),
    ).toBeTruthy();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('entrega a identidade do retorno Drive ao serviço e exibe confirmação', async () => {
    const { exchange, state } = openCallback('drive');
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('fixture', state));
    expect(await screen.findByText('Google Drive conectado.')).toBeTruthy();
  });
});
