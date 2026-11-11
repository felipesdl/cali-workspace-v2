import fontkit from '@pdf-lib/fontkit';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff?inline';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff?inline';
import { PDFDocument, PageSizes, rgb, type PDFFont } from 'pdf-lib';
import { type MapaReport } from '../../api/admin/workspace/admin-read';
import { formatServerInstant } from '../dates';
import { pdfLines } from '../pdf-lines';
import { mapaReportContent } from './mapa-report-content';

export async function mapaReportPdf(report: MapaReport) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(interRegular, { subset: true }),
    pdf.embedFont(interBold, { subset: true }),
  ]);
  pdf.setTitle('Diagnóstico do Mapa de People');
  pdf.setAuthor('CALI RH');
  const [width, height] = PageSizes.A4;
  const brand = rgb(0.34, 0.13, 0.19);
  const pale = rgb(0.93, 0.89, 0.86);
  const gold = rgb(0.73, 0.55, 0.3);
  const inset = 48;
  const textWidth = width - inset * 2;

  function createPage() {
    const page = pdf.addPage(PageSizes.A4);
    page.drawRectangle({ x: 0, y: height - 9, width, height: 9, color: brand });
    page.drawText('CALI WORKSPACE', {
      x: inset,
      y: height - 44,
      size: 11,
      font: bold,
      color: brand,
    });
    return page;
  }

  let page = createPage();
  let y = height - 80;
  function write(text: string, font: PDFFont = regular, size = 11) {
    const lineHeight = size * 1.45;
    for (const paragraph of text.split(/\r?\n/)) {
      for (const [index, line] of pdfLines(
        Array.from(paragraph, (character) => (character.charCodeAt(0) < 32 ? ' ' : character)).join(
          '',
        ),
        font,
        size,
        textWidth,
      ).entries()) {
        if (y < 60 || (index === 0 && font === bold && y < 90)) {
          page = createPage();
          y = height - 80;
        }
        if (line) page.drawText(line, { x: inset, y, size, font, color: brand });
        y -= lineHeight;
      }
    }
    y -= 6;
  }

  const content = mapaReportContent(report);
  write('Diagnóstico do Mapa de People', bold, 22);
  if (report.companyName) write(report.companyName, bold, 14);
  if (report.protocol) write(report.protocol);
  if (report.createdAt) write(formatServerInstant(report.createdAt) + ' (Brasília)');
  write('Síntese executiva · ' + content.score, bold, 15);
  write(content.outlook);
  for (const dimension of content.dimensions) {
    write(dimension.title + ' · ' + dimension.score, bold, 14);
    page.drawRectangle({ x: inset, y: y + 4, width: textWidth, height: 4, color: pale });
    if (dimension.value > 0) {
      page.drawRectangle({
        x: inset,
        y: y + 4,
        width: (textWidth * dimension.value) / 10,
        height: 4,
        color: gold,
      });
    }
    y -= 7;
    for (const row of dimension.subScores) write(row);
    if (dimension.observation) write(dimension.observation);
  }
  if (content.opinion) {
    write('Parecer CALI', bold, 14);
    write(content.opinion);
  }
  if (content.recommendation) {
    write('Serviço recomendado', bold, 14);
    write(content.recommendation);
  }

  return {
    blob: new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' }),
    fileName: (report.protocol ?? 'cali-mapa-de-people').replace(/[^a-zA-Z0-9-]/g, '') + '.pdf',
  };
}
