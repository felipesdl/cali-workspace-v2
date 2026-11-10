import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  STYLE_CONTENT,
  combinationOf,
  profileName,
  type Style as SourceStyle,
} from './disc-content.ts';

export type DiscStyle = SourceStyle;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const DEFAULT_CREATED_AT = '2026-11-05T00:00:00.000Z';
const LEFT = 48;
const RIGHT = PAGE_WIDTH - LEFT;
const TOP = PAGE_HEIGHT - 103;
const BOTTOM = 67;
const BURGUNDY = rgb(0.353, 0.118, 0.176);
const GOLD = rgb(0.71, 0.549, 0.322);
const INK = rgb(0.169, 0.169, 0.169);
const MUTED = rgb(0.42, 0.38, 0.36);
const PAPER = rgb(0.984, 0.976, 0.961);
const RULE = rgb(0.89, 0.85, 0.81);
const STYLE_COLORS: Record<DiscStyle, ReturnType<typeof rgb>> = {
  D: rgb(0.7, 0.15, 0.12),
  I: rgb(0.54, 0.4, 0.0),
  S: rgb(0.12, 0.43, 0.31),
  C: rgb(0.13, 0.34, 0.57),
};
const STYLES: readonly DiscStyle[] = ['D', 'I', 'S', 'C'];

export type DiscScore = { raw: number; pct: number };
export type DiscScores = {
  natural: Record<DiscStyle, DiscScore>;
  natural6: Record<DiscStyle, DiscScore>;
  pressure: Record<DiscStyle, DiscScore>;
  adaptation: Record<DiscStyle, number>;
};

export type DiscManagementQuantitative = {
  secondary: Record<DiscStyle, number>;
  mixed: number;
  bands: Record<DiscStyle, { low: number; mid: number; high: number }>;
  pressure: {
    stable: number;
    one: number;
    many: number;
    up: Record<DiscStyle, number>;
    down: Record<DiscStyle, number>;
  };
};

export type DiscPdfInput = {
  audience: 'respondent' | 'evaluator' | 'management';
  title: string;
  organization: string;
  protocol: string;
  createdAt?: string;
  personName?: string;
  primary?: DiscStyle;
  secondary?: DiscStyle;
  mixed?: boolean;
  mode?: 'qualitative' | 'quantitative';
  sampleSize?: number | null;
  distribution?: Record<DiscStyle, number> | null;
  quantitative?: DiscManagementQuantitative | null;
  goal?: string;
  note?: string;
  moment?: string;
  sector?: string;
  qualitative?: { dominant: string; pressure: string };
  signer?: {
    full_name: string;
    job_title?: string | null;
    signature_mode?: string | null;
    signature_url?: string | null;
    signature_style?: string | null;
  } | null;
  avatar?: Uint8Array;
  signature?: Uint8Array;
  scores?: DiscScores;
};

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; title: PDFFont };

function safeText(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(value.normalize('NFC'), (character) => {
    if (character === '\n' || character === '\r') return '\n';
    if (character === '\t') return ' ';
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && supported.has(codePoint)) return character;
    if (character === '\u2013' || character === '\u2014' || character === '\u2212') return '-';
    if (character === '\u2018' || character === '\u2019') return "'";
    if (character === '\u201c' || character === '\u201d') return '"';
    return '?';
  }).join('');
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = safeText(value, font);
  const output: string[] = [];
  for (const paragraph of safe.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      output.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of Array.from(word)) {
        const next = fragment + character;
        if (fragment && font.widthOfTextAtSize(next, size) > maxWidth) {
          output.push(fragment);
          fragment = character;
        } else {
          fragment = next;
        }
      }
      line = fragment;
    }
    if (line) output.push(line);
  }
  return output;
}

class DiscPdfWriter {
  readonly document: PDFDocument;
  readonly fonts: Fonts;
  readonly protocol: string;
  private page!: PDFPage;
  private y = TOP;
  private pageNumber = 0;

  constructor(document: PDFDocument, fonts: Fonts, protocol: string) {
    this.document = document;
    this.fonts = fonts;
    this.protocol = protocol;
    this.newPage();
  }

