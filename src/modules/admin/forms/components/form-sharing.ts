import QRCode from 'qrcode';

export function qrDataUrl(url: string, size = 480) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#2B1A20', light: '#FFFFFF' },
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

/** Pinta uma marca SVG (que usa currentColor) com uma cor ou degradê, num canvas à parte. */
async function tintedMark(
  src: string,
  size: number,
  paint: (context: CanvasRenderingContext2D) => void,
) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível gerar a imagem.');
  context.drawImage(image, 0, 0, size, size);
  context.globalCompositeOperation = 'source-in';
  paint(context);
  context.fillRect(0, 0, size, size);
  return canvas;
}

function lines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const out: string[] = [];
  for (const paragraph of text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    if (out.length) out.push('');
    for (const line of wrap(context, paragraph, maxWidth, maxLines)) out.push(line);
    if (out.length >= maxLines) break;
  }
  if (out.length > maxLines) out.length = maxLines;
  return out;
}

/** Cartão 1080×1350 (post / grupos) com o DNA CALI: degradê bordô, lima dourada, logo e folha, categoria, título,
    introdução e o QR Code num painel claro. */
export async function shareCard(
  card: { title: string; category: string; intro: string },
  url: string,
) {
  await Promise.all(
    ['700 68px Inter', '600 30px Inter', '400 30px Inter'].map((font) =>
      document.fonts?.load(font).catch(() => undefined),
    ),
  );
  const W = 1080,
    H = 1350,
    P = 90;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível gerar a imagem.');
  const bg = context.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#7A2840');
  bg.addColorStop(0.55, '#5A1E2D');
  bg.addColorStop(1, '#3A111C');
  context.fillStyle = bg;
  context.fillRect(0, 0, W, H);
  const glow = context.createRadialGradient(160, 120, 0, 160, 120, 620);
  glow.addColorStop(0, 'rgba(217,185,138,.22)');
  glow.addColorStop(1, 'rgba(217,185,138,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, W, H);
  try {
    const lime = await tintedMark('/brand/cali-lime-mark.svg', 900, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 900, 900);
      g.addColorStop(0, 'rgba(217,185,138,.10)');
      g.addColorStop(1, 'rgba(217,185,138,.02)');
      ctx.fillStyle = g;
    });
    context.save();
    context.translate(1010, 560);
    context.rotate(-0.18);
    context.drawImage(lime, -450, -450, 900, 900);
    context.restore();
  } catch {
    /* segue sem a lima */
  }
  try {
    const logo = await loadImage('/brand/cali-logo-light.svg');
    const h = 104;
    context.drawImage(logo, P, 78, (logo.width / logo.height) * h || 190, h);
  } catch {
    /* sem logo */
  }
  try {
    const oak = await tintedMark('/brand/cali-oak-mark.svg', 120, (ctx) => {
      ctx.fillStyle = '#F3E9E1';
    });
    context.drawImage(oak, W - P - 104, 72, 104, 104);
  } catch {
    /* sem folha */
  }

  let y = 300;
  context.fillStyle = '#D9B98A';
  context.font = '700 26px Inter, Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText((card.category || 'Formulário').toUpperCase(), P, y);
  context.letterSpacing = '0px';
  context.fillStyle = '#FFFFFF';
  context.font = '700 68px Inter, Arial, sans-serif';
  y += 84;
  for (const line of wrap(context, card.title, W - P * 2, 3)) {
    context.fillText(line, P, y);
    y += 80;
  }
  const intro = card.intro.trim();
  if (intro) {
    context.fillStyle = 'rgba(255,255,255,.82)';
    context.font = '400 30px Inter, Arial, sans-serif';
    y += 16;
    const room = Math.max(1, Math.floor((860 - y) / 44));
    for (const line of lines(context, intro, W - P * 2 - 40, Math.min(7, room))) {
      if (line) context.fillText(line, P, y);
      y += line ? 44 : 18;
    }
  }

  const panelY = 900,
    panelH = 350;
  context.fillStyle = '#F7F3EE';
  context.beginPath();
  context.roundRect(P, panelY, W - P * 2, panelH, 34);
  context.fill();
  const qr = await loadImage(await qrDataUrl(url, 600));
  context.fillStyle = '#FFFFFF';
  context.beginPath();
  context.roundRect(P + 30, panelY + 30, 290, 290, 22);
  context.fill();
  context.drawImage(qr, P + 45, panelY + 45, 260, 260);
  const tx = P + 360;
  context.fillStyle = '#5A1E2D';
  context.font = '700 36px Inter, Arial, sans-serif';
  context.fillText('Responda pelo celular', tx, panelY + 110);
  context.fillStyle = '#6B5D63';
  context.font = '400 26px Inter, Arial, sans-serif';
  wrap(context, 'Aponte a câmera para o QR Code ou acesse o link:', W - P - tx - 30, 2).forEach(
    (line, index) => context.fillText(line, tx, panelY + 160 + index * 36),
  );
  context.fillStyle = '#7A1F3D';
  context.font = '600 24px Inter, Arial, sans-serif';
  wrap(context, url.replace(/^https?:\/\//, ''), W - P - tx - 30, 2).forEach((line, index) =>
    context.fillText(line, tx, panelY + 250 + index * 32),
  );
  context.fillStyle = 'rgba(243,233,225,.7)';
  context.font = '500 22px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('CALI RH  ·  HR for Business  ·  calirh.com', W / 2, H - 38);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar o cartão.');
  return blob;
}
