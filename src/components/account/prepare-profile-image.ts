export async function prepareProfileImage(file: File, kind: 'avatar' | 'signature') {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 10 MiB.');
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000)
      throw new Error('A imagem excede as dimensões permitidas.');
    const ratio = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, kind === 'signature' ? 'image/png' : 'image/webp', 0.88),
    );
    if (!blob || blob.size > 2 * 1024 * 1024)
      throw new Error('A imagem preparada deve ter até 2 MiB.');
    return blob;
  } finally {
    image.close();
  }
}
