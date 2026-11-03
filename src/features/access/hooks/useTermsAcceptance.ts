import { useState } from 'react';
import { type HostedAccessApi } from '../../../api/modules/access/api';
import { type WorkspaceAccessState } from '../../../api/modules/access/session';
import { type SessionController } from '../../../app/session/controller';

export function useTermsAcceptance(
  api: HostedAccessApi,
  session: SessionController,
  access: WorkspaceAccessState | null,
) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [agreedKey, setAgreedKey] = useState<string | null>(null);
  const acceptanceKey =
    access?.profile && access.terms
      ? `${access.profile.id}:${access.terms.version}:${access.terms.contentHash}`
      : null;
  const agreed = Boolean(acceptanceKey && agreedKey === acceptanceKey);

  async function accept() {
    if (!access?.terms || !agreed || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await api.acceptTerms({
        version: access.terms.version,
        contentHash: access.terms.contentHash,
      });
      await session.refresh();
    } catch {
      setMessage('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    message,
    agreed,
    setAgreed: (checked: boolean) => setAgreedKey(checked ? acceptanceKey : null),
    accept,
  };
}
