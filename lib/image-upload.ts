import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './article';
export function checkImage(bytes: Uint8Array, mime: string) {
  if (
    !bytes.length ||
    bytes.length > MAX_IMAGE_BYTES ||
    !IMAGE_TYPES.includes(mime)
  )
    return false;
  if (mime === 'image/jpeg')
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}
