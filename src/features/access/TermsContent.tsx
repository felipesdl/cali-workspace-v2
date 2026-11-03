import { type CurrentTerms } from '../../api/modules/access/session';
export function TermsContent({ terms }: { terms: CurrentTerms }) {
  return (
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
  );
}
