import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined') {
  afterEach(() => cleanup());
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
}
