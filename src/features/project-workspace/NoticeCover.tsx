import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

export function NoticeCover({
  company,
  actor,
  notice,
  version,
  hasCover,
  editable,
}: {
  company: string;
  actor?: string;
  notice: string;
  version: string | null;
  hasCover: boolean;
  editable: boolean;
}) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const cover = useQuery({
    queryKey: ['phase4-notice-cover', actor, company, notice, version],
    queryFn:
      domainOperations && version && hasCover
        ? ({ signal }) => domainOperations.noticeCover(company, notice, version, signal)
        : skipToken,
    retry: false,
  });
  if (!domainOperations || (!editable && !hasCover)) return null;

  async function save(request: string, file: File | null) {
    if (!domainOperations) throw new Error('Capa indisponível.');
    const saved = await domainOperations.saveNoticeCover(company, notice, request, version, file);
    await cache.invalidateQueries({ queryKey: ['phase4-catalog', actor, company, 'notices'] });
    return saved;
  }

  return (
    <div className="tw:my-3 tw:grid tw:gap-2">
      {cover.data && (
        <img
          className="tw:max-h-64 tw:max-w-full tw:object-contain tw:object-left"
          src={cover.data}
          alt="Capa do aviso"
        />
      )}
      {cover.isError && <p role="status">Capa indisponível.</p>}
      {editable && (
        <details>
          <summary>Editar capa do aviso</summary>
          <ActionForm
            label="Salvar capa do aviso"
            submit={(fields, request) => {
              const file = fields.get('cover');
              if (!(file instanceof File)) throw new Error('Selecione uma imagem.');
              return save(request, file);
            }}
          >
            {(prefix) => (
              <Field id={prefix + 'cover'} label="Imagem da capa">
                <input
                  id={prefix + 'cover'}
                  name="cover"
                  type="file"
                  accept="image/png,image/jpeg"
                  required
                />
              </Field>
            )}
          </ActionForm>
          {hasCover && (
            <ActionForm
              label="Remover capa do aviso"
              submit={(_, request) => save(request, null)}
            />
          )}
        </details>
      )}
    </div>
  );
}
