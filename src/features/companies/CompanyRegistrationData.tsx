import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { useRef, useState } from 'react';
import {
  useCompanyRegistration,
  useCompanyManagementAvailable,
} from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { RegistrationEditor } from './RegistrationEditor';
import { RegistrationSummary } from './RegistrationSummary';
import { RegistrationHistory } from './RegistrationHistory';

function RegistrationPanel({ companyId }: { companyId: string }) {
  const record = useCompanyRegistration(companyId);
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
      aria-labelledby="registration-title"
      aria-busy={record.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="registration-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-brand"
      >
        Dados cadastrais
      </h2>
      {record.isPending && (
        <FeedbackState kind="loading">Carregando dados cadastrais…</FeedbackState>
      )}
      {record.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          retryLabel="Recarregar dados cadastrais"
          onRetry={() => void record.refetch()}
        >
          Não foi possível carregar os dados cadastrais.
        </FeedbackState>
      )}
      {record.data && editing && (
        <RegistrationEditor
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
          {record.data.revision === 0 && (
            <p className="tw:text-caption tw:text-muted-copy">
              Dados complementares ainda não registrados. Serviço inicial reflete somente o plano já
              conhecido.
            </p>
          )}
          <RegistrationSummary values={record.data.values} />
          <Button
            variant="secondary"
            className="tw:mt-4"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            Editar cadastro da empresa
          </Button>
        </>
      )}
      {saved && (
        <FeedbackMessage tone="success" className="tw:mt-3">
          Dados cadastrais salvos na demonstração.
        </FeedbackMessage>
      )}
      <RegistrationHistory companyId={companyId} />
    </section>
  );
}
export function CompanyRegistrationData({ companyId }: { companyId: string }) {
  const available = useCompanyManagementAvailable();
  if (!available) return null;
  return <RegistrationPanel companyId={companyId} />;
}
