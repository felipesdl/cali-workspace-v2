import {
  logoLimits,
  logoSchema,
  type CompanyLogo,
} from '../../../../api/admin/companies/registration-schemas';
const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml']);
function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Não foi possível preparar a logo.'));
    reader.onerror = () => reject(new Error('Não foi possível ler a logo.'));
    reader.readAsDataURL(blob);
  });
}
function load(file: File, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => {
      URL.revokeObjectURL(url);
      signal.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
    };
    const abort = () => {
      cleanup();
      image.src = '';
      reject(new Error('Preparação cancelada.'));
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível ler essa imagem.'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    image.src = url;
  });
}
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Não foi possível preparar essa imagem.')),
      'image/webp',
      quality,
    ),
  );
}
export async function prepareCompanyLogo(file: File, signal: AbortSignal): Promise<CompanyLogo> {
  if (!supported.has(file.type)) throw new Error('Use uma imagem JPG, PNG, WEBP, AVIF ou SVG.');
  if (file.size > logoLimits.inputBytes)
    throw new Error('A imagem original deve ter no máximo 12 MB.');
  const image = await load(file, signal);
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error('A imagem não possui dimensões válidas.');
  const scale = Math.min(1, logoLimits.side / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  let blob: Blob = file;
  if (scale < 1 || file.size > logoLimits.outputBytes || file.type === 'image/svg+xml') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    blob = await encode(canvas, 0.88);
    if (blob.size > logoLimits.outputBytes) blob = await encode(canvas, 0.76);
  }
  if (signal.aborted) throw new Error('Preparação cancelada.');
  if (blob.size > logoLimits.outputBytes)
    throw new Error('Não foi possível reduzir a logo a 700 KB.');
  return logoSchema.parse({
    sourceName: file.name,
    contentType: blob.type,
    dataUrl: await readDataUrl(blob),
    bytes: blob.size,
    width,
    height,
  });
}
