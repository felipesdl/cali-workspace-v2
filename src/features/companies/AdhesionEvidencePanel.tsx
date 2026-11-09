import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { useRef, useState } from 'react';
import { type WorkspaceAdhesionRecord } from '../../api/modules/access/adhesion';
import { type AdhesionEvidence } from '../../api/modules/companies/evidence-schemas';
import {
  useAdhesionEvidence,
  useCompanyDocuments,
} from '../../api/modules/companies/hooks/useCompanyManagement';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { AdhesionEvidenceForm } from './AdhesionEvidenceForm';
import { AdhesionEvidenceList } from './AdhesionEvidenceList';
import { AdhesionEvidenceRetraction } from './AdhesionEvidenceRetraction';
type Action = { kind: 'confirm' } | { kind: 'retract'; evidence: AdhesionEvidence };
export function AdhesionEvidencePanel({
  companyId,
  references,
}: {
  companyId: string;
  references: WorkspaceAdhesionRecord[];
}) {
  const evidence = useAdhesionEvidence(companyId);
  const documents = useCompanyDocuments(companyId);
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  function finish(saved: boolean) {
    setAction(null);
    setNotice(
      saved ? 'Comprovação atualizada na demonstração. Acessos existentes preservados.' : '',
    );
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <section
      aria-labelledby="adhesion-evidence-title"
      aria-busy={evidence.isFetching}
      className="tw:mt-5 tw:min-w-0"
    >
      <h3
        id="adhesion-evidence-title"
        ref={heading}
        tabIndex={-1}
        className="tw:text-section tw:text-brand"
      >
        Comprovação administrativa
      </h3>
      <p className="tw:text-caption tw:text-muted-copy">
        Referência registrada e arquivo anexado não comprovam adesão por si só. Confirme a
        conferência para novas autorizações na demonstração. Histórico e acessos existentes são
        preservados.
      </p>
      {evidence.isPending && <FeedbackState kind="loading">Carregando comprovações…</FeedbackState>}
      {evidence.isError && (
        <FeedbackState
          kind="error"
          retryVariant="secondary"
          onRetry={() => void evidence.refetch()}
        >
          Não foi possível carregar as comprovações.
        </FeedbackState>
      )}
      {evidence.isSuccess && (
        <>
          {evidence.data.length === 0 && (
            <FeedbackState kind="empty">Nenhuma comprovação registrada.</FeedbackState>
          )}
          <AdhesionEvidenceList
            entries={evidence.data}
            disabled={Boolean(action)}
            onRetract={(item) => {
              setNotice('');
              setAction({ kind: 'retract', evidence: item });
            }}
          />
          {!action && (
            <Button
              variant="secondary"
              disabled={references.length === 0}
              onClick={() => {
                setNotice('');
                setAction({ kind: 'confirm' });
              }}
            >
              Conferir adesão
            </Button>
          )}
        </>
      )}
      {action?.kind === 'confirm' && (
        <>
          {documents.isError && (
            <FeedbackState
              kind="error"
              onRetry={() => void documents.refetch()}
              retryVariant="secondary"
            >
              Lista de arquivos indisponível. A conferência por referência externa continua
              disponível.
            </FeedbackState>
          )}
          {documents.isPending && <p role="status">Carregando arquivos opcionais…</p>}
          <AdhesionEvidenceForm
            companyId={companyId}
            references={references}
            documents={documents.data ?? []}
            onClose={finish}
          />
        </>
      )}
      {action?.kind === 'retract' && (
        <AdhesionEvidenceRetraction evidence={action.evidence} onClose={finish} />
      )}
      {notice && <FeedbackMessage tone="success">{notice}</FeedbackMessage>}
    </section>
  );
}
