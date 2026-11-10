import decodeWebp, { init as initWebp } from '@jsquash/webp/decode';
// Vite incorpora o WASM no bundle autocontido da Edge.
import decoderWasmUrl from '@jsquash/webp/codec/dec/webp_dec.wasm?inline';

const MAX_INPUT_BYTES = 3_000_000;
const MAX_PIXELS = 4_000_000;
const MAX_OUTPUT_BYTES = 6_000_000;
const SIGNATURE = new TextEncoder();
let decoderInitialization: Promise<void> | null = null;

type ImageSize = { width: number; height: number };

function assertDimensions({ width, height }: ImageSize): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_PIXELS
  ) {
    throw new Error('Imagem inválida ou acima do limite de pixels.');
  }
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (length < 7) return null;
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  if (
    bytes.length < 20 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
    String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP'
  )
    return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const chunkLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      offset + 4,
      true,
    );
    const payload = offset + 8;
    if (payload + chunkLength > bytes.length) return null;
    if (kind === 'VP8X' && chunkLength >= 10) {
      const width = 1 + bytes[payload + 4] + (bytes[payload + 5] << 8) + (bytes[payload + 6] << 16);
      const height =
        1 + bytes[payload + 7] + (bytes[payload + 8] << 8) + (bytes[payload + 9] << 16);
      return { width, height };
    }
    if (kind === 'VP8 ' && chunkLength >= 10 && bytes[payload + 3] === 0x9d) {
      return {
        width: (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff,
        height: (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff,
      };
    }
    if (kind === 'VP8L' && chunkLength >= 5 && bytes[payload] === 0x2f) {
      const b1 = bytes[payload + 1];
      const b2 = bytes[payload + 2];
      const b3 = bytes[payload + 3];
      const b4 = bytes[payload + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }
    offset = payload + chunkLength + (chunkLength % 2);
  }
  return null;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: string, data: Uint8Array): Uint8Array {
  const kind = SIGNATURE.encode(name);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(kind, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

async function encodePng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let row = 0; row < height; row++) {
    const start = row * (width * 4 + 1);
    scanlines.set(data.subarray(row * width * 4, (row + 1) * width * 4), start + 1);
  }
  const stream = new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array()),
  ];
  const total = parts.reduce((size, part) => size + part.length, 0);
  if (total > MAX_OUTPUT_BYTES) throw new Error('Imagem convertida excede o limite de bytes.');
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function decode(
  bytes: Uint8Array,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  if (typeof globalThis.ImageData !== 'function') {
    Object.defineProperty(globalThis, 'ImageData', {
      configurable: true,
      value: class ImageDataPolyfill {
        constructor(
          readonly data: Uint8ClampedArray,
          readonly width: number,
          readonly height: number,
        ) {}
      },
    });
  }
  decoderInitialization ??= (async () => {
    const encoded = decoderWasmUrl.split(',')[1];
    if (!encoded) throw new Error('Decoder WebP sem módulo WASM incorporado.');
    const binary = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    await initWebp(new WebAssembly.Module(binary));
  })();
  await decoderInitialization;
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const image = await decodeWebp(buffer);
  return { data: image.data, width: image.width, height: image.height };
}

export async function normalizeDiscImage(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > MAX_INPUT_BYTES)
    throw new Error('Imagem vazia ou acima do limite de bytes.');
  const normalizedMime = mime.split(';', 1)[0].trim().toLowerCase();
  if (normalizedMime === 'image/png') {
    const size = pngSize(bytes);
    if (!size) throw new Error('Arquivo PNG inválido.');
    assertDimensions(size);
    return bytes;
  }
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
    const size = jpegSize(bytes);
    if (!size) throw new Error('Arquivo JPEG inválido.');
    assertDimensions(size);
    return bytes;
  }
  if (normalizedMime !== 'image/webp') throw new Error('Formato de imagem não permitido.');
  const size = webpSize(bytes);
  if (!size) throw new Error('Arquivo WebP inválido.');
  assertDimensions(size);
  const image = await decode(bytes);
  assertDimensions(image);
  if (image.width !== size.width || image.height !== size.height)
    throw new Error('Dimensões WebP inconsistentes.');
  return encodePng(image.data, image.width, image.height);
}
