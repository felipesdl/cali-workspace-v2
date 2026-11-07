import { type FrontTerms } from '../../api/modules/project-workspace/schemas';
import { formatCalendarDate } from '../../lib/dates';

const modeLabels: Record<FrontTerms['mode'], string> = {
  slot_included: 'Vaga incluída no plano',
  slot_paid: 'Vaga adicional',
  addon: 'Adicional ao plano',
  build_assisted: 'Acompanhamento CALI Build',
};

export function ContractedFrontTerms({ terms }: { terms: FrontTerms }) {
  return (
    <dl className="tw:mt-2 tw:grid tw:gap-2">
      {terms.scope && (
        <div>
          <dt className="tw:font-semibold">Escopo contratado</dt>
          <dd>{terms.scope}</dd>
        </div>
      )}
      <div>
        <dt className="tw:font-semibold">Modalidade</dt>
        <dd>{modeLabels[terms.mode]}</dd>
      </div>
      {terms.endsOn && (
        <div>
          <dt className="tw:font-semibold">Fim da vigência</dt>
          <dd>{formatCalendarDate(terms.endsOn)}</dd>
        </div>
      )}
    </dl>
  );
}
