import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { profileMedia } from '../src/api/access/profile-media';
import { ProfileMediaEditor } from '../src/components/account/ProfileMediaEditor';
import { ClientFaqPage } from '../src/modules/client/help/ClientFaqPage';

describe('FAQ do Cliente', () => {
  it('filtra sem acento e informa quando busca não retorna perguntas', () => {
    render(<ClientFaqPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'excedente' } });
    expect(
      screen.getByRole('button', { name: 'As horas excedentes serão cobradas automaticamente?' }),
    ).toBeTruthy();
    expect(screen.queryByText('O que representam as horas contratadas?')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzqwerty' } });
    expect(screen.getByText(/Nenhuma pergunta encontrada/)).toBeTruthy();
  });

  it('mantém uma resposta aberta por vez e abre os resultados durante a busca', () => {
    render(<ClientFaqPage />);
    const contracted = screen.getByRole('button', {
      name: 'O que representam as horas contratadas?',
    });
    const unused = screen.getByRole('button', {
      name: 'O que acontece se não utilizarmos todas as horas do mês?',
    });
    fireEvent.click(contracted);
    expect(contracted.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(unused);
    expect(contracted.getAttribute('aria-expanded')).toBe('false');
    expect(unused.getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'horas' } });
    expect(
      screen
        .getAllByRole('button', { name: /horas/ })
        .every((button) => button.getAttribute('aria-expanded') === 'true'),
    ).toBe(true);
  });
});

describe('mídia do perfil', () => {
  it('aplica defaults compatíveis com perfis legados sem mídia', () => {
    expect(profileMedia.parse({})).toEqual({
      avatar_url: null,
      avatar_position_x: 50,
      avatar_position_y: 50,
      avatar_zoom: 1,
      signature_mode: 'generated',
      signature_url: null,
      signature_style: 'calligraphic',
    });
  });

  it('mostra recorte e seleção de assinatura e salva valores alterados', async () => {
    const initial = profileMedia.parse({ avatar_url: 'https://assets.example/avatar.webp' });
    const service = {
      read: vi.fn(async () => initial),
      upload: vi.fn(),
      save: vi.fn(async (_expected, next) => next),
    };
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={cache}>
        <ProfileMediaEditor actor="actor-1" name="Pessoa" service={service} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Ajustar enquadramento' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Zoom da foto' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar enquadramento' }));
    expect(screen.getByRole('slider', { name: 'Zoom da foto' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Posição horizontal'), { target: { value: '72' } });
    fireEvent.change(screen.getByLabelText('Tipo de assinatura'), {
      target: { value: 'uploaded' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar foto e assinatura' }));
    expect(await screen.findByText('Foto e assinatura atualizadas.')).toBeTruthy();
    expect(service.save).toHaveBeenCalledWith(
      initial,
      expect.objectContaining({
        avatar_position_x: 72,
        signature_mode: 'uploaded',
      }),
    );
  });
});
