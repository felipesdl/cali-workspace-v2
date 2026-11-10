import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { useRef, useState } from 'react';
import {
  useCompanyAdministration,
  useCompanyAdministrationCapability,
} from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { AdministrationEditor } from './AdministrationEditor';
import { AdministrationSummary } from './AdministrationSummary';
import { AdministrationHistory } from './AdministrationHistory';

function AdministrationPanel({
  companyId,
  hosted,
  canEdit,
}: {
  companyId: string;
  hosted: boolean;
  canEdit: boolean;
}) {
  const record = useCompanyAdministration(companyId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  function finish(confirmed: boolean) {
    setEditing(false);
    setSaved(confirmed);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <section
      aria-labelledby="administration-title"
      aria-busy={record.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="administration-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-brand"
      >
        Ficha administrativa
      </h2>
      {record.isPending && (
        <FeedbackState kind="loading">Carregando ficha administrativa…</FeedbackState>
      )}
      {record.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          retryLabel="Recarregar ficha administrativa"
          onRetry={() => void record.refetch()}
        >
          Não foi possível carregar a ficha administrativa.
        </FeedbackState>
      )}
      {record.data && editing && (
        <AdministrationEditor
          record={record.data}
          onClose={finish}
          onReload={() => {
            finish(false);
            void record.refetch();
          }}
        />
      )}
      {record.data && !editing && (
        <>
          {'revision' in record.data && record.data.revision === 0 && (
            <FeedbackState kind="empty">
              Contrato, financeiro e referências documentais ainda não informados nesta
              demonstração.
            </FeedbackState>
          )}
          {('updatedAt' in record.data || record.data.revision > 0) && (
            <AdministrationSummary values={record.data.values} />
          )}
          {canEdit && (
            <Button
              variant="secondary"
              className="tw:mt-4"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              Editar ficha administrativa
            </Button>
          )}
        </>
      )}
      {saved && (
        <FeedbackMessage tone="success" className="tw:mt-3">
          {hosted ? 'Ficha administrativa salva.' : 'Ficha administrativa salva na demonstração.'}
        </FeedbackMessage>
      )}
      {!hosted && <AdministrationHistory companyId={companyId} />}
    </section>
  );
}
export function CompanyAdministration({ companyId }: { companyId: string }) {
  const { available, hosted, canEdit } = useCompanyAdministrationCapability(companyId);
  if (!available) return null;
  return <AdministrationPanel companyId={companyId} hosted={hosted} canEdit={canEdit} />;
}
