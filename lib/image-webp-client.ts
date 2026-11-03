'use client';

export async function imageToWebp(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPEG・PNG・WebP画像を選んでください');
  if (file.size > 25 * 1024 * 1024)
    throw new Error('元の画像は25MB以内にしてください');
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像の変換に失敗しました');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('画像をWebPに変換できませんでした')), 'image/webp', 0.9),
    );
    if (blob.type !== 'image/webp') throw new Error('このブラウザーではWebP変換を利用できません');
    if (blob.size > 3 * 1024 * 1024) throw new Error('変換後の画像が3MBを超えています 画像を小さくして再試行してください');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
