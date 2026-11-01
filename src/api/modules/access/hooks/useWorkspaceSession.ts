import { useSyncExternalStore } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import { type SessionState } from '../../../../app/session/controller';

const demo: SessionState = { phase: 'signed_out' };
const emptySubscribe = () => () => {};
const getDemo = () => demo;
export function useWorkspaceSession() {
  const { session } = useRouteContext({ from: '__root__' });
  return useSyncExternalStore(
    session?.subscribe ?? emptySubscribe,
    session?.getSnapshot ?? getDemo,
  );
}
