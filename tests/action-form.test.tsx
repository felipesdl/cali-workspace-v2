import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../src/api/query-client';
import { Field } from '../src/components/ds/field/Field';
import { ActionForm } from '../src/features/project-workspace/ActionForm';

it('preserva o conteúdo e a identificação na tentativa após erro e anuncia o sucesso', async () => {
  const submit = vi
    .fn<(values: FormData, request: string) => Promise<void>>()
    .mockRejectedValueOnce(new Error('Não foi possível salvar.'))
    .mockResolvedValueOnce(undefined);
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActionForm label="Salvar registro" submit={submit}>
        {(id) => (
          <Field id={id} label="Assunto">
            <input id={id} name="title" required />
          </Field>
        )}
      </ActionForm>
    </QueryClientProvider>,
  );
  await user.type(screen.getByLabelText('Assunto'), 'Registro sintético');
  await user.click(screen.getByRole('button', { name: 'Salvar registro' }));

  const error = await screen.findByRole('alert');
  expect(error.textContent).toBe('Não foi possível salvar.');
  await waitFor(() => expect(document.activeElement).toBe(error));
  expect(screen.getByLabelText<HTMLInputElement>('Assunto').value).toBe('Registro sintético');

  await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
  const success = await screen.findByRole('status');
  await waitFor(() => expect(document.activeElement).toBe(success));
  expect(screen.getByLabelText<HTMLInputElement>('Assunto').value).toBe('');
  expect(submit.mock.calls).toHaveLength(2);
  expect(submit.mock.calls[1][1]).toBe(submit.mock.calls[0][1]);
  expect(submit.mock.calls[1][0].get('title')).toBe('Registro sintético');
});
