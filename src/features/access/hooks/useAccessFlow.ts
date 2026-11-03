import { useEffect } from 'react';
import { useWorkspaceSession } from '../../../api/modules/access/hooks/useWorkspaceSession';
import { useNavigate } from '@tanstack/react-router';
import { type SessionController } from '../../../app/session/controller';
import { workspaceRole } from '../../../api/modules/access/schemas';
import { safeReturnPath } from '../../../app/session/guard';

export function useAccessFlow(session: SessionController, returnTo: string) {
  const state = useWorkspaceSession(session);
  const access = state.phase === 'resolved' ? state.access : null;
  const navigate = useNavigate();
  useEffect(() => {
    void session.resolve();
  }, [session]);
  useEffect(() => {
    if (access?.status !== 'ready') return;
    const target = safeReturnPath(returnTo);
    const isAdmin = access.profile?.role === workspaceRole.Admin;
    const ownPrefix = isAdmin ? '/admin' : '/cliente';
    const fallback = isAdmin ? '/admin/clientes' : '/cliente';
    const destination = target.split(/[/?]/)[1] === ownPrefix.slice(1) ? target : fallback;
    void navigate({ to: destination, replace: true });
  }, [access, navigate, returnTo]);
  return { state, access };
}
