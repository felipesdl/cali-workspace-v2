import { PrivacyActions } from '../project-workspace/ReportPrivacyActions';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { useWorkspaceSession } from '../../api/modules/access/hooks/useWorkspaceSession';
import { TermsContent } from '../access/TermsContent';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
export function ClientTermsPage() {
  const state = useWorkspaceSession();
  if (
    state.phase !== 'resolved' ||
    state.access.status !== 'ready' ||
    !state.access.terms ||
    !state.access.termsAccepted
  )
    return (
      <FeedbackState kind="error">
        Não foi possível confirmar a versão vigente dos termos para este acesso.
      </FeedbackState>
    );
  const terms = state.access.terms;
  const profile = state.access.profile;
  const company = profile?.company_id ?? undefined;
  return (
    <section aria-label="Documentos de uso e privacidade" className="tw:min-w-0 tw:wrap-anywhere">
      <h2 className="tw:my-0 tw:text-section tw:text-brand">{terms.title}</h2>
      <p>Versão {terms.version}. O aceite da versão vigente está confirmado para este acesso.</p>
      <TermsContent terms={terms} />
      <p className="tw:text-caption tw:text-muted-copy">
        Esta consulta não registra um novo aceite. Quando houver uma nova versão, a confirmação será
        solicitada no acesso ao Workspace.
      </p>
      {company && isPilotCompany(company) && (
        <PrivacyActions company={company} actor={profile?.id} />
      )}
    </section>
  );
}
