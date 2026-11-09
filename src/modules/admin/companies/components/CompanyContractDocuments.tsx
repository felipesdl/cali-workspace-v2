import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { useRef, useState } from 'react';
import {
  useCompanyDocuments,
  useCompanyManagementAvailable,
} from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { type CompanyDocument } from '../../../../api/admin/companies/document-schemas';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { ContractDocumentList } from './ContractDocumentList';
import { DocumentAttachmentForm } from './DocumentAttachmentForm';
import { DocumentWithdrawal } from './DocumentWithdrawal';
import { DocumentHistory } from './DocumentHistory';
import { useDocumentDownload } from '../hooks/useDocumentDownload';
type Action =
  | { kind: 'attach'; previous: CompanyDocument | null }
  | { kind: 'withdraw'; document: CompanyDocument };
function DocumentPanel({ companyId }: { companyId: string }) {
  const documents = useCompanyDocuments(companyId);
  const download = useDocumentDownload();
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  function finish(saved: boolean) {
    setAction(null);
    setNotice(saved ? 'Operação documental registrada na demonstração.' : '');
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <section
      aria-labelledby="contract-documents-title"
      aria-busy={documents.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="contract-documents-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-brand"
      >
        Contratos e aditivos
      </h2>
      <p className="tw:text-caption tw:text-muted-copy">
        Arquivos sintéticos em memória. Download é explícito; anexar não comprova assinatura ou
        adesão. Recarregar descarta os arquivos.
      </p>
      {documents.isPending && (
        <FeedbackState kind="loading">Carregando contratos e aditivos…</FeedbackState>
      )}
      {documents.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          onRetry={() => void documents.refetch()}
        >
          Não foi possível carregar os arquivos da empresa.
        </FeedbackState>
      )}
      {documents.isSuccess && (
        <>
          {documents.data.length === 0 && (
            <FeedbackState kind="empty">Nenhum contrato ou aditivo anexado.</FeedbackState>
          )}
          {!action && (
            <Button
              variant="secondary"
              onClick={() => {
                setNotice('');
                setAction({ kind: 'attach', previous: null });
              }}
            >
              Anexar contrato ou aditivo
            </Button>
          )}
          <ContractDocumentList
            entries={documents.data}
            actionsDisabled={Boolean(action)}
            download={download}
            onVersion={(previous) => {
              setNotice('');
              setAction({ kind: 'attach', previous });
            }}
            onWithdraw={(document) => {
              setNotice('');
              setAction({ kind: 'withdraw', document });
            }}
          />
        </>
      )}
      {action?.kind === 'attach' && (
        <DocumentAttachmentForm
          key={action.previous?.id ?? 'new-document'}
          companyId={companyId}
          previous={action.previous}
          onClose={finish}
        />
      )}
      {action?.kind === 'withdraw' && (
        <DocumentWithdrawal document={action.document} onClose={finish} />
      )}
      {notice && (
        <FeedbackMessage tone="success" className="tw:mt-3">
          {notice}
        </FeedbackMessage>
      )}
      {download.message && (
        <FeedbackMessage tone="success" className="tw:mt-3">
          {download.message}
        </FeedbackMessage>
      )}
      {download.error && (
        <FeedbackMessage tone="error" className="tw:mt-3">
          {download.error.message}
        </FeedbackMessage>
      )}
      <DocumentHistory companyId={companyId} />
    </section>
  );
}
export function CompanyContractDocuments({ companyId }: { companyId: string }) {
  if (!useCompanyManagementAvailable()) return null;
  return <DocumentPanel companyId={companyId} />;
}
