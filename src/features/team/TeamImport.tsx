import { FormActions } from '../../components/ds/button/FormActions';
import { FileInput } from '../../components/ds/field/FileInput';
import { useState } from 'react';
import { z } from 'zod';
import {
  parseTeamCsv,
  previewKind,
  teamCsvTemplate,
  type ImportPrivateRow,
  type TeamImportPreview,
} from '../../api/modules/team/import';
import { type ProfessionalPatch, type TeamSaveRow } from '../../api/modules/team/maintenance';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { TeamMonthField } from './TeamEditor';

type Prepared = { csv: ReturnType<typeof parseTeamCsv>; review: TeamImportPreview };
const labels = {
  [previewKind.New]: 'Nova',
  [previewKind.Changed]: 'Alterada',
  [previewKind.Reactivated]: 'Reativada',
  [previewKind.Unchanged]: 'Sem alteração profissional',
} as const;

export function TeamImport({
  onPreview,
  onConfirm,
  onCancel,
  pending,
}: {
  onPreview: (fields: ProfessionalPatch[]) => Promise<TeamImportPreview>;
  onConfirm: (month: string, rows: TeamSaveRow[], privateRows: ImportPrivateRow[]) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
}) {
  const [prepared, setPrepared] = useState<Prepared>();
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function prepare(file: File) {
    setBusy(true);
    setPrepared(undefined);
    setErrors([]);
    try {
      if (file.size > 1_000_000) throw new Error('O CSV deve ter até 1 MB.');
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const csv = parseTeamCsv(raw);
      if (csv.errors.length) {
        setErrors(csv.errors);
        return;
      }
      const review = await onPreview(csv.rows.map((row) => row.fields));
      if (
        review.rows.length !== csv.rows.length ||
        review.rows.some((row, index) => row.code !== csv.rows[index]?.fields.employee_code)
      )
        throw new Error('A prévia não corresponde ao arquivo. Selecione o CSV novamente.');
      setPrepared({ csv, review });
    } catch (cause) {
      setErrors([
        cause instanceof TypeError
          ? 'Salve o CSV com codificação UTF-8.'
          : cause instanceof Error
            ? cause.message
            : 'Não foi possível ler a planilha.',
      ]);
    } finally {
      setBusy(false);
    }
  }

  const review = prepared?.review;
  const managerError = review?.rows.some((row) => !row.managerValid);
  return (
    <form
      aria-label="Importar equipe"
      className="tw:grid tw:gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!prepared || managerError) return;
        try {
          setErrors([]);
          const month = z.iso.date().parse(new FormData(event.currentTarget).get('month'));
          const rows = prepared.csv.rows.map((row, index) => ({
            fields: row.fields,
            expectedAt: prepared.review.rows[index].expectedAt,
          }));
          const privateRows = prepared.csv.rows.flatMap((row, index) =>
            Object.keys(row.privateFields).length
              ? [
                  {
                    code: row.fields.employee_code,
                    expectedAt: prepared.review.rows[index].privateExpectedAt,
                    declared: true as const,
                    fields: row.privateFields,
                  },
                ]
              : [],
          );
          await onConfirm(month, rows, privateRows);
        } catch (cause) {
          setErrors([
            cause instanceof Error ? cause.message : 'Não foi possível importar a equipe.',
          ]);
        }
      }}
    >
      <h2 className="tw:text-section tw:font-bold tw:text-brand">Importar equipe</h2>
      <p className="tw:text-muted-copy">
        Selecione um CSV em UTF-8 e revise a prévia. Pessoas ausentes continuam na equipe.
      </p>
      <a
        download="cali-modelo-equipe.csv"
        className="tw:text-brand tw:underline"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(teamCsvTemplate)}`}
      >
        Baixar modelo CSV
      </a>
      <Field id="team-csv" label="Planilha de equipe">
        <FileInput
          id="team-csv"
          accept=".csv,text/csv"
          disabled={busy || pending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void prepare(file);
          }}
        />
      </Field>
      {busy && <FeedbackState kind="loading">Preparando prévia…</FeedbackState>}
      {review && (
        <div className="tw:grid tw:gap-2">
          <h3 className="tw:font-bold">Prévia da importação</h3>
          <p>
            {review.absent}{' '}
            {review.absent === 1
              ? 'ficha ausente será preservada'
              : 'fichas ausentes serão preservadas'}
            .
          </p>
          <ul className="tw:flex tw:flex-wrap tw:gap-x-4">
            {Object.entries(labels).map(([kind, label]) => (
              <li key={kind}>
                {label}: {review.rows.filter((row) => row.kind === kind).length}
              </li>
            ))}
          </ul>
          <ul
            aria-label="Linhas da prévia"
            className="tw:max-h-64 tw:overflow-auto tw:rounded-control tw:border tw:border-border-default tw:p-3"
            tabIndex={0}
          >
            {review.rows.map((row, index) => (
              <li key={row.code} className="tw:border-b tw:border-border-default tw:py-2">
                Linha {prepared?.csv.rows[index].line} · {row.code} · {labels[row.kind]}
                {!row.managerValid && ' · Gestor direto inválido'}
                {Boolean(Object.keys(prepared?.csv.rows[index].privateFields ?? {}).length) &&
                  ' · Inclui dados privados declarados'}
              </li>
            ))}
          </ul>
          {managerError && (
            <FeedbackState kind="error">
              Corrija os gestores indicados e selecione o CSV atualizado.
            </FeedbackState>
          )}
          <TeamMonthField id="team-import-month" />
        </div>
      )}
      {errors.length > 0 && (
        <FeedbackState kind="error">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </FeedbackState>
      )}
      <FormActions className="tw:max-w-md">
        <Button type="submit" pending={pending} disabled={busy || !prepared || managerError}>
          Confirmar importação
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </FormActions>
    </form>
  );
}
