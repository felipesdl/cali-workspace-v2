import { AdhesionReferenceForm } from './AdhesionReferenceForm';
import { AdhesionEvidencePanel } from './AdhesionEvidencePanel';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { useRef, useState } from 'react';
import {
  useCompanyAdhesions,
  useCompanyManagementAvailable,
} from '../../../../api/admin/companies/hooks/useCompanyManagement';
import { Button } from '../../../../components/ds/button/Button';
import { formatServerInstant } from '../../../../lib/dates';

function AdhesionPanel({ companyId }: { companyId: string }) {
  const adhesions = useCompanyAdhesions(companyId);
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section
      aria-labelledby="adhesions-title"
      aria-busy={adhesions.isFetching}
      className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2
        id="adhesions-title"
        ref={heading}
        tabIndex={-1}
        className="tw:m-0 tw:mb-3 tw:text-section tw:font-bold tw:text-brand"
      >
        Adesão da empresa
      </h2>
      {adhesions.isPending && <FeedbackState kind="loading">Carregando referências…</FeedbackState>}
      {adhesions.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          retryLabel="Recarregar referências"
          onRetry={() => void adhesions.refetch()}
        >
          Não foi possível confirmar a adesão. Novas autorizações permanecem indisponíveis.
        </FeedbackState>
      )}
      {adhesions.isSuccess && (
        <>
          {adhesions.data.length === 0 ? (
            <p>Nenhuma referência registrada. Registre a referência e depois confira a adesão.</p>
          ) : (
            <ol className="tw:my-4 tw:grid tw:gap-3 tw:pl-5 tw:[&_li]:wrap-anywhere">
              {adhesions.data.map((item) => (
                <li key={item.id}>
                  <strong>{item.evidenceReference}</strong>
                  <div className="tw:text-caption tw:text-muted-copy">
                    Admin demonstrativo · {formatServerInstant(item.recordedAt)}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!open && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Registrar adesão
            </Button>
          )}
        </>
      )}
      {open && (
        <AdhesionReferenceForm
          companyId={companyId}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => heading.current?.focus());
          }}
        />
      )}
      {adhesions.data && (
        <AdhesionEvidencePanel companyId={companyId} references={adhesions.data} />
      )}
    </section>
  );
}
export function CompanyAdhesions({ companyId }: { companyId: string }) {
  return useCompanyManagementAvailable() ? <AdhesionPanel companyId={companyId} /> : null;
}