  private newPage(): void {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageNumber += 1;
    this.y = TOP;
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PAPER });
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 68,
      width: PAGE_WIDTH,
      height: 68,
      color: BURGUNDY,
    });
    this.page.drawText('CALI RH', {
      x: LEFT,
      y: PAGE_HEIGHT - 35,
      size: 16,
      font: this.fonts.bold,
      color: rgb(1, 1, 1),
    });
    this.page.drawText('[TESTE V2] Homologação sintética', {
      x: LEFT,
      y: PAGE_HEIGHT - 53,
      size: 8,
      font: this.fonts.regular,
      color: rgb(0.95, 0.87, 0.71),
    });
    this.page.drawLine({
      start: { x: LEFT, y: 49 },
      end: { x: RIGHT, y: 49 },
      thickness: 0.7,
      color: RULE,
    });
    this.page.drawText('CALI RH · calirh.com', {
      x: LEFT,
      y: 33,
      size: 8,
      font: this.fonts.regular,
      color: MUTED,
    });
    this.page.drawText(
      this.protocol
        ? `Protocolo ${safeText(this.protocol, this.fonts.regular)}`
        : 'Homologação sintética',
      {
        x: LEFT + 184,
        y: 33,
        size: 8,
        font: this.fonts.regular,
        color: MUTED,
      },
    );
    this.page.drawText(`Página ${this.pageNumber}`, {
      x: RIGHT - 54,
      y: 33,
      size: 8,
      font: this.fonts.regular,
      color: MUTED,
    });
  }

  private ensureSpace(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  reserve(height: number): void {
    this.ensureSpace(height);
  }

  space(height: number): void {
    this.ensureSpace(height);
    this.y -= height;
  }

  text(
    value: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
    } = {},
  ): void {
    const font = options.font ?? this.fonts.regular;
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.42;
    const lines = wrapText(value, font, size, RIGHT - LEFT - indent);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      if (line) {
        this.page.drawText(line, {
          x: LEFT + indent,
          y: this.y - size,
          size,
          font,
          color: options.color ?? INK,
        });
      }
      this.y -= lineHeight;
    }
    this.y -= options.gap ?? 7;
  }

  heading(value: string, level: 'title' | 'section' = 'section'): void {
    const size = level === 'title' ? 23 : 13;
    const font = level === 'title' ? this.fonts.title : this.fonts.bold;
    this.ensureSpace(size * 2 + 12);
    this.text(value, { size, font, color: BURGUNDY, gap: level === 'title' ? 13 : 7 });
  }

  bullet(value: string): void {
    this.text(`• ${value}`, { indent: 5, gap: 3 });
  }

  label(value: string): void {
    this.text(value.toLocaleUpperCase('pt-BR'), {
      size: 8,
      font: this.fonts.bold,
      color: GOLD,
      gap: 4,
    });
  }

  bar(
    label: string,
    value: number,
    max: number,
    rightText: string,
    color: ReturnType<typeof rgb>,
  ): void {
    this.ensureSpace(36);
    const y = this.y - 11;
    this.page.drawText(safeText(label, this.fonts.bold), {
      x: LEFT,
      y,
      size: 9,
      font: this.fonts.bold,
      color: INK,
    });
    const valueWidth = this.fonts.regular.widthOfTextAtSize(rightText, 9);
    this.page.drawText(safeText(rightText, this.fonts.regular), {
      x: RIGHT - valueWidth,
      y,
      size: 9,
      font: this.fonts.regular,
      color: MUTED,
    });
    const barY = y - 11;
    const barWidth = RIGHT - LEFT;
    this.page.drawRectangle({ x: LEFT, y: barY, width: barWidth, height: 5, color: RULE });
    this.page.drawRectangle({
      x: LEFT,
      y: barY,
      width: barWidth * Math.max(0, Math.min(1, value / max)),
      height: 5,
      color,
    });
    this.y -= 34;
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  get currentY(): number {
    return this.y;
  }
}

function inTen(count: number, total: number): number {
  return Math.max(0, Math.min(10, Math.round((count / Math.max(1, total)) * 10)));
}

