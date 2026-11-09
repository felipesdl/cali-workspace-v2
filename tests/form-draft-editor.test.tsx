import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { type DomainOperations } from '../src/api/modules/project-workspace/domain-operations';
import { createQueryClient } from '../src/api/query-client';
import { FormDraftEditor } from '../src/features/project-workspace/FormDraftEditor';

it('anuncia a revisão salva mesmo quando a nova versão substitui os campos', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const company = '22222222-2222-4222-8222-222222222222';
  let draft = {
    id,
    title: 'Rascunho inicial',
    description: '',
    questions: [],
    updatedAt: '2026-11-09T10:00:00Z',
  };
  const editFormDraft = vi
    .fn<DomainOperations['editFormDraft']>()
    .mockRejectedValueOnce(new Error('Não foi possível salvar.'))
    .mockImplementationOnce(async () => {
      draft = { ...draft, title: 'Rascunho atualizado', updatedAt: '2026-11-09T11:00:00Z' };
      return id;
    });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FormDraftEditor
        company={company}
        id={id}
        operations={{ formDraft: async () => draft, editFormDraft }}
      />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Editar rascunho' }));
  const title = await screen.findByLabelText<HTMLInputElement>('Título', { exact: true });
  const submit = screen.getByRole('button', { name: 'Salvar título e descrição' });
  await user.clear(title);
  await user.type(title, 'Rascunho atualizado');
  await user.click(submit);
  const error = await screen.findByRole('alert');
  await waitFor(() => expect(document.activeElement).toBe(error));
  expect(title.value).toBe('Rascunho atualizado');
  await user.click(submit);
  const receipt = await screen.findByRole('status');
  expect(receipt.textContent).toBe('Rascunho atualizado.');
  await waitFor(() => expect(document.activeElement).toBe(receipt));
  expect(title.isConnected).toBe(false);
  expect(screen.getByLabelText<HTMLInputElement>('Título', { exact: true }).value).toBe(
    'Rascunho atualizado',
  );
});
