import fontkit from '@pdf-lib/fontkit';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff?inline';
import interSemibold from '@fontsource/inter/files/inter-latin-600-normal.woff?inline';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { pdfLines } from '../../../../lib/pdf-lines';

export type OverviewPdfContent = {
  metrics: readonly (readonly [label: string, value: string])[];
  sections?: readonly {
    title: string;
    rows: readonly (readonly [label: string, value: string])[];
  }[];
};

const palette = {
  wine: rgb(0.353, 0.118, 0.176),
  wineDark: rgb(0.227, 0.067, 0.11),
  gold: rgb(0.71, 0.549, 0.322),
  ink: rgb(0.169, 0.169, 0.169),
  muted: rgb(0.46, 0.42, 0.4),
  paper: rgb(0.969, 0.953, 0.933),
  white: rgb(1, 0.992, 0.98),
  line: rgb(0.89, 0.851, 0.816),
  row: rgb(0.949, 0.918, 0.89),
};

const pageSize: [number, number] = [595.28, 841.89];
const marginX = 48;
const contentWidth = pageSize[0] - 2 * marginX;
const bottom = 54;

function safeText(value: string, max = 500) {
  const printable = Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function overviewPdf(scope: string, date: string, content: OverviewPdfContent) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(interRegular, { subset: true });
  const semibold = await document.embedFont(interSemibold, { subset: true });
  document.setTitle('Visão geral da operação · CALI Workspace');
  document.setSubject(safeText(scope, 180));

  const metrics = content.metrics.map(
    ([label, value]) => [safeText(label, 100), safeText(value, 120)] as const,
  );
  const sections = (content.sections ?? []).map(({ title, rows }) => ({
    title: safeText(title, 120),
    rows: rows.map(([label, value]) => [safeText(label, 220), safeText(value, 500)] as const),
  }));

  let page = document.addPage(pageSize);
  let pageNumber = 1;
  let y = drawCover(page, regular, semibold, safeText(scope, 180), safeText(date, 100), metrics);

  const addPage = () => {
    page = document.addPage(pageSize);
    pageNumber += 1;
    drawContinuation(page, regular, semibold, safeText(date, 100), pageNumber);
    y = 758;
  };
  const ensureSpace = (height: number) => {
    if (y - height < bottom) addPage();
  };

  for (const section of sections) {
    const title = section.title || 'Indicadores';
    ensureSpace(46);
    y = drawSectionHeading(page, title, y, semibold);
    if (!section.rows.length) {
      const height = 34;
      ensureSpace(height);
      page.drawRectangle({
        x: marginX,
        y: y - height + 7,
        width: contentWidth,
        height,
        color: palette.white,
      });
      page.drawText('Nenhum registro neste recorte.', {
        x: marginX + 12,
        y: y - 15,
        size: 9,
        color: palette.muted,
        font: regular,
      });
      y -= height + 7;
      continue;
    }

    for (const [label, value] of section.rows) {
      const isNote = !label;
      const labelLines = isNote ? [] : pdfLines(label, regular, 8.5, 235);
      const valueLines = value
        ? pdfLines(value, regular, 8.5, isNote ? contentWidth - 24 : 205)
        : [];
      const lineCount = Math.max(1, labelLines.length, valueLines.length);
      const rowHeight = Math.max(isNote ? 31 : 30, 12 + lineCount * 11);
      const previousPage = pageNumber;
      ensureSpace(rowHeight + 2);
      if (pageNumber !== previousPage) {
        y = drawSectionHeading(page, title, y, semibold);
        if (y - rowHeight - 2 < bottom) {
          addPage();
          y = drawSectionHeading(page, title, y, semibold);
        }
      }
      page.drawRectangle({
        x: marginX,
        y: y - rowHeight + 6,
        width: contentWidth,
        height: rowHeight,
        color: isNote ? palette.white : palette.row,
      });
      const baseline = y - 10;
      if (isNote) {
        for (const [index, line] of valueLines.entries()) {
          page.drawText(line, {
            x: marginX + 12,
            y: baseline - index * 11,
            size: 8.5,
            color: palette.muted,
            font: regular,
          });
        }
      } else {
        for (const [index, line] of labelLines.entries()) {
          page.drawText(line, {
            x: marginX + 10,
            y: baseline - index * 11,
            size: 8.5,
            color: palette.ink,
            font: regular,
          });
        }
        for (const [index, line] of valueLines.entries()) {
          page.drawText(line, {
            x: marginX + 265,
            y: baseline - index * 11,
            size: 8.5,
            color: palette.wine,
            font: semibold,
          });
        }
      }
      y -= rowHeight + 2;
    }
    y -= 13;
  }

  const pages = document.getPages();
  pages.forEach((current, index) => drawFooter(current, index + 1, pages.length, regular));
  return new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' });
}

