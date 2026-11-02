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
  function sameReadyIdentity(previous: SessionState, next: WorkspaceAccessState) {
    return (
      previous.phase === 'resolved' &&
      previous.access.status === 'ready' &&
      next.status === 'ready' &&
      previous.access.profile?.id === next.profile?.id &&
      previous.access.profile?.company_id === next.profile?.company_id &&
      previous.access.profile?.role === next.profile?.role
    );
  }
  async function load(background: boolean) {
    const revision = ++generation;
    const previous = state;
    request?.abort();
    const current = new AbortController();
    request = current;
    // Código/MFA/aceite também têm rascunho: foco/intervalo não devem desmontá-los.
    const preserve = background && previous.phase === 'resolved';
    if (!preserve) {
      publish({ phase: 'loading' });
      await reset();
    }
    try {
      const access = workspaceAccessStateSchema.parse(await source.read(current.signal));
      if (revision === generation && !current.signal.aborted) {
        if (preserve && !sameReadyIdentity(previous, access)) await reset();
        if (revision === generation) publish({ phase: 'resolved', access });
      }
    } catch {
      if (revision === generation) {
        await reset();
        if (revision === generation) publish({ phase: 'error' });
      }
    }
    return state;
  }
  function refresh(background = false) {
    const task = load(background);
    pending = task;
    void task.finally(() => {
      if (pending === task) pending = null;
    });
    return task;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: () => refresh(),
    revalidate: () => refresh(true),
    async resolve() {
      if (state.phase === 'idle') return refresh();
      return state.phase === 'loading' ? (pending ?? state) : state;
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
