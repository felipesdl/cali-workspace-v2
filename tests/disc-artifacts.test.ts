// @vitest-environment node
import { PDFDocument, PDFPage } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { renderDiscEmail } from '../supabase/functions/_shared/disc-email';
import { normalizeDiscImage } from '../supabase/functions/_shared/disc-image';
import {
  createDiscPdf,
  type DiscPdfInput,
  type DiscScores,
} from '../supabase/functions/_shared/disc-pdf';

const scores: DiscScores = {
  natural: {
    D: { raw: 8, pct: 72 },
    I: { raw: 4, pct: 61 },
    S: { raw: -5, pct: 36 },
    C: { raw: -7, pct: 31 },
  },
  natural6: {
    D: { raw: 2, pct: 67 },
    I: { raw: 1, pct: 58 },
    S: { raw: -1, pct: 42 },
    C: { raw: -2, pct: 33 },
  },
  pressure: {
    D: { raw: 4, pct: 83 },
    I: { raw: 1, pct: 58 },
    S: { raw: -2, pct: 33 },
    C: { raw: -3, pct: 25 },
  },
  adaptation: { D: 25, I: 0, S: -8, C: -17 },
};

async function capturePdf(input: DiscPdfInput): Promise<{ bytes: Uint8Array; text: string }> {
  const parts: string[] = [];
  const original = PDFPage.prototype.drawText;
  const spy = vi.spyOn(PDFPage.prototype, 'drawText');
  spy.mockImplementation(function (this: PDFPage, text, options) {
    parts.push(text);
    return original.call(this, text, options);
  });
  try {
    const bytes = await createDiscPdf(input);
    return { bytes, text: parts.join('\n') };
  } finally {
    spy.mockRestore();
  }
}

function baseInput(audience: DiscPdfInput['audience']): DiscPdfInput {
  return {
    audience,
    title: 'Leitura do grupo',
    organization: 'Empresa sintética',
    protocol: 'CALI-GESTAO-2026-000001',
    primary: 'D',
    secondary: 'I',
    mixed: false,
  };
}