function validDistribution(input: DiscPdfInput, total: number): Record<DiscStyle, number> | null {
  const distribution = input.distribution;
  if (!distribution) return null;
  const values = STYLES.map((style) => distribution[style]);
  if (!values.every((value) => Number.isInteger(value) && value >= 0)) return null;
  if (values.reduce((sum, value) => sum + value, 0) !== total) return null;
  return distribution;
}

function validQuantitative(input: DiscPdfInput, total: number): DiscManagementQuantitative | null {
  const quantitative = input.quantitative;
  if (!quantitative) return null;
  const counts = (values: readonly number[], sum: number) =>
    values.every((value) => Number.isInteger(value) && value >= 0) &&
    values.reduce((result, value) => result + value, 0) === sum;
  const styles = STYLES;
  const secondary = styles.map((style) => quantitative.secondary[style]);
  const bands = styles.map((style) => quantitative.bands[style]);
  const up = styles.map((style) => quantitative.pressure.up[style]);
  const down = styles.map((style) => quantitative.pressure.down[style]);
  if (
    !counts(secondary, total) ||
    !Number.isInteger(quantitative.mixed) ||
    quantitative.mixed < 0 ||
    quantitative.mixed > total ||
    !bands.every((band) => band && counts([band.low, band.mid, band.high], total)) ||
    !counts(
      [quantitative.pressure.stable, quantitative.pressure.one, quantitative.pressure.many],
      total,
    ) ||
    !up.every((value) => Number.isInteger(value) && value >= 0 && value <= total) ||
    !down.every((value) => Number.isInteger(value) && value >= 0 && value <= total)
  )
    return null;
  return quantitative;
}

function withoutNumericSentences(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !/[0-9%]/.test(sentence));
}

async function drawProvidedImage(
  document: PDFDocument,
  page: PDFPage,
  bytes: Uint8Array | undefined,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
): Promise<void> {
  if (!bytes || bytes.length < 4) return;
  try {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpeg) return;
    const image = isPng ? await document.embedPng(bytes) : await document.embedJpg(bytes);
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x, y, width, height });
  } catch {
    // Missing/invalid image bytes never trigger a renderer-side fetch or fail the PDF.
  }
}

async function drawSignature(writer: DiscPdfWriter, input: DiscPdfInput): Promise<void> {
  const signer = input.signer;
  if (!signer?.full_name) return;
  writer.reserve(130);
  writer.heading('Assinatura responsável', 'section');
  writer.text(signer.full_name, { size: 10, font: writer.fonts.bold, gap: 2 });
  writer.text(`${signer.job_title?.trim() || 'Responsável técnica'} · CALI RH`, {
    size: 9,
    color: MUTED,
    gap: 2,
  });
  if (!input.signature)
    writer.text('Assinatura registrada para esta revisão.', {
      size: 8,
      font: writer.fonts.italic,
      color: MUTED,
      gap: 4,
    });
  if (input.avatar || input.signature) {
    writer.reserve(54);
    const page = writer.currentPage;
    const imageTop = writer.currentY;
    await drawProvidedImage(writer.document, page, input.avatar, LEFT, imageTop - 42, 42, 42);
    await drawProvidedImage(
      writer.document,
      page,
      input.signature,
      input.avatar ? LEFT + 54 : LEFT,
      imageTop - 33,
      122,
      33,
    );
    writer.space(54);
  }
}

function drawCover(writer: DiscPdfWriter, input: DiscPdfInput, subtitle: string): void {
  writer.heading(input.title || 'Perfil Comportamental', 'title');
  writer.text(subtitle, { size: 12, color: MUTED, gap: 14 });
  if (input.organization)
    writer.text(input.organization, { size: 14, font: writer.fonts.bold, color: BURGUNDY });
}

