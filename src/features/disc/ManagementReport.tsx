import { useEffect, useRef } from 'react';
import { type DiscManagement, type DiscStyle } from '../../api/modules/disc/schemas';
import { Button } from '../../components/ds/button/Button';
import { useDiscDownload } from '../../api/modules/disc/hooks';

const styles: DiscStyle[] = ['D', 'I', 'S', 'C'];
const discStyleLabels: Record<DiscStyle, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
};
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const approximateTen = (count: number, total: number) =>
  `Cerca de ${Math.round((count / total) * 10)} em 10`;

export function ManagementReport({
  report,
  audience = 'client',
  campaignId = null,
}: {
  report: DiscManagement;
  audience?: 'client' | 'admin';
  campaignId?: string | null;
}) {
  const urls = useRef(new Set<string>());
  const download = useDiscDownload(audience);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  async function downloadReport() {
    try {
      const blob = await download.mutateAsync({
        campaignId: campaignId ?? report.id,
        resultId: null,
      });
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = `disc-gestao-${report.id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        if (urls.current.delete(url)) URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      // A mutation preserves its error for the feedback below.
    }
  }

  if (report.mode === 'unavailable') {
    return (
      <section className="tw:grid tw:min-w-0 tw:gap-3 tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:wrap-anywhere">
        <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">{report.title}</h2>
        <p className="tw:m-0 tw:text-copy">
          A leitura de gestão ficará disponível após a CALI concluir e liberar a análise do grupo.
        </p>
      </section>
    );
  }

  return (
    <article className="tw:grid tw:min-w-0 tw:gap-5 tw:border tw:border-border-default tw:bg-panel tw:p-5 tw:wrap-anywhere">
      <header className="tw:grid tw:gap-2">
        <p className="tw:m-0 tw:text-caption tw:font-semibold tw:tracking-wide tw:text-muted-copy tw:uppercase">
          Perfil comportamental · gestão
        </p>
        <h2 className="tw:m-0 tw:text-section tw:font-semibold tw:text-brand">
          {report.organization || report.title}
        </h2>
        {report.goal && <p className="tw:m-0 tw:text-copy">Objetivo: {report.goal}</p>}
        {(report.sector || report.moment) && (
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            {[report.sector, report.moment].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      {report.mode === 'qualitative' ? (
        <section className="tw:grid tw:gap-3" aria-label="Leitura qualitativa do grupo">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Leitura do grupo</h3>
          <p className="tw:m-0 tw:text-copy">{report.qualitative.dominant}</p>
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Em situações de pressão</h3>
          <p className="tw:m-0 tw:text-copy">{report.qualitative.pressure}</p>
        </section>
      ) : (
        <section className="tw:grid tw:gap-3" aria-label="Distribuição agregada do grupo">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Distribuição do grupo</h3>
          {report.sample_size !== null && (
            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
              Base agregada: {report.sample_size} respostas concluídas
            </p>
          )}
          {report.distribution ? (
            <dl className="tw:m-0 tw:grid tw:gap-3">
              {styles.map((style) => (
                <div
                  key={style}
                  className="tw:grid tw:grid-cols-[minmax(8rem,1fr)_auto] tw:items-center tw:gap-3"
                >
                  <dt className="tw:text-copy">{discStyleLabels[style]}</dt>
                  <dd className="tw:m-0 tw:text-right tw:font-semibold">
                    {report.sample_size
                      ? approximateTen(report.distribution?.[style] ?? 0, report.sample_size)
                      : 'Indisponível'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="tw:m-0 tw:text-copy">A distribuição não está disponível nesta revisão.</p>
          )}
        </section>
      )}

      {report.mode === 'quantitative' &&
        report.quantitative &&
        report.sample_size !== null &&
        report.sample_size >= 15 && (
          <QuantitativeSummary quantitative={report.quantitative} sampleSize={report.sample_size} />
        )}

      {audience === 'admin' && report.note && (
        <section className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-4">
          <h3 className="tw:m-0 tw:text-body tw:font-semibold">Parecer interno CALI</h3>
          <p className="tw:m-0 tw:text-copy">{report.note}</p>
        </section>
      )}

      {report.approved_at && (
        <footer className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-4 tw:text-caption tw:text-muted-copy">
          <p className="tw:m-0">Aprovado pela CALI em {formatDate(report.approved_at)}</p>
          {report.protocol && <p className="tw:m-0">Protocolo {report.protocol}</p>}
          {report.signer && <p className="tw:m-0">Assinatura: {report.signer.full_name}</p>}
          {audience === 'admin' && report.released_at && (
            <p className="tw:m-0">Liberado em {formatDate(report.released_at)}</p>
          )}
          <Button
            variant="secondary"
            pending={download.isPending}
            onClick={() => void downloadReport()}
          >
            Baixar PDF aprovado
          </Button>
          {download.isError && (
            <p role="alert" className="tw:m-0 tw:text-action-primary">
              Não foi possível baixar o PDF. Tente novamente.
            </p>
          )}
        </footer>
      )}
    </article>
  );
}

function QuantitativeSummary({
  quantitative,
  sampleSize,
}: {
  quantitative: NonNullable<DiscManagement['quantitative']>;
  sampleSize: number;
}) {
  return (
    <section className="tw:grid tw:gap-4" aria-label="Indicadores agregados de estilo e pressão">
      <div className="tw:grid tw:gap-2">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">Estilos secundários</h3>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          A quantidade indica quantas pessoas têm cada estilo como segunda preferência.
        </p>
        <dl className="tw:m-0 tw:grid tw:gap-2">
          {styles.map((style) => (
            <div key={style} className="tw:grid tw:grid-cols-[minmax(8rem,1fr)_auto] tw:gap-3">
              <dt>{discStyleLabels[style]}</dt>
              <dd className="tw:m-0 tw:font-semibold">
                {approximateTen(quantitative.secondary[style], sampleSize)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Perfis mistos: {approximateTen(quantitative.mixed, sampleSize)}.
        </p>
      </div>

      <div className="tw:grid tw:gap-2">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">Intensidade das preferências</h3>
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          Faixa de cada estilo no conjunto, apresentada em aproximações.
        </p>
        <div className="tw:grid tw:gap-3">
          {styles.map((style) => {
            const band = quantitative.bands[style];
            return (
              <div key={style} className="tw:grid tw:gap-1">
                <strong>{discStyleLabels[style]}</strong>
                <p className="tw:m-0 tw:text-caption">
                  Baixa {approximateTen(band.low, sampleSize)} · Moderada{' '}
                  {approximateTen(band.mid, sampleSize)} · Alta{' '}
                  {approximateTen(band.high, sampleSize)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tw:grid tw:gap-2">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">Mudanças sob pressão</h3>
        <p className="tw:m-0 tw:text-caption">
          Muda pouco: {approximateTen(quantitative.pressure.stable, sampleSize)} · Muda em um
          estilo: {approximateTen(quantitative.pressure.one, sampleSize)} · Muda em mais de um:{' '}
          {approximateTen(quantitative.pressure.many, sampleSize)}
        </p>
        <dl className="tw:m-0 tw:grid tw:gap-2">
          {styles.map((style) => (
            <div key={style} className="tw:grid tw:grid-cols-[minmax(8rem,1fr)_auto] tw:gap-3">
              <dt>{discStyleLabels[style]}</dt>
              <dd className="tw:m-0 tw:text-right tw:text-caption">
                Sobe {approximateTen(quantitative.pressure.up[style], sampleSize)} · recua{' '}
                {approximateTen(quantitative.pressure.down[style], sampleSize)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function DiscPdfDownloadButton({
  campaignId,
  resultId,
  filename,
}: {
  campaignId: string;
  resultId: string;
  filename: string;
}) {
  const urls = useRef(new Set<string>());
  const download = useDiscDownload('admin');
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  async function downloadResult() {
    try {
      const blob = await download.mutateAsync({ campaignId, resultId });
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.replace(/[\\/]/g, '_');
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        if (urls.current.delete(url)) URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      // A mutation preserves its error for the feedback below.
    }
  }

  return (
    <div className="tw:grid tw:justify-items-start tw:gap-1">
      <Button
        variant="secondary"
        pending={download.isPending}
        onClick={() => void downloadResult()}
      >
        Baixar relatório interno PDF
      </Button>
      {download.isError && (
        <p role="alert" className="tw:m-0 tw:text-caption tw:text-action-primary">
          Não foi possível baixar o relatório. Tente novamente.
        </p>
      )}
    </div>
  );
}
