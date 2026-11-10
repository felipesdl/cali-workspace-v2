import { useEffect, useRef, useState } from 'react';
import { useDownloadCompanyDocument } from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { type CompanyDocument } from '../../../../api/admin/companies/document-schemas';
export function useDocumentDownload() {
  const download = useDownloadCompanyDocument();
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      generation.current++;
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );
  async function run(item: CompanyDocument) {
    const revision = ++generation.current;
    setMessage('');
    try {
      const blob = await download.mutateAsync(item);
      if (revision !== generation.current) return;
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
      urls.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.file.fileName.replace(/[\\/]/g, '_');
      document.body.append(link);
      link.click();
      link.remove();
      setMessage('Download solicitado para a versão selecionada.');
      setTimeout(() => {
        if (urls.current.delete(url)) URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      /* Mutation mantém o erro, sem repetir download. */
    }
  }
  return { run, pending: download.isPending, error: download.error, message };
}