function drawRespondent(writer: DiscPdfWriter, input: DiscPdfInput): void {
  if (!input.primary) {
    writer.heading('Seu relatório ainda não está disponível', 'title');
    writer.text(
      'Não foi possível preparar a leitura individual. Fale com a CALI RH para receber orientação.',
    );
    return;
  }
  const primary = STYLE_CONTENT[input.primary];
  const secondary = input.secondary ? STYLE_CONTENT[input.secondary] : null;
  drawCover(writer, input, 'Seu Perfil Comportamental');
  if (input.personName)
    writer.text(input.personName, { size: 16, font: writer.fonts.bold, color: INK, gap: 4 });
  writer.label('Seu jeito de trabalhar');
  const combination = input.secondary ? combinationOf(input.primary, input.secondary) : null;
  writer.heading(
    profileName(input.primary, input.secondary ?? input.primary, Boolean(input.mixed)),
    'title',
  );
  if (combination) writer.text(combination.text, { size: 11, gap: 10 });
  writer.text(primary.respondent.summary, { size: 12, gap: 12 });
  if (secondary)
    writer.text(
      `O estilo ${secondary.name} também aparece na sua forma de agir. ${secondary.respondent.summary}`,
      {
        size: 10,
        color: MUTED,
      },
    );
  if (input.mixed)
    writer.text('Você pode reconhecer traços importantes dos dois estilos descritos.', {
      size: 10,
      font: writer.fonts.italic,
      color: MUTED,
    });
  writer.heading('O que você traz');
  primary.respondent.strengths.forEach((strength) =>
    writer.bullet(`${strength.title}: ${strength.example}`),
  );
  writer.text(primary.respondent.perceived, { size: 10, color: MUTED });
  writer.heading('Um ponto de atenção');
  writer.text(primary.respondent.cost);
  writer.heading('Como você decide, comunica e reage');
  writer.bullet(primary.respondent.decides);
  writer.bullet(primary.respondent.communicates);
  writer.bullet(primary.respondent.reacts);
  writer.heading('Experimente');
  primary.respondent.plan.forEach((step) => {
    writer.text(step.scenario, { size: 10, font: writer.fonts.bold, color: BURGUNDY, gap: 2 });
    writer.bullet(step.action);
    writer.text(step.question, { size: 9, font: writer.fonts.italic, color: MUTED, indent: 10 });
  });
  writer.text(`O que pode dar energia: ${primary.respondent.energy.join('; ')}.`, {
    size: 9,
    color: MUTED,
  });
  writer.text(`O que pode desgastar: ${primary.respondent.drains.join('; ')}.`, {
    size: 9,
    color: MUTED,
  });
  writer.text('Este relatório descreve preferências de trabalho; não define quem você é.', {
    size: 9,
    font: writer.fonts.italic,
    color: MUTED,
  });
}

