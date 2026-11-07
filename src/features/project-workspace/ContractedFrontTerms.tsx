import { type FrontTerms } from '../../api/modules/project-workspace/schemas';
import { formatCalendarDate } from '../../lib/dates';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ActionForm } from './ActionForm';

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

type Scope = { company: string; actor?: string };

function useFrontManagement({ company, actor }: Scope) {
  const { domainOperations: operations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  return {
    operations,
    async refresh(result: string) {
      await cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'fronts'] });
      return result;
    },
  };
}

const optionValue = (item: { code: string; mode: FrontTerms['mode'] }) =>
  item.code + ':' + item.mode;

export function ActivateContractedFront({ company, actor }: Scope) {
  const { operations, refresh } = useFrontManagement({ company, actor });
  const available = useQuery({
    queryKey: ['phase4-front-options', actor, company],
    queryFn: operations ? ({ signal }) => operations.frontOptions(company, signal) : skipToken,
  });
  if (!operations) return null;
  if (available.isPending)
    return <FeedbackState kind="loading">Carregando opções de frente…</FeedbackState>;
  if (available.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void available.refetch()}>
        Não foi possível consultar as opções de frente.
      </FeedbackState>
    );
  const { options, hasPlan } = available.data;
  if (!hasPlan)
    return (
      <FeedbackState kind="empty">Defina um plano para ativar frentes nesta empresa.</FeedbackState>
    );
  if (!options.length)
    return (
      <FeedbackState kind="empty">
        O plano atual não tem frentes adicionais no catálogo.
      </FeedbackState>
    );

  return (
    <ActionForm
      label="Ativar frente contratada"
      submit={async (fields, request) => {
        const option = options.find((item) => optionValue(item) === fields.get('front'));
        if (!option) throw new Error('Selecione uma frente e modalidade.');
        return refresh(
          await operations.activateFront(company, request, {
            code: option.code,
            mode: option.mode,
            scope: String(fields.get('scope') ?? ''),
            startsOn: String(fields.get('startsOn') ?? ''),
            endsOn: String(fields.get('endsOn') ?? '') || null,
          }),
        );
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'front'} label="Frente e modalidade">
            <select id={prefix + 'front'} name="front" required>
              <option value="">Selecione</option>
              {options.map((item) => (
                <option key={optionValue(item)} value={optionValue(item)}>
                  {item.title} · {modeLabels[item.mode]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={prefix + 'scope'} label="Escopo contratado">
            <input id={prefix + 'scope'} name="scope" maxLength={240} />
          </Field>
          <Field id={prefix + 'startsOn'} label="Início da vigência">
            <input id={prefix + 'startsOn'} name="startsOn" type="date" required />
          </Field>
          <Field id={prefix + 'endsOn'} label="Fim da vigência (opcional)">
            <input id={prefix + 'endsOn'} name="endsOn" type="date" />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

export function EndContractedFront({ company, actor, id }: Scope & { id: string }) {
  const { operations, refresh } = useFrontManagement({ company, actor });
  if (!operations) return null;
  return (
    <ActionForm
      label="Encerrar frente"
      submit={async () => refresh(await operations.endFront(company, id))}
    >
      {() => <Checkbox required>Confirmo o encerramento desta frente</Checkbox>}
    </ActionForm>
  );
}
