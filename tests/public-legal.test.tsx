import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LegalDocument } from '../src/modules/public/legal/components/LegalDocument';

it('renderiza títulos jurídicos de primeiro nível como subtítulos do documento', () => {
  render(<LegalDocument source={'# 1. Privacidade\n## 1.1 Coleta'} idPrefix="privacy" />);

  expect(screen.getByRole('heading', { level: 2, name: 'Privacidade' })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 3, name: '1.1 Coleta' })).toBeTruthy();
});
