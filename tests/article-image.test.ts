import { expect, it } from 'vitest';
import sharp from 'sharp';
import { articleWebp } from '../lib/article-image';

it('decodes images and stores a bounded genuine WebP without metadata', async () => {
  const png = await sharp({ create: { width: 2600, height: 1300, channels: 3, background: '#8a4058' } }).png().toBuffer();
  const result = await articleWebp(new File([new Uint8Array(png)], 'photo.png', { type: 'image/png' }));
  const metadata = await sharp(result).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.width).toBe(2400);
  expect(metadata.height).toBe(1200);
  expect(metadata.exif).toBeUndefined();
});

it('rejects corrupted files even when the declared type is an image', async () => {
  await expect(articleWebp(new File(['not an image'], 'fake.png', { type: 'image/png' })))
    .rejects.toThrow('画像を変換できませんでした');
});
