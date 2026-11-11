// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  overviewPdf,
  type OverviewPdfContent,
} from '../src/modules/admin/overview/components/overview-pdf';

const metrics = [
  ['Contas ativas', '12'],
  ['Ações pendentes', '4'],
  ['Horas no mês', '18,5h'],
  ['Satisfação média', '4,8 / 5'],
] as const;

describe('PDF da visão geral', () => {
  it('renderiza capa e grade de indicadores num PDF A4 de uma página', async () => {
    const content: OverviewPdfContent = {
      metrics,
      sections: [
        {
          title: 'Prioridades de hoje',
          rows: [['Projeto de implantação', 'Ajuste solicitado']],
        },
      ],
    };
    const blob = await overviewPdf(
      'Empresa sintética \u0000 😀 · novembro',
      '10 de novembro de 2026',
      content,
    );
    const document = await PDFDocument.load(await blob.arrayBuffer());
    const [page] = document.getPages();

    expect(document.getPages()).toHaveLength(1);
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
    expect(document.getTitle()).toContain('Visão geral da operação');
    expect(document.getSubject()).toBe('Empresa sintética 😀 · novembro');
  });

  it('página listas longas em continuação e preserva todos os blocos', async () => {
    const content: OverviewPdfContent = {
      metrics,
      sections: [
        {
          title: 'Agenda da CALI',
          rows: Array.from(
            { length: 24 },
            (_, index) =>
              [`Compromisso ${index + 1}`, `Data e descrição do compromisso ${index + 1}`] as const,
          ),
        },
        { title: 'Satisfação', rows: [['', 'Nenhuma avaliação neste recorte.']] },
      ],
    };
    const blob = await overviewPdf('Todas as empresas', 'novembro de 2026', content);
    const document = await PDFDocument.load(await blob.arrayBuffer());

    expect(document.getPages().length).toBeGreaterThan(1);
    expect(
      document.getPages().every((page) => page.getWidth() > 590 && page.getHeight() > 840),
    ).toBe(true);
  });
});
