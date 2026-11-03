import { type CurrentTerms } from '../../api/modules/access/session';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';

type TermsAcceptanceProps = {
  terms: CurrentTerms;
  agreed: boolean;
  busy: boolean;
  setAgreed: (checked: boolean) => void;
  accept: () => Promise<void>;
};

export function TermsAcceptance({ terms, agreed, busy, setAgreed, accept }: TermsAcceptanceProps) {
  return (
    <>
      <p>Leia os documentos antes de continuar. Versão {terms.version}.</p>
      <div
        className="tw:my-4 tw:max-h-96 tw:overflow-auto tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:leading-note tw:wrap-anywhere"
        tabIndex={0}
        aria-label="Termos de uso e política de privacidade"
      >
        {terms.content.split('\n').map((line, lineNumber) => (
          <p key={`${terms.version}-line-${lineNumber}`} className="tw:my-2">
            {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
          </p>
        ))}
      </div>
      <Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)}>
        Li e aceito os termos de uso e a política de privacidade.
      </Checkbox>
      <Button disabled={!agreed} pending={busy} onClick={() => void accept()}>
        Aceitar e continuar
      </Button>
    </>
  );
}
