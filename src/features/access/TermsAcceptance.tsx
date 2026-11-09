import { type ReactNode } from 'react';
import { TermsContent } from './TermsContent';
import { type CurrentTerms } from '../../api/modules/access/session';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FormActions } from '../../components/ds/button/FormActions';

type TermsAcceptanceProps = {
  terms: CurrentTerms;
  agreed: boolean;
  busy: boolean;
  setAgreed: (checked: boolean) => void;
  accept: () => Promise<void>;
  exitAction?: ReactNode;
};

export function TermsAcceptance({
  terms,
  agreed,
  busy,
  setAgreed,
  accept,
  exitAction,
}: TermsAcceptanceProps) {
  return (
    <>
      <p>Leia os documentos antes de continuar. Versão {terms.version}.</p>
      <TermsContent terms={terms} />
      <Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)}>
        Li e aceito os termos de uso e a política de privacidade.
      </Checkbox>
      <FormActions>
        <Button disabled={!agreed} pending={busy} onClick={() => void accept()}>
          Aceitar e continuar
        </Button>
        {exitAction}
      </FormActions>
    </>
  );
}
