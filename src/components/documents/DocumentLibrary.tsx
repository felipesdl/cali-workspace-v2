import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { Input } from '../ds/field/Controls';
import { FileInput } from '../ds/field/FileInput';
import { useEffect, useRef, useState } from 'react';
import { PdfDownload } from './PdfDownload';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type DocumentOperations, type PilotDocument } from '../../api/shared/workspace/documents';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Checkbox } from '../ds/checkbox/Checkbox';
import { Field } from '../ds/field/Field';
import { ActionForm } from '../workspace/ActionForm';
import { Panel } from '../ds/panel/Panel';

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
}: Pick<Scope, 'company' | 'operations'> & { documentId: string; revisionId: string }) {
  return (
    <PdfDownload
      download={(signal) => operations.download(company, documentId, revisionId, signal)}
    />
  );
}

function Upload({
  company,
  operations,
  item,
  delivery,
  refresh,
}: Pick<Scope, 'company' | 'operations'> & {
  item?: PilotDocument;
  delivery?: string;
  refresh: () => Promise<void>;
}) {
  return (
    <ActionForm
      label={item ? 'Adicionar revisão' : delivery ? 'Anexar PDF' : 'Salvar novo documento'}
      submit={async (values, request) => {
        const file = values.get('pdf');
        if (!(file instanceof File) || file.size === 0) throw new Error('Selecione um PDF.');
        const title = item?.title ?? String(values.get('title') ?? '').trim();
        const result = delivery
          ? await operations.addDelivery(
              company,
              delivery,
              item?.id ?? request,
              request,
              item?.revisionId ?? null,
              file,
            )
          : await operations.add(
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
          {!item && !delivery && (
            <Field id={prefix + 'title'} label="Título do documento">
              <Input id={prefix + 'title'} name="title" required maxLength={180} />
            </Field>
          )}
          <Field id={prefix + 'pdf'} label="PDF de até 2 MiB">
            <FileInput id={prefix + 'pdf'} name="pdf" required accept="application/pdf,.pdf" />
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
  const [lastAction, setLastAction] = useState<{
    revision: string;
    kind: 'publish' | 'withdraw' | 'acknowledge';
  }>();
  const receipt = useRef<HTMLParagraphElement>(null);
  const latestPublished = item.publishedRevision === item.revisionId;
  const completed = lastAction?.revision === item.revisionId ? lastAction.kind : undefined;
  const message =
    completed === 'withdraw' && !item.publishedRevision
      ? 'Versão retirada. O histórico continua disponível para a CALI.'
      : completed === 'publish' && latestPublished
        ? `Revisão ${item.number} publicada.`
        : !admin && item.acknowledged
          ? 'Ciência registrada para esta revisão.'
          : '';
  useEffect(() => {
    if (message && completed && document.activeElement === document.body) {
      receipt.current?.focus();
    }
  }, [completed, message]);
  return (
    <li>
      <Panel className="tw:grid tw:min-w-0 tw:gap-4 tw:p-4 tw:wrap-anywhere">
        <header className="tw:grid tw:gap-2 tw:border-b tw:border-border-default tw:pb-3">
          <h3 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">{item.title}</h3>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            Revisão {item.number} · {item.fileName}
            {latestPublished && ' · Publicada'}
          </p>
        </header>
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
                  setLastAction(undefined);
                  const result = await operations.publication(
                    company,
                    item.id,
                    item.publishedRevision,
                    item.revisionId,
                  );
                  await refresh();
                  setLastAction({ revision: item.revisionId, kind: 'publish' });
                  return result;
                }}
              />
            )}
            {item.publishedRevision && (
              <ActionForm
                label="Retirar versão publicada"
                submit={async (values) => {
                  if (!values.has('confirmWithdrawal')) throw new Error('Confirme a retirada.');
                  setLastAction(undefined);
                  const result = await operations.publication(
                    company,
                    item.id,
                    item.publishedRevision,
                    null,
                  );
                  await refresh();
                  setLastAction({ revision: item.revisionId, kind: 'withdraw' });
                  return result;
                }}
              >
                {() => (
                  <Checkbox name="confirmWithdrawal" required>
                    Confirmo a retirada{' '}
                    {latestPublished ? `da revisão ${item.number}` : 'da versão publicada'} de{' '}
                    {item.title}. O Cliente perde acesso a essa publicação e o histórico continua
                    disponível para a CALI.
                  </Checkbox>
                )}
              </ActionForm>
            )}
            <div className="tw:border-t tw:border-border-default tw:pt-3">
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
        ) : (
          !item.acknowledged && (
            <ActionForm
              label="Registrar ciência desta revisão"
              submit={async () => {
                const result = await operations.acknowledge(company, item.id, item.revisionId);
                await refresh();
                setLastAction({ revision: item.revisionId, kind: 'acknowledge' });
                return result;
              }}
            />
          )
        )}
        {message && (
          <FeedbackMessage ref={receipt} tone="success" tabIndex={-1}>
            {message}
          </FeedbackMessage>
        )}
      </Panel>
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
      <header className="tw:grid tw:gap-1">
        <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">PDFs versionados</h2>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Arquivos PDF, revisões, publicação e ciência deste acervo.
        </p>
      </header>
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
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
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

const pdfUploadStates = new Set([
  'in_progress',
  'internal_review',
  'adjustment_requested',
  'rebriefing',
]);

export function DeliveryPdf({
  company,
  actor,
  operations,
  admin,
  project,
  delivery,
  status,
  canEdit,
}: Scope & {
  admin: boolean;
  project: string;
  delivery: string;
  status: string;
  canEdit: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const cache = useQueryClient();
  const key = ['phase4-delivery-pdf', actor, company, project, delivery];
  const pdf = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => operations.delivery(company, delivery, signal),
  });
  if (pdf.isPending) return <FeedbackState kind="loading">Consultando PDF…</FeedbackState>;
  if (pdf.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void pdf.refetch()}>
        Não foi possível consultar o PDF do entregável.
      </FeedbackState>
    );
  const item = pdf.data;
  const canUpload = admin && canEdit && pdfUploadStates.has(status);
  if (!item && !canUpload) return null;

  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['project', actor, company, project] }),
      cache.invalidateQueries({ queryKey: ['phase4-document-history', actor, company] }),
    ]);
  }
  return (
    <div className="tw:my-3 tw:grid tw:gap-2">
      {item && (
        <>
          <p>
            PDF · Revisão {item.number} · {item.fileName}
            {item.publishedRevision === item.revisionId && ' · Publicada'}
          </p>
          <Download
            key={item.revisionId}
            company={company}
            operations={operations}
            documentId={item.id}
            revisionId={item.revisionId}
          />
        </>
      )}
      {canUpload && (
        <>
          <Upload
            company={company}
            operations={operations}
            item={item ?? undefined}
            delivery={delivery}
            refresh={refresh}
          />
          <p>O PDF fica disponível ao Cliente quando o entregável é enviado para revisão.</p>
        </>
      )}
      {admin && item && (
        <>
          <div>
            <Button
              variant="secondary"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Ocultar histórico do PDF' : 'Ver histórico do PDF'}
            </Button>
          </div>
          {showHistory && (
            <History company={company} actor={actor} operations={operations} item={item} />
          )}
        </>
      )}
    </div>
  );
}
