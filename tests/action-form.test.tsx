import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../src/api/query-client';
import { Field } from '../src/components/ds/field/Field';
import { Checkbox } from '../src/components/ds/checkbox/Checkbox';
import { ActionForm } from '../src/components/workspace/ActionForm';

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

it('mantém o diálogo e os valores enquanto a gravação está pendente e quando falha', async () => {
  let rejectSave: (error: Error) => void = () => {};
  const submit = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        rejectSave = reject;
      }),
  );
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActionForm
        dialog={{ title: 'Editar registro', trigger: 'Editar' }}
        label="Salvar"
        submit={submit}
      >
        {(id) => (
          <Field id={id} label="Assunto">
            <input id={id} name="title" required />
          </Field>
        )}
      </ActionForm>
    </QueryClientProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'Editar' });
  await user.click(trigger);
  const dialog = within(screen.getByRole('dialog', { name: 'Editar registro' }));
  await user.type(dialog.getByLabelText('Assunto'), 'Rascunho');
  await user.click(dialog.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(dialog.getByRole('button', { name: 'Fechar' })).toHaveProperty('disabled', true);
  await user.click(dialog.getByRole('button', { name: 'Fechar' }));
  expect(screen.getByRole('dialog')).toBeTruthy();

  rejectSave(new Error('Tente de novo.'));
  expect((await dialog.findByRole('alert')).textContent).toBe('Tente de novo.');
  expect(dialog.getByLabelText('Assunto')).toHaveProperty('value', 'Rascunho');
  await user.click(dialog.getByRole('button', { name: 'Voltar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('exige a segunda confirmação antes de executar uma ação iniciada no diálogo', async () => {
  const submit = vi.fn(async (values: FormData) => values.get('confirm'));
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActionForm
        dialog={{ title: 'Deseja enviar?', trigger: 'Enviar' }}
        label="Tem certeza? Enviar agora"
        submit={submit}
      >
        {(id) => (
          <Checkbox id={id + 'confirm'} name="confirm" required>
            Confirmo o envio.
          </Checkbox>
        )}
      </ActionForm>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Deseja enviar?' }));
  await user.click(dialog.getByRole('button', { name: 'Tem certeza? Enviar agora' }));
  expect(submit).not.toHaveBeenCalled();
  await user.click(dialog.getByLabelText('Confirmo o envio.'));
  await user.click(dialog.getByRole('button', { name: 'Tem certeza? Enviar agora' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0].get('confirm')).toBe('on');
});
