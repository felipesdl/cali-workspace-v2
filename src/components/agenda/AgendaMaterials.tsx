import { Input } from '../ds/field/Controls';
import { FileInput } from '../ds/field/FileInput';
import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { type AgendaOperations } from '../../api/shared/workspace/agenda';
import { Field } from '../ds/field/Field';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { ActionForm } from '../workspace/ActionForm';
import { PdfDownload } from '../documents/PdfDownload';

export function AgendaMaterials({
  agenda,
  company,
  actor,
  appointment,
  admin,
}: {
  agenda: AgendaOperations;
  company: string;
  actor?: string;
  appointment: string;
  admin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: ['phase4-agenda-material', actor, company, appointment],
    queryFn: open ? ({ signal }) => agenda.material(company, appointment, signal) : skipToken,
  });
  const { link, pdf } = result.data ?? {};
  const refresh = async (id: string) => {
    await result.refetch();
    return id;
  };

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Materiais da ata</summary>
      {open && result.isPending && (
        <FeedbackState kind="loading">Carregando materiais…</FeedbackState>
      )}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar os materiais da ata.
        </FeedbackState>
      )}
      {result.data && (
        <div className="tw:grid tw:gap-3">
          {link?.label && link.url && (
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="tw:underline">
              {link.label}
            </a>
          )}
          {pdf?.label && (
            <div>
              <p>{pdf.label}</p>
              <PdfDownload
                download={(signal) => agenda.downloadMaterial(company, appointment, pdf.id, signal)}
              />
            </div>
          )}
          {!link?.label && !pdf?.label && <p>Nenhum material publicado.</p>}
          {admin && (
            <>
              <ActionForm
                label="Salvar link da ata"
                submit={async (fields, request) =>
                  refresh(
                    await agenda.saveMaterial(company, appointment, request, link?.id ?? null, {
                      kind: 'link',
                      label: String(fields.get('label') ?? ''),
                      url: String(fields.get('url') ?? ''),
                    }),
                  )
                }
              >
                {(prefix) => (
                  <>
                    <Field id={prefix + 'label'} label="Nome do link">
                      <Input
                        id={prefix + 'label'}
                        name="label"
                        defaultValue={link?.label ?? ''}
                        maxLength={180}
                        required
                      />
                    </Field>
                    <Field id={prefix + 'url'} label="Endereço HTTPS">
                      <Input
                        id={prefix + 'url'}
                        name="url"
                        type="url"
                        defaultValue={link?.url ?? ''}
                        maxLength={2000}
                        required
                      />
                    </Field>
                  </>
                )}
              </ActionForm>
              <ActionForm
                label="Anexar PDF da ata"
                submit={async (fields, request) => {
                  const file = fields.get('pdf');
                  if (!(file instanceof File)) throw new Error('Selecione um PDF.');
                  return refresh(
                    await agenda.saveMaterial(company, appointment, request, pdf?.id ?? null, {
                      kind: 'pdf',
                      file,
                    }),
                  );
                }}
              >
                {(prefix) => (
                  <Field id={prefix + 'pdf'} label="PDF da ata (até 2 MiB)">
                    <FileInput
                      id={prefix + 'pdf'}
                      name="pdf"
                      accept="application/pdf,.pdf"
                      required
                    />
                  </Field>
                )}
              </ActionForm>
              {link?.label && (
                <ActionForm
                  label="Retirar link"
                  submit={async (_, request) =>
                    refresh(
                      await agenda.saveMaterial(company, appointment, request, link.id, {
                        kind: 'link',
                        remove: true,
                      }),
                    )
                  }
                />
              )}
              {pdf?.label && (
                <ActionForm
                  label="Retirar PDF"
                  submit={async (_, request) =>
                    refresh(
                      await agenda.saveMaterial(company, appointment, request, pdf.id, {
                        kind: 'pdf',
                        remove: true,
                      }),
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}
