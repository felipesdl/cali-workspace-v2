import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { WorkspaceRailGroup } from '../src/app/WorkspaceRailGroup';

const team = { label: 'Equipe', element: <a href="#equipe">Equipe</a> } as const;
const sections = [
  { label: 'Diretório', active: true, element: <a href="#diretorio" /> },
  { label: 'Estrutura organizacional', active: false, element: <a href="#estrutura" /> },
];

it('abre o painel lateral por hover e permite navegar por teclado e fechar com Escape', async () => {
  const user = userEvent.setup();
  render(<WorkspaceRailGroup module={team} sections={sections} mobile={false} />);
  const trigger = screen.getByRole('link', { name: 'Equipe' });

  await user.hover(trigger);
  expect(screen.getByRole('region', { name: 'Equipe' })).toBeTruthy();
  await user.unhover(trigger);
  expect(screen.queryByRole('region', { name: 'Equipe' })).toBeNull();

  await user.tab();
  expect(document.activeElement).toBe(trigger);
  const panel = screen.getByRole('region', { name: 'Equipe' });
  const directory = within(panel).getByRole('link', { name: 'Diretório' });
  expect(directory.getAttribute('aria-current')).toBe('page');
  await user.tab();
  expect(document.activeElement).toBe(directory);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region', { name: 'Equipe' })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('abre as áreas pelo botão no menu móvel sem acionar o fechamento da navegação', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <nav onClick={onClick}>
      <WorkspaceRailGroup module={team} sections={sections} mobile />
    </nav>,
  );
  const disclosure = screen.getByRole('button', { name: 'Áreas de Equipe' });

  await user.click(disclosure);
  expect(disclosure.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Equipe' })).toBeTruthy();
  expect(onClick).not.toHaveBeenCalled();
  await user.click(disclosure);
  expect(disclosure.getAttribute('aria-expanded')).toBe('false');
});
