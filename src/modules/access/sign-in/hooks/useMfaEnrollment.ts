import { useEffect, useState } from 'react';
import { type HostedAccessApi } from '../../../../api/access/api';

export function useMfaEnrollment(api: HostedAccessApi) {
  const [factor, setFactor] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Awaited<
    ReturnType<HostedAccessApi['enrollMfa']>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .factors()
      .then((factors) => {
        if (active) setFactor((factors.find((f) => f.verified) ?? factors[0])?.id ?? null);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, revision]);

  function retry() {
    setLoading(true);
    setFailed(false);
    setRevision((value) => value + 1);
  }
  async function enroll() {
    setLoading(true);
    setMessage('');
    try {
      const result = await api.enrollMfa();
      setEnrollment(result);
      setFactor(result.id);
    } catch {
      setMessage('Não foi possível configurar o autenticador. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }
  return { factor, enrollment, loading, failed, message, setMessage, setEnrollment, retry, enroll };
}
