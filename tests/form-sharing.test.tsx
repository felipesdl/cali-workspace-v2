import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { FormSharing } from '../src/modules/admin/forms/components/FormSharing';

it('mostra instrução de cópia manual quando Clipboard API não existe', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
  render(<FormSharing slug="pesquisa-teste" title="Pesquisa" />);

  await user.click(screen.getByRole('button', { name: 'Copiar link' }));

  expect(await screen.findByText('Não foi possível copiar. Selecione o endereço acima.')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'http://localhost:3000/f/pesquisa-teste' })).toBeTruthy();
  vi.unstubAllGlobals();
});
