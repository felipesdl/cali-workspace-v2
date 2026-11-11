import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it, vi } from 'vitest';
import { type PublicFormsService } from '../src/api/shared/forms/public';
import { createQueryClient } from '../src/api/query-client';
import { App } from '../src/app/App';
import { createAppRouter } from '../src/app/router';

const form = {
  source: 'legacy' as const,
  formId: '70000000-0000-4000-8000-000000000001',
  slug: 'coleta-cali',
  status: 'open' as const,
  title: 'Pesquisa CALI',
  description: 'Pesquisa sintética.',
  questions: [
    {
      id: '70000000-0000-4000-8000-000000000002',
      kind: 'single_choice' as const,
      label: 'Caminho',
      required: true,
      options: ['Sim', 'Não'],
      logic: [
        { when: 'Sim', goTo: '70000000-0000-4000-8000-000000000004' },
        { when: 'Não', goTo: '70000000-0000-4000-8000-000000000003' },
      ],
    },
    {
      id: '70000000-0000-4000-8000-000000000003',
      kind: 'short_text' as const,
      label: 'Resposta do caminho Não',
      required: true,
    },
    {
      id: '70000000-0000-4000-8000-000000000004',
      kind: 'short_text' as const,
      label: 'Resposta do caminho Sim',
      required: true,
    },
  ],
  confirmationEnabled: false,
};

it('avança e volta uma pergunta por etapa, mantém respostas e recalcula ramificação', async () => {
  const submit = vi.fn<PublicFormsService['submit']>().mockResolvedValue({
    ok: true,
    confirmation: false,
  });
  const publicForms: PublicFormsService = {
    read: vi.fn().mockResolvedValue(form),
    submit,
  };
  const queryClient = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ['/f/coleta-cali'] }),
    queryClient,
  );
  router.update({
    context: { ...router.options.context, publicForms },
  });
  await act(async () => {
    await router.load();
  });
  const user = userEvent.setup();
  render(<App router={router} />);

  await screen.findByRole('heading', { name: 'Pesquisa CALI' });
  expect(
    screen
      .getByRole('progressbar', { name: 'Progresso do formulário' })
      .getAttribute('aria-valuenow'),
  ).toBe('0');
  await user.keyboard('{Enter}');
  await user.keyboard('b');
  const noAnswer = await screen.findByRole<HTMLInputElement>('textbox', {
    name: /Resposta do caminho Não/,
  });
  await user.type(noAnswer, 'Resposta preservada');
  await user.click(screen.getByRole('button', { name: 'Voltar' }));

  await user.click(screen.getByRole('radio', { name: /Sim/ }));
  expect(await screen.findByRole('textbox', { name: /Resposta do caminho Sim/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
  await user.click(screen.getByRole('radio', { name: /Não/ }));
  expect(
    (await screen.findByRole<HTMLInputElement>('textbox', { name: /Resposta do caminho Não/ }))
      .value,
  ).toBe('Resposta preservada');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(
    await screen.findByRole('textbox', { name: /Resposta do caminho Sim/ }),
    'Resposta final',
  );

  await user.keyboard('{Enter}');
  expect(await screen.findByRole('heading', { name: 'Muito obrigado!' })).toBeTruthy();
  expect(submit).toHaveBeenCalledWith(
    form,
    expect.any(String),
    {
      [form.questions[0].id]: 'Não',
      [form.questions[1].id]: 'Resposta preservada',
      [form.questions[2].id]: 'Resposta final',
    },
    [form.questions[0].id, form.questions[1].id, form.questions[2].id],
  );
});
