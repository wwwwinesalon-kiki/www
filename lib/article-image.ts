import sharp from 'sharp';
import { MAX_IMAGE_BYTES } from './article';

/** Decode, orient and re-encode uploads so stored files are genuine WebP. */
export async function articleWebp(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      !file.size || file.size > 12 * 1024 * 1024)
    throw new Error('JPEG PNG WebPの12MB以下の画像を選択してください');
  const input = new Uint8Array(await file.arrayBuffer());
  try {
    const bytes = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image_too_large');
    return new Uint8Array(bytes);
  } catch {
    throw new Error('画像を変換できませんでした 別の画像を選択してください');
  }
}
