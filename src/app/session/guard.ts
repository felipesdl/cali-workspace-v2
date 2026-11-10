import { type AccessReason } from './access-reason';
import { type workspaceRole } from '../../api/access/schemas';
import { type SessionState } from './controller';

export function sessionGuard(
  state: SessionState,
  role: typeof workspaceRole.Admin | typeof workspaceRole.Client,
): AccessReason | 'allowed' {
  if (state.phase === 'signed_out' || state.phase === 'idle') return 'signed_out';
  if (state.phase !== 'resolved') return 'unavailable';
  if (state.access.status !== 'ready') return state.access.status;
  if (state.access.profile?.role !== role) return 'wrong_role';
  return 'allowed';
}

export function safeReturnPath(path: string) {
  if (/^[\\/]{2}|\\/.test(path) || [...path].some((character) => character.charCodeAt(0) <= 32))
    return '/cliente';
  return /^\/(admin|cliente)(\/|\?|$)/.test(path) ? path : '/cliente';
}