describe('artefatos DISC de homologação', () => {
  it('preserva área da foto sem sobrepor nome, cargo ou registro de assinatura', async () => {
    const avatar = new Uint8Array(
      await readFile(new URL('./fixtures/disc-signature-photo.png', import.meta.url)),
    );
    const images: Array<{ page: PDFPage; x: number; y: number; width: number; height: number }> =
      [];
    const lines: Array<{ page: PDFPage; text: string; x: number; y: number; size: number }> = [];
    const drawImage = PDFPage.prototype.drawImage;
    const drawText = PDFPage.prototype.drawText;
    const imageSpy = vi.spyOn(PDFPage.prototype, 'drawImage').mockImplementation(function (
      this: PDFPage,
      image,
      options,
    ) {
      images.push({
        page: this,
        x: options?.x ?? 0,
        y: options?.y ?? 0,
        width: options?.width ?? image.width,
        height: options?.height ?? image.height,
      });
      return drawImage.call(this, image, options);
    });
    const textSpy = vi.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
      this: PDFPage,
      text,
      options,
    ) {
      lines.push({
        page: this,
        text,
        x: options?.x ?? 0,
        y: options?.y ?? 0,
        size: options?.size ?? 11,
      });
      return drawText.call(this, text, options);
    });
    try {
      await createDiscPdf({
        ...baseInput('management'),
        mode: 'qualitative',
        sampleSize: null,
        avatar,
        signer: { full_name: 'Responsável sintética', job_title: 'Cargo sintético' },
      });
      expect(images).toHaveLength(1);
      const photo = images[0];
      const signatureLines = lines.filter((line) =>
        /Responsável sintética|Cargo sintético|registrada para esta revisão/.test(line.text),
      );
      expect(signatureLines).toHaveLength(3);
      for (const line of signatureLines) {
        if (line.page !== photo.page || line.x >= photo.x + photo.width) continue;
        expect(
          photo.y + photo.height <= line.y - line.size * 0.3 || photo.y >= line.y + line.size,
        ).toBe(true);
      }
      expect(photo.y).toBeGreaterThan(67);
    } finally {
      imageSpy.mockRestore();
      textSpy.mockRestore();
    }
  });

  it('converte fixture WebP sintética em PNG com dimensões válidas', async () => {
    const webp = new Uint8Array(
      await readFile(new URL('./fixtures/disc-synthetic.webp', import.meta.url)),
    );
    const png = await normalizeDiscImage(webp, 'image/webp');
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(8);
    expect(view.getUint32(20)).toBe(6);
    await expect(
      PDFDocument.create().then((document) => document.embedPng(png)),
    ).resolves.toBeDefined();
  });

  it('converte WebP lossless sintético', async () => {
    const webp = new Uint8Array(
      await readFile(new URL('./fixtures/disc-synthetic-lossless.webp', import.meta.url)),
    );
    const png = await normalizeDiscImage(webp, 'image/webp');
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(view.getUint32(16)).toBe(8);
    expect(view.getUint32(20)).toBe(6);
  });

  it('recusa WebP acima do limite de pixels antes de decodificar', async () => {
    const webp = new Uint8Array(
      await readFile(new URL('./fixtures/disc-synthetic.webp', import.meta.url)),
    );
    webp[26] = 0xa0;
    webp[27] = 0x0f;
    webp[28] = 0xd0;
    webp[29] = 0x07;
    await expect(normalizeDiscImage(webp, 'image/webp')).rejects.toThrow(/pixels/);
  });

  it('gera PDF de respondente com texto próprio, sem método, escore ou faixa', async () => {
    const input: DiscPdfInput = {
      ...baseInput('respondent'),
      personName: 'Pessoa sintética',
      primary: 'D',
      secondary: 'I',
      scores,
    };
    const result = await capturePdf(input);
    const document = await PDFDocument.load(result.bytes);
    expect(new TextDecoder().decode(result.bytes.slice(0, 8))).toContain('%PDF-');
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(result.text).toContain('[TESTE V2] Homologação sintética');
    expect(result.text).toContain('Pessoa sintética');
    expect(result.text).toContain('No dia a dia, você tende a ir direto ao ponto');
    expect(result.text).not.toMatch(/método|margem|escore|percentual|blocos|72%|83%/i);
  });

  it('gera bytes estáveis em retry com mesmo conteúdo e data de criação', async () => {
    const input: DiscPdfInput = {
      ...baseInput('respondent'),
      createdAt: '2026-11-05T12:00:00.000Z',
      personName: 'Pessoa sintética',
      primary: 'D',
    };
    const first = await createDiscPdf(input);
    const second = await createDiscPdf(input);
    expect(second).toEqual(first);
    const document = await PDFDocument.load(first, { updateMetadata: false });
    expect(document.getCreationDate()?.toISOString()).toBe('2026-11-05T12:00:00.000Z');
    expect(document.getModificationDate()?.toISOString()).toBe('2026-11-05T12:00:00.000Z');
  });

  it('esconde amostra, distribuição e identidade individual em gestão qualitativa de 14 respostas', async () => {
    const input: DiscPdfInput = {
      ...baseInput('management'),
      personName: 'RESPONDENTE_NAO_EXIBIR',
      sampleSize: 14,
      mode: 'qualitative',
      distribution: { D: 8, I: 3, S: 2, C: 1 },
      quantitative: {
        secondary: { D: 8, I: 3, S: 2, C: 1 },
        mixed: 8,
        bands: {
          D: { low: 8, mid: 3, high: 3 },
          I: { low: 3, mid: 8, high: 3 },
          S: { low: 2, mid: 3, high: 9 },
          C: { low: 1, mid: 4, high: 9 },
        },
        pressure: {
          stable: 6,
          one: 5,
          many: 3,
          up: { D: 8, I: 3, S: 2, C: 1 },
          down: { D: 1, I: 2, S: 3, C: 8 },
        },
      },
      qualitative: {
        dominant: 'O grupo tende a decidir com rapidez.',
        pressure: 'Sob pressão, vale combinar prioridades.',
      },
      goal: 'Abrir mais 12 unidades',
      note: 'O grupo tem oportunidade de fortalecer os combinados.',
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Leitura qualitativa');
    expect(result.text).toContain('O grupo tende a decidir com rapidez.');
    expect(result.text).not.toContain('RESPONDENTE_NAO_EXIBIR');
    expect(result.text).not.toContain('14');
    expect(result.text).not.toContain('8 em 10');
    expect(result.text).not.toMatch(/\d+ em 10/);
    expect(result.text).not.toContain('Estilo secundário');
    expect(result.text).not.toContain('Faixas de intensidade natural');
    expect(result.text).not.toContain('Mudança de atuação sob pressão');
    expect(result.text).not.toContain('Abrir mais 12 unidades');
  });

  it('libera leitura qualitativa em cinco respostas, sem contagem por estilo', async () => {
    const input: DiscPdfInput = {
      ...baseInput('management'),
      sampleSize: 5,
      mode: 'qualitative',
      distribution: { D: 5, I: 0, S: 0, C: 0 },
      qualitative: {
        dominant: 'A equipe precisa combinar quem decide e quem confere a qualidade.',
        pressure: 'Em semanas difíceis, explicite prioridade e responsabilidade.',
      },
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Leitura qualitativa');
    expect(result.text).toContain('quem decide e quem confere a qualidade');
    expect(result.text).not.toContain('5 respostas');
    expect(result.text).not.toContain('5 em 10');
    expect(result.text).not.toContain('Executor');
  });

  it('preserva leitura qualitativa quando a API omite a contagem protegida', async () => {
    const input: DiscPdfInput = {
      ...baseInput('management'),
      sampleSize: null,
      mode: 'qualitative',
      qualitative: {
        dominant: 'O grupo tende a equilibrar decisão e colaboração.',
        pressure: 'Sob pressão, vale explicitar prioridades e responsabilidades.',
      },
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Leitura qualitativa');
    expect(result.text).toContain('O grupo tende a equilibrar decisão e colaboração.');
    expect(result.text).not.toMatch(/\d+ respostas|\d+ em 10|%/);
  });

  it('não revela dados quando gestão tem menos de cinco respostas', async () => {
    const input: DiscPdfInput = {
      ...baseInput('management'),
      sampleSize: 4,
      mode: 'qualitative',
      distribution: { D: 2, I: 1, S: 1, C: 0 },
      qualitative: {
        dominant: 'Duas pessoas preferem decidir.',
        pressure: 'Uma pessoa muda sob pressão.',
      },
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Leitura de gestão ainda indisponível');
    expect(result.text).not.toContain('Duas pessoas preferem decidir');
    expect(result.text).not.toContain('Uma pessoa muda sob pressão');
    expect(result.text).not.toContain('2 em 10');
  });

  it('exibe somente distribuição agregada a partir de 15 respostas', async () => {
    const input: DiscPdfInput = {
      ...baseInput('management'),
      personName: 'RESPONDENTE_NAO_EXIBIR',
      sampleSize: 15,
      mode: 'quantitative',
      distribution: { D: 6, I: 4, S: 3, C: 2 },
      quantitative: {
        secondary: { D: 2, I: 5, S: 3, C: 5 },
        mixed: 4,
        bands: {
          D: { low: 2, mid: 5, high: 8 },
          I: { low: 4, mid: 6, high: 5 },
          S: { low: 3, mid: 8, high: 4 },
          C: { low: 7, mid: 5, high: 3 },
        },
        pressure: {
          stable: 6,
          one: 7,
          many: 2,
          up: { D: 3, I: 4, S: 1, C: 0 },
          down: { D: 0, I: 1, S: 4, C: 3 },
        },
      },
      qualitative: {
        dominant: 'Narrativa não deve substituir distribuição.',
        pressure: 'Narrativa reservada.',
      },
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Distribuição agregada');
    expect(result.text).toContain('Estilo secundário');
    expect(result.text).toContain('Perfis mistos');
    expect(result.text).toContain('Faixas de intensidade natural');
    expect(result.text).toContain('Mudança de atuação sob pressão');
    expect(result.text).toContain('Mudanças por estilo sob pressão');
    expect(result.text).toContain('aumenta 2 em 10');
    expect(result.text).toContain('reduz 0 em 10');
    expect(result.text).toContain('4 em 10');
    expect(result.text).not.toContain('RESPONDENTE_NAO_EXIBIR');
    expect(result.text).not.toContain('Narrativa não deve substituir distribuição.');
    expect(result.text).not.toContain('15 pessoas');
  });

  it('mantém dados técnicos só no PDF interno do avaliador', async () => {
    const input: DiscPdfInput = {
      ...baseInput('evaluator'),
      personName: 'Pessoa avaliadora sintética',
      scores,
    };
    const result = await capturePdf(input);
    expect(result.text).toContain('Pessoa avaliadora sintética');
    expect(result.text).toContain('Faixas de intensidade');
    expect(result.text).toContain('72%');
    expect(result.text).toContain('Este relatório não prevê desempenho');
  });

  it('escapa valores HTML, restringe links e não injeta resultados em mensagens', () => {
    const email = renderDiscEmail({
      kind: 'invite',
      title: '<script>alert(1)</script>',
      name: '<img src=x onerror=alert(1)>',
      url: 'javascript:alert(1)',
      message: 'Resultado individual: estilo D 100%',
    });
    const readyEmail = renderDiscEmail({
      kind: 'respondent_pdf',
      title: 'Perfil sintético',
      name: 'Pessoa sintética',
      url: 'http://127.0.0.1:5181/perfil/resultado/synthetic-token',
      message: 'Resultado individual: estilo D 100%',
    });
    expect(email.subject).toContain('[TESTE V2]');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('javascript:');
    expect(email.html).not.toContain('Resultado individual');
    expect(readyEmail.html).not.toContain('Resultado individual');
    expect(readyEmail.html).not.toContain('synthetic-token');
    expect(readyEmail.text).not.toContain('100%');
  });

  it('renderiza link CALI seguro e mensagens de gestão sem resultado individual', () => {
    const email = renderDiscEmail({
      kind: 'gestao_released',
      title: 'Empresa sintética',
      name: 'Gestor sintético',
      url: 'http://127.0.0.1:5182/cliente/perfil-comportamental/gestao/synthetic',
    });
    expect(email.html).toContain(
      'http://127.0.0.1:5182/cliente/perfil-comportamental/gestao/synthetic',
    );
    expect(email.text).toContain('relatório de gestão da empresa');
    expect(email.html).not.toMatch(/perfil predominante|escore|percentual/i);
    const blocked = renderDiscEmail({
      kind: 'released',
      title: 'Empresa sintética',
      url: 'https://app.calirh.com/cliente/gestao/synthetic',
    });
    expect(blocked.html).not.toContain('https://app.calirh.com/cliente/gestao/synthetic');
    expect(blocked.html).not.toContain('<a href=');
    expect(renderDiscEmail({ kind: 'close', title: 'Convite sintético' }).text).toContain(
      'Prazo encerrado',
    );
  });
});