function drawCover(
  page: PDFPage,
  regular: PDFFont,
  semibold: PDFFont,
  scope: string,
  date: string,
  metrics: readonly (readonly [string, string])[],
) {
  page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: palette.paper });
  page.drawRectangle({ x: 0, y: 761, width: pageSize[0], height: 81, color: palette.wine });
  page.drawText('CALI', { x: marginX, y: 803, size: 18, color: palette.white, font: semibold });
  page.drawText('WORKSPACE', {
    x: marginX,
    y: 787,
    size: 7,
    color: palette.gold,
    font: semibold,
  });
  page.drawText('VISÃO GERAL DA OPERAÇÃO', {
    x: pageSize[0] - marginX - 150,
    y: 798,
    size: 8,
    color: palette.white,
    font: semibold,
  });
  page.drawText(safeText(date, 100), {
    x: pageSize[0] - marginX - 150,
    y: 781,
    size: 8,
    color: palette.gold,
    font: regular,
  });
  page.drawRectangle({ x: marginX, y: 745, width: contentWidth, height: 2, color: palette.gold });
  page.drawText('Panorama do Workspace', {
    x: marginX,
    y: 710,
    size: 23,
    color: palette.ink,
    font: semibold,
  });
  const scopeLines = pdfLines(safeText(scope, 180), regular, 9, contentWidth);
  for (const [index, line] of scopeLines.slice(0, 2).entries()) {
    page.drawText(line, {
      x: marginX,
      y: 691 - index * 13,
      size: 9,
      color: palette.muted,
      font: regular,
    });
  }

  const top = 648;
  const gap = 8;
  const count = Math.max(metrics.length, 1);
  const columns = Math.min(count, 4);
  const width = (contentWidth - gap * (columns - 1)) / columns;
  const height = 62;
  metrics.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = marginX + column * (width + gap);
    const cardTop = top - row * (height + 8);
    const cardY = cardTop - height;
    page.drawRectangle({
      x,
      y: cardY,
      width,
      height,
      color: palette.white,
      borderColor: palette.line,
      borderWidth: 0.6,
    });
    page.drawRectangle({ x, y: cardY, width: 3, height, color: palette.wine });
    for (const [lineIndex, line] of pdfLines(label, regular, 7.5, width - 18)
      .slice(0, 2)
      .entries()) {
      page.drawText(line, {
        x: x + 12,
        y: cardTop - 16 - lineIndex * 9,
        size: 7.5,
        color: palette.muted,
        font: regular,
      });
    }
    for (const [lineIndex, line] of pdfLines(value || '—', semibold, 14, width - 18)
      .slice(0, 2)
      .entries()) {
      page.drawText(line, {
        x: x + 12,
        y: cardTop - 43 - lineIndex * 15,
        size: 14,
        color: palette.wine,
        font: semibold,
      });
    }
  });
  const rowCount = Math.ceil(metrics.length / columns);
  return top - rowCount * (height + 8) - 24;
}

function drawContinuation(
  page: PDFPage,
  regular: PDFFont,
  semibold: PDFFont,
  date: string,
  pageNumber: number,
) {
  page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: palette.paper });
  page.drawRectangle({ x: 0, y: 786, width: pageSize[0], height: 56, color: palette.wineDark });
  page.drawText('CALI · VISÃO GERAL DA OPERAÇÃO', {
    x: marginX,
    y: 813,
    size: 10,
    color: palette.white,
    font: semibold,
  });
  page.drawText(date, { x: marginX, y: 796, size: 8, color: palette.gold, font: regular });
  const pageLabel = `Página ${pageNumber}`;
  page.drawText(pageLabel, {
    x: pageSize[0] - marginX - semibold.widthOfTextAtSize(pageLabel, 7),
    y: 810,
    size: 7,
    color: palette.white,
    font: semibold,
  });
}

function drawSectionHeading(page: PDFPage, title: string, y: number, font: PDFFont) {
  const safeTitle = safeText(title, 120);
  page.drawText(safeTitle, { x: marginX, y: y - 19, size: 12, color: palette.ink, font });
  page.drawLine({
    start: { x: marginX, y: y - 27 },
    end: { x: marginX + contentWidth, y: y - 27 },
    thickness: 0.7,
    color: palette.line,
  });
  return y - 38;
}

function drawFooter(page: PDFPage, pageNumber: number, totalPages: number, font: PDFFont) {
  page.drawLine({
    start: { x: marginX, y: 39 },
    end: { x: marginX + contentWidth, y: 39 },
    thickness: 0.6,
    color: palette.line,
  });
  page.drawText('CALI Workspace · Dados operacionais do recorte selecionado', {
    x: marginX,
    y: 25,
    size: 7,
    color: palette.muted,
    font,
  });
  const pageLabel = `${pageNumber} / ${totalPages}`;
  page.drawText(pageLabel, {
    x: pageSize[0] - marginX - font.widthOfTextAtSize(pageLabel, 7),
    y: 25,
    size: 7,
    color: palette.wine,
    font,
  });
}