function drawEvaluator(writer: DiscPdfWriter, input: DiscPdfInput): void {
  if (!input.primary) {
    writer.heading('Relatório técnico indisponível', 'title');
    writer.text('O perfil predominante não foi informado.');
    return;
  }
  const primary = STYLE_CONTENT[input.primary];
  const secondary = input.secondary ? STYLE_CONTENT[input.secondary] : null;
  const combination = input.secondary ? combinationOf(input.primary, input.secondary) : null;
  drawCover(writer, input, 'Relatório do avaliador · uso interno CALI');
  if (input.personName)
    writer.text(input.personName, { size: 16, font: writer.fonts.bold, color: BURGUNDY, gap: 5 });
  writer.text(profileName(input.primary, input.secondary ?? input.primary, Boolean(input.mixed)), {
    size: 12,
    font: writer.fonts.bold,
  });
  if (combination) writer.text(combination.text);
  writer.heading('Síntese para leitura interna');
  writer.text(primary.evaluator.synthesis);
  if (secondary) writer.text(secondary.evaluator.synthesis, { size: 10, color: MUTED });
  writer.heading('A função tende a favorecer');
  primary.evaluator.roleFavors.forEach((item) => writer.bullet(item));
  writer.heading('Pontos que pedem apoio');
  primary.evaluator.roleNeedsSupport.forEach((item) => writer.bullet(item));
  writer.heading('Riscos com sinais precoces');
  primary.evaluator.risks.forEach((item) => writer.bullet(`${item.risk} Sinal: ${item.signal}`));
  writer.heading('Perguntas para a conversa');
  primary.evaluator.ceo.forEach((item) => {
    writer.text(item.reflection, { size: 10, font: writer.fonts.italic, color: MUTED, gap: 2 });
    writer.bullet(item.ask);
  });

  if (input.scores) {
    writer.heading('Faixas de intensidade');
    writer.text(
      'Valores individuais de uso interno. Dia comum considera margem de leitura de 10 pontos; semana difícil, 18 pontos.',
      { size: 9, color: MUTED },
    );
    for (const style of STYLES) {
      const natural = input.scores.natural[style];
      const pressure = input.scores.pressure[style];
      const adaptation = input.scores.adaptation[style];
      if (
        ![natural.raw, natural.pct, pressure.raw, pressure.pct, adaptation].every(Number.isFinite)
      )
        continue;
      const shortName = STYLE_CONTENT[style].name;
      writer.bar(
        `${shortName} · dia comum`,
        natural.pct,
        100,
        `${Math.round(natural.pct)}%`,
        STYLE_COLORS[style],
      );
      writer.bar(
        `${shortName} · semana difícil`,
        pressure.pct,
        100,
        `${Math.round(pressure.pct)}%`,
        STYLE_COLORS[style],
      );
    }
    writer.heading('Adaptação sob pressão');
    for (const style of STYLES) {
      const change = input.scores.adaptation[style];
      if (!Number.isFinite(change)) continue;
      if (Math.abs(change) < 25) continue;
      writer.bullet(
        `${STYLE_CONTENT[style].name}: ${change > 0 ? STYLE_CONTENT[style].pressureUp : STYLE_CONTENT[style].pressureDown}`,
      );
    }
    writer.text(
      'A leitura de adaptação considera mudança acima de 25 pontos nos mesmos blocos. Não use escores como comparação entre pessoas.',
      { size: 9, font: writer.fonts.italic, color: MUTED },
    );
  }
  writer.heading('Perguntas para a conversa');
  writer.bullet('Em que parte desta leitura a pessoa se reconhece e em qual não?');
  writer.bullet('Que exemplo recente confirma ou contradiz esta hipótese?');
  writer.bullet('Que apoio ou ajuste de trabalho pode ser combinado?');
  writer.text(
    'Este relatório não prevê desempenho, aptidão ou resultado profissional. Decisões de trabalho exigem evidências próprias.',
    { size: 9, color: MUTED },
  );
}

