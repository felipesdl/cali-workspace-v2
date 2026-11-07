import fontkit from '@pdf-lib/fontkit';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff?inline';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff?inline';
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff?inline';
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { z } from 'zod';
import {
  reportCurationSchema,
  reportCurationSections,
} from '../../../src/api/modules/project-workspace/report-curation';
import {
  executiveMetricRows,
  reportMetricsSchema,
} from '../../../src/api/modules/project-workspace/report-metrics';

export const reportInputSchema = z.object({
  title: z.string().min(1).max(180),
  companyName: z.string().min(1).max(250),
  protocol: z.string().regex(/^CALI-EXEC-\d{4}-\d{6}$/),
  version: z.number().int().positive(),
  approvedAt: z.iso.datetime({ offset: true }),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  summary: z.string().min(1).max(8000),
  curation: reportCurationSchema.optional(),
  source: reportMetricsSchema.extend({
    workflow_mode: z.literal('official').optional(),
  }),
  signer: z.object({
    full_name: z.string().trim().min(1).max(180),
    job_title: z.string().max(180).nullable(),
    avatar_url: z.url(),
    signature_url: z.url().nullable(),
    signature_mode: z.string().nullable(),
  }),
});
export type ReportPdfInput = z.infer<typeof reportInputSchema>;

const left = 48;
const [width, height] = PageSizes.A4;
const contentWidth = width - left * 2;
const burgundy = rgb(0.35, 0.12, 0.18);
const ink = rgb(0.19, 0.15, 0.14);
const pale = rgb(0.95, 0.92, 0.89);
const brDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });

function dateOnly(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth = contentWidth) {
  const supported = new Set(font.getCharacterSet());
  const clean = [...text.normalize('NFC')]
    .map((char) => (char === '\n' || supported.has(char.codePointAt(0) ?? 0) ? char : ' '))
    .join('');
  return clean.split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    return [...lines, line];
  });
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array) {
  return bytes[0] === 0xff ? doc.embedJpg(bytes) : doc.embedPng(bytes);
}

function drawFitted(
  page: PDFPage,
  image: PDFImage,
  x: number,
  top: number,
  maxWidth: number,
  maxHeight: number,
) {
  const size = image.scaleToFit(maxWidth, maxHeight);
  page.drawImage(image, { x, y: top - size.height, ...size });
}

export async function renderExecutivePdf(
  input: ReportPdfInput,
  photo: Uint8Array,
  signature?: Uint8Array,
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, bold, italic, avatar, drawnSignature] = await Promise.all([
    doc.embedFont(interRegular, { subset: true }),
    doc.embedFont(interBold, { subset: true }),
    doc.embedFont(interItalic, { subset: true }),
    embedImage(doc, photo),
    signature ? embedImage(doc, signature) : undefined,
  ]);
  doc.setTitle(input.title);
  doc.setAuthor('CALI RH');
  doc.setSubject(input.protocol);
  const newPage = () => {
    const page = doc.addPage(PageSizes.A4);
    page.drawRectangle({ x: 0, y: height - 9, width, height: 9, color: burgundy });
    page.drawText('CALI WORKSPACE', {
      x: left,
      y: height - 44,
      size: 11,
      font: bold,
      color: burgundy,
    });
    return page;
  };
  let page = newPage();
  let y = height - 82;
  function reserve(heightNeeded: number) {
    if (y - heightNeeded >= 66) return;
    page = newPage();
    y = height - 82;
  }
  function lines(value: string, font: PDFFont = regular, size = 11, gap = 7) {
    const lineHeight = size * 1.45;
    for (const line of wrap(value, font, size)) {
      reserve(lineHeight);
      if (line) page.drawText(line, { x: left, y, size, font, color: ink });
      y -= lineHeight;
    }
    y -= gap;
  }
  lines('RELATÓRIO EXECUTIVO MENSAL', bold, 10, 8);
  lines(input.title, bold, 23);
  lines(input.companyName, bold, 13);
  lines(`${dateOnly(input.periodStart)} a ${dateOnly(input.periodEnd)} · Revisão ${input.version}`);
  reserve(44);
  lines('Resumo executivo', bold, 15);
  lines(input.summary);
  for (const { key, label } of reportCurationSections) {
    const section = input.curation?.[key];
    if (!section) continue;
    reserve(44);
    lines(label, bold, 15);
    lines(section);
  }
  reserve(44);
  lines('Indicadores do período', bold, 15);
  for (const { label, value } of executiveMetricRows(input.source)) lines(`${label}: ${value}`);
  reserve(170);
  page.drawLine({ start: { x: left, y }, end: { x: width - left, y }, color: pale, thickness: 1 });
  y -= 26;
  lines('Assinatura virtual', bold, 14, 5);
  if (drawnSignature) drawFitted(page, drawnSignature, left + 65, y, 150, 38);
  else {
    wrap(input.signer.full_name, italic, 13, contentWidth - 65)
      .slice(0, 3)
      .forEach((line, index) => {
        page.drawText(line, {
          x: left + 65,
          y: y - 15 - index * 15,
          size: 13,
          font: italic,
          color: burgundy,
        });
      });
  }
  drawFitted(page, avatar, left, y, 50, 50);
  y -= 66;
  lines(input.signer.full_name, bold, 11, 0);
  if (input.signer.job_title) lines(input.signer.job_title, regular, 10, 0);
  lines(`Aprovação interna: ${brDate.format(new Date(input.approvedAt))}`, regular, 9);
  const pages = doc.getPages();
  for (const [index, current] of pages.entries()) {
    current.drawText(
      `${input.protocol} · Revisão ${input.version} · ${index + 1}/${pages.length}`,
      { x: left, y: 39, size: 9, color: burgundy, font: regular },
    );
  }
  const bytes = await doc.save();
  if (bytes.length > 2_097_152) throw new Error('PDF acima do limite de 2 MiB.');
  return bytes;
}
