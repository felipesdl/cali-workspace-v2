import { useSyncExternalStore } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import { type SessionController, type SessionState } from '../../../../app/session/controller';

const demo: SessionState = { phase: 'signed_out' };
const emptySubscribe = () => () => {};
const getDemo = () => demo;
export function useWorkspaceSession(controller?: SessionController) {
  const { session } = useRouteContext({ from: '__root__' });
  const source = controller ?? session;
  return useSyncExternalStore(source?.subscribe ?? emptySubscribe, source?.getSnapshot ?? getDemo);
}
