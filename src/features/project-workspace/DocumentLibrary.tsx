import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DocumentOperations,
  type PilotDocument,
} from '../../api/modules/project-workspace/documents';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

type Scope = {
  company: string;
  actor?: string;
  operations: DocumentOperations;
};

function Download({
  company,
  operations,
  documentId,
  revisionId,
}: Pick<Scope, 'company' | 'operations'> & {
  documentId: string;
  revisionId: string;
}) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => pending.current?.abort(), []);

  async function download() {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError('');
    try {
      const result = await operations.download(company, documentId, revisionId, request.signal);
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o PDF.');
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => void download()}>
        {busy ? 'Baixando…' : 'Baixar PDF'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function Upload({
  company,
  operations,
  item,
  refresh,
}: Pick<Scope, 'company' | 'operations'> & {
  item?: PilotDocument;
  refresh: () => Promise<void>;
}) {
  return (
    <ActionForm
      label={item ? 'Adicionar revisão' : 'Salvar novo documento'}
      submit={async (values, request) => {
        const file = values.get('pdf');
        if (!(file instanceof File) || file.size === 0) throw new Error('Selecione um PDF.');
        const title = item?.title ?? String(values.get('title') ?? '').trim();
        const result = await operations.add(
          company,
          item?.id ?? request,
          request,
          item?.revisionId ?? null,
          title,
          file,
        );
        await refresh();
        return result;
      }}
    >
      {(prefix) => (
        <>
          {!item && (
            <Field id={prefix + 'title'} label="Título do documento">
              <input id={prefix + 'title'} name="title" required maxLength={180} />
            </Field>
          )}
          <Field id={prefix + 'pdf'} label="PDF de até 2 MiB">
            <input
              id={prefix + 'pdf'}
              name="pdf"
              required
              type="file"
              accept="application/pdf,.pdf"
            />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

function Pager({
  page,
  size,
  change,
}: {
  page: number;
  size: number;
  change: (page: number) => void;
}) {
  if (page === 1 && size < 25) return null;
  return (
    <nav className="tw:flex tw:gap-2" aria-label="Paginação de documentos">
      <Button variant="secondary" disabled={page <= 1} onClick={() => change(page - 1)}>
        Anterior
      </Button>
      <Button
        variant="secondary"
        disabled={size < 25 || page >= 10000}
        onClick={() => change(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

function History({ company, actor, operations, item }: Scope & { item: PilotDocument }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['phase4-document-history', actor, company, item.id, page],
    queryFn: ({ signal }) => operations.history(company, item.id, page, signal),
  });
  if (history.isPending) return <FeedbackState kind="loading">Carregando histórico…</FeedbackState>;
  if (history.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void history.refetch()}>
        Não foi possível carregar o histórico.
      </FeedbackState>
    );
  return (
    <>
      <ul className="tw:grid tw:gap-3">
        {history.data.map((revision) => (
          <li key={revision.id}>
            <p>
              Revisão {revision.number} · {revision.fileName}
              {item.publishedRevision === revision.id && ' · Publicada'}
            </p>
            <Download
              key={revision.id}
              company={company}
              operations={operations}
              documentId={item.id}
              revisionId={revision.id}
            />
          </li>
        ))}
      </ul>
      <Pager page={page} size={history.data.length} change={setPage} />
    </>
  );
}

function DocumentItem({
  company,
  actor,
  operations,
  admin,
  item,
  refresh,
}: Scope & {
  admin: boolean;
  item: PilotDocument;
  refresh: () => Promise<void>;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const latestPublished = item.publishedRevision === item.revisionId;
  return (
    <li className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4">
      <strong>{item.title}</strong>
      <p>
        Revisão {item.number} · {item.fileName}
        {latestPublished && ' · Publicada'}
      </p>
      <Download
        key={item.revisionId}
        company={company}
        operations={operations}
        documentId={item.id}
        revisionId={item.revisionId}
      />
      {admin ? (
        <>
          <Upload company={company} operations={operations} item={item} refresh={refresh} />
          {!latestPublished && (
            <ActionForm
              label="Publicar revisão mais recente"
              submit={async () => {
                const result = await operations.publication(
                  company,
                  item.id,
                  item.publishedRevision,
                  item.revisionId,
                );
                await refresh();
                return result;
              }}
            />
          )}
          {item.publishedRevision && (
            <ActionForm
              label="Retirar versão publicada"
              submit={async () => {
                const result = await operations.publication(
                  company,
                  item.id,
                  item.publishedRevision,
                  null,
                );
                await refresh();
                return result;
              }}
            />
          )}
          <div>
            <Button
              variant="secondary"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Ocultar histórico' : 'Ver histórico'}
            </Button>
          </div>
          {showHistory && (
            <History company={company} actor={actor} operations={operations} item={item} />
          )}
        </>
      ) : item.acknowledged ? (
        <p>Ciência registrada para esta revisão.</p>
      ) : (
        <ActionForm
          label="Registrar ciência desta revisão"
          submit={async () => {
            const result = await operations.acknowledge(company, item.id, item.revisionId);
            await refresh();
            return result;
          }}
        />
      )}
    </li>
  );
}

export function DocumentLibrary({ company, actor, operations, admin }: Scope & { admin: boolean }) {
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const documents = useQuery({
    queryKey: ['phase4-documents', actor, company, page],
    queryFn: ({ signal }) => operations.list(company, page, signal),
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['phase4-documents', actor, company] }),
      cache.invalidateQueries({ queryKey: ['phase4-document-history', actor, company] }),
    ]);
  }
  return (
    <section aria-label="PDFs versionados" className="tw:grid tw:gap-3">
      <h2 className="tw:text-section">PDFs versionados</h2>
      {admin && (
        <Upload
          company={company}
          operations={operations}
          refresh={async () => {
            setPage(1);
            await refresh();
          }}
        />
      )}
      {documents.isPending && <FeedbackState kind="loading">Carregando documentos…</FeedbackState>}
      {documents.isError && (
        <FeedbackState kind="error" onRetry={() => void documents.refetch()}>
          Não foi possível listar os documentos.
        </FeedbackState>
      )}
      {documents.isSuccess && documents.data.length === 0 && <p>Nenhum PDF nesta página.</p>}
      {documents.data && (
        <>
          <ul className="tw:grid tw:gap-3">
            {documents.data.map((item) => (
              <DocumentItem
                key={item.id}
                company={company}
                actor={actor}
                operations={operations}
                admin={admin}
                item={item}
                refresh={refresh}
              />
            ))}
          </ul>
          <Pager page={page} size={documents.data.length} change={setPage} />
        </>
      )}
    </section>
  );
}