function drawManagement(writer: DiscPdfWriter, input: DiscPdfInput): void {
  const sampleSize = input.sampleSize;
  const noSampleSize = sampleSize === null || sampleSize === undefined;
  if (
    (noSampleSize && input.mode !== 'qualitative') ||
    (!noSampleSize && (!Number.isInteger(sampleSize) || sampleSize < 5))
  ) {
    writer.heading('Leitura de gestão ainda indisponível', 'title');
    writer.text(
      'Ainda não há respostas suficientes para uma leitura coletiva protegida. Nenhum resultado individual é exibido.',
    );
    return;
  }

  drawCover(writer, input, 'Relatório de gestão · leitura do grupo');
  if (input.moment) writer.text(`Momento da empresa: ${input.moment}`, { size: 10, color: MUTED });
  if (input.sector) writer.text(`Setor: ${input.sector}`, { size: 10, color: MUTED });
  for (const sentence of withoutNumericSentences(input.goal))
    writer.text(`Resultado que a empresa persegue: ${sentence}`, {
      size: 10,
      font: writer.fonts.italic,
      color: MUTED,
    });

  if (noSampleSize || sampleSize < 15) {
    writer.heading('Leitura qualitativa');
    const dominant =
      input.qualitative?.dominant ||
      'A equipe combina preferências diferentes e precisa explicitar como decide, registra e acompanha o trabalho.';
    const pressure =
      input.qualitative?.pressure ||
      'Em semanas difíceis, vale observar mudanças no ritmo, na comunicação e na qualidade dos combinados.';
    for (const sentence of withoutNumericSentences(dominant)) writer.text(sentence);
    for (const sentence of withoutNumericSentences(pressure)) writer.text(sentence);
  } else {
    const distribution = validDistribution(input, sampleSize);
    if (!distribution) {
      writer.heading('Distribuição agregada indisponível');
      writer.text(
        'Os dados de grupo não fecharam a conferência de consistência. Nenhum perfil individual é exibido.',
      );
    } else {
      writer.heading('Distribuição agregada');
      writer.text(
        'Visualização consolidada por estilo predominante, apresentada em faixas de cada dez respostas.',
        { size: 9, color: MUTED },
      );
      for (const style of STYLES) {
        writer.bar(
          STYLE_CONTENT[style].name,
          distribution[style],
          sampleSize,
          `${inTen(distribution[style], sampleSize)} em 10`,
          STYLE_COLORS[style],
        );
      }
      const quantitative = validQuantitative(input, sampleSize);
      if (!quantitative) {
        writer.heading('Detalhamento agregado indisponível');
        writer.text('Os recortes complementares não fecharam a conferência de consistência.');
      } else {
        writer.heading('Estilo secundário');
        for (const style of STYLES) {
          writer.bar(
            STYLE_CONTENT[style].name,
            quantitative.secondary[style],
            sampleSize,
            `${inTen(quantitative.secondary[style], sampleSize)} em 10`,
            STYLE_COLORS[style],
          );
        }
        writer.heading('Perfis mistos');
        writer.bar(
          'Leituras com dois estilos próximos',
          quantitative.mixed,
          sampleSize,
          `${inTen(quantitative.mixed, sampleSize)} em 10`,
          GOLD,
        );
        writer.heading('Faixas de intensidade natural');
        for (const style of STYLES) {
          const band = quantitative.bands[style];
          writer.text(
            `${STYLE_CONTENT[style].name} · baixa ${inTen(band.low, sampleSize)} em 10 · intermediária ${inTen(band.mid, sampleSize)} em 10 · alta ${inTen(band.high, sampleSize)} em 10`,
            { size: 9, gap: 3 },
          );
        }
        writer.reserve(145);
        writer.heading('Mudança de atuação sob pressão');
        for (const [label, count] of [
          ['Mantém o padrão', quantitative.pressure.stable],
          ['Ajusta um estilo', quantitative.pressure.one],
          ['Ajusta vários estilos', quantitative.pressure.many],
        ] as const) {
          writer.bar(label, count, sampleSize, `${inTen(count, sampleSize)} em 10`, BURGUNDY);
        }
        writer.heading('Mudanças por estilo sob pressão');
        for (const style of STYLES) {
          writer.text(
            `${STYLE_CONTENT[style].name} · aumenta ${inTen(quantitative.pressure.up[style], sampleSize)} em 10 · reduz ${inTen(quantitative.pressure.down[style], sampleSize)} em 10`,
            { size: 9, gap: 3 },
          );
        }
      }
    }
  }

  for (const sentence of withoutNumericSentences(input.note)) {
    writer.heading('Parecer da CALI');
    writer.text(sentence);
  }
  writer.text(
    'Este documento descreve tendências do grupo. Não lista respondentes nem substitui evidências de trabalho.',
    { size: 9, font: writer.fonts.italic, color: MUTED },
  );
}

export async function createDiscPdf(input: DiscPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create({ updateMetadata: false });
  const parsedDate = new Date(input.createdAt ?? DEFAULT_CREATED_AT);
  const createdAt = Number.isFinite(parsedDate.getTime())
    ? parsedDate
    : new Date(DEFAULT_CREATED_AT);
  document.setCreationDate(createdAt);
  document.setModificationDate(createdAt);
  document.setCreator('CALI RH · Homologação sintética');
  document.setProducer('CALI RH · PDF-lib 1.17.1');
  const [regular, bold, italic, title] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
    document.embedFont(StandardFonts.TimesRomanItalic),
    document.embedFont(StandardFonts.TimesRomanBold),
  ]);
  const writer = new DiscPdfWriter(document, { regular, bold, italic, title }, input.protocol);
  if (input.audience === 'respondent') drawRespondent(writer, input);
  else if (input.audience === 'evaluator') drawEvaluator(writer, input);
  else drawManagement(writer, input);
  await drawSignature(writer, input);
  return document.save();
}
