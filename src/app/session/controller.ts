import { type QueryClient } from '@tanstack/react-query';
import {
  workspaceAccessStateSchema,
  type WorkspaceAccessState,
} from '../../api/modules/access/session';

export type SessionSource = {
  read: (signal: AbortSignal) => Promise<WorkspaceAccessState>;
  signOut: () => Promise<void>;
};
export type SessionState =
  | { phase: 'idle' | 'loading' | 'signed_out' | 'error' }
  | { phase: 'resolved'; access: WorkspaceAccessState };

// Fonte real entra por injeção; sem SDK, tokens ou ator demonstrativo neste dono.
export function createSessionController(source: SessionSource, cache: QueryClient) {
  let state: SessionState = { phase: 'idle' };
  let generation = 0;
  let request: AbortController | null = null;
  let pending: Promise<SessionState> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: SessionState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function reset() {
    await cache.cancelQueries();
    cache.clear();
  }
  async function refresh() {
    const revision = ++generation;
    request?.abort();
    const current = new AbortController();
    request = current;
    publish({ phase: 'loading' });
    await reset();
    try {
      const access = workspaceAccessStateSchema.parse(await source.read(current.signal));
      if (revision === generation && !current.signal.aborted)
        publish({ phase: 'resolved', access });
    } catch {
      if (revision === generation) publish({ phase: 'error' });
    }
    return state;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    async resolve() {
      if (state.phase !== 'idle') return pending ?? state;
      pending = refresh();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
    async signOut() {
      generation += 1;
      request?.abort();
      publish({ phase: 'signed_out' });
      await reset();
      try {
        await source.signOut();
      } catch {
        publish({ phase: 'error' });
      }
    },
  };
}
export type SessionController = ReturnType<typeof createSessionController>;
