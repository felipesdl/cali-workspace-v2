import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewFormDraft } from '../src/modules/admin/forms/components/FormDraftEditor';
import { StaffDraftEditor } from '../src/modules/admin/staff/components/StaffDraftEditor';

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('diálogos de criação Admin', () => {
  it('abre criação de formulário em diálogo e cria rascunho pelo contrato V2', async () => {
    const user = userEvent.setup();
    const createFormDraft = vi.fn().mockResolvedValue('10000000-0000-4000-8000-000000000001');
    const saved = vi.fn();
    renderWithQuery(
      <NewFormDraft
        company="20000000-0000-4000-8000-000000000001"
        actor="actor"
        operations={{ createFormDraft }}
        saved={saved}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Novo formulário' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo formulário' });
    await user.type(screen.getByLabelText('Título do formulário'), 'Avaliação do ciclo');
    await user.type(screen.getByLabelText('Identificador do endereço'), 'avaliacao-do-ciclo');
    await user.click(screen.getByRole('button', { name: 'Criar rascunho de formulário' }));

    await waitFor(() => expect(createFormDraft).toHaveBeenCalledOnce());
    expect(createFormDraft.mock.calls[0]?.slice(0, 1)).toEqual([
      '20000000-0000-4000-8000-000000000001',
    ]);
    expect(createFormDraft.mock.calls[0]?.[2]).toBe('Avaliação do ciclo');
    expect(createFormDraft.mock.calls[0]?.[3]).toBe('avaliacao-do-ciclo');
    expect(saved).toHaveBeenCalledOnce();
    expect(dialog.isConnected).toBe(false);
  });

  it('abre cadastro de pessoa da equipe em diálogo com módulos exigidos', async () => {
    const user = userEvent.setup();
    const saveStaffDraft = vi.fn().mockResolvedValue('30000000-0000-4000-8000-000000000001');
    const saved = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(
      <StaffDraftEditor
        company="20000000-0000-4000-8000-000000000001"
        operations={{ saveStaffDraft }}
        saved={saved}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar pessoa à equipe' }));
    const dialog = screen.getByRole('dialog', { name: 'Adicionar pessoa à equipe CALI' });
    await user.type(screen.getByLabelText('Nome fictício'), 'Pessoa de teste');
    await user.click(screen.getByLabelText('Projetos e entregas'));
    await user.click(screen.getByRole('button', { name: 'Criar rascunho de equipe' }));

    await waitFor(() => expect(saveStaffDraft).toHaveBeenCalledOnce());
    expect(saveStaffDraft.mock.calls[0]?.[0]).toBe('20000000-0000-4000-8000-000000000001');
    expect(saveStaffDraft.mock.calls[0]?.[2]).toBeNull();
    expect(saveStaffDraft.mock.calls[0]?.[3]).toEqual({
      name: 'Pessoa de teste',
      modules: ['projects'],
    });
    expect(saved).toHaveBeenCalledOnce();
    expect(dialog.isConnected).toBe(false);
  });
});
import { type ReactNode } from 'react';
