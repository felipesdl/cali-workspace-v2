import { useEffect, useRef, useState } from 'react';
import { type CompanyLogo } from '../../../api/modules/companies/registration-schemas';
import { prepareCompanyLogo } from '../company-logo';
export function useLogoSelection(onSelect: (logo: CompanyLogo | null) => void) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      pending.current?.abort();
    },
    [],
  );
  function remove() {
    generation.current++;
    pending.current?.abort();
    setReading(false);
    setError('');
    onSelect(null);
  }
  async function choose(file: File) {
    const revision = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setReading(true);
    setError('');
    try {
      const logo = await prepareCompanyLogo(file, controller.signal);
      if (revision === generation.current) onSelect(logo);
    } catch (error) {
      if (revision === generation.current)
        setError(error instanceof Error ? error.message : 'Não foi possível preparar a logo.');
    } finally {
      if (revision === generation.current) setReading(false);
    }
  }
  return { reading, error, choose, remove };
}
