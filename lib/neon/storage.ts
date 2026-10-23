import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, UUID } from '../article';

// Neon Object Storage is S3-compatible. The bucket itself must be provisioned
// as private; credentials and object bytes never reach the browser directly.
let client: S3Client | undefined;

function storageConfig() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.NEON_S3_REGION || process.env.AWS_REGION;
  const accessKeyId = process.env.NEON_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEON_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.NEON_ARTICLE_BUCKET || 'www-article-images';
  if (!endpoint || !region || !accessKeyId || !secretAccessKey)
    throw new Error('Neon画像保存先の設定が未完了です');
  if (new URL(endpoint).protocol !== 'https:')
    throw new Error('Neon画像保存先にはHTTPSが必要です');
  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

function storageClient() {
  const config = storageConfig();
  if (!client)
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  return { client, bucket: config.bucket };
}

export function articleImagePath(articleId: string, mediaId: string) {
  if (!UUID.test(articleId) || !UUID.test(mediaId))
    throw new Error('画像IDが不正です');
  // Preserve the existing Supabase object_path format for lossless migration.
  return `${articleId}/${mediaId}`;
}

export function safeArticleImagePath(path: string) {
  // Historical rows have no object_path shape constraint. Keep their exact
  // keys during migration, while rejecting ambiguous or unsafe path segments.
  if (
    !path ||
    path.length > 1024 ||
    path.includes('\\') ||
    Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    path
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..')
  )
    throw new Error('画像の保存先IDが不正です');
  return path;
}

export async function putArticleImage(
  path: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  safeArticleImagePath(path);
  if (
    bytes.length < 1 ||
    bytes.length > MAX_IMAGE_BYTES ||
    !IMAGE_TYPES.includes(mimeType)
  )
    throw new Error('画像はJPEG PNG WebPの3MB以下にしてください');
  const { client, bucket } = storageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: bytes,
      ContentType: mimeType,
    }),
  );
}

export async function getArticleImage(path: string) {
  safeArticleImagePath(path);
  const { client, bucket } = storageClient();
  let object: GetObjectCommandOutput;
  try {
    object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: path }),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'NoSuchKey' || error.name === 'NotFound')
    )
      return null;
    throw error;
  }
  if (!object.Body || (object.ContentLength || 0) > MAX_IMAGE_BYTES)
    throw new Error('画像データを読み込めません');
  const bytes = await object.Body.transformToByteArray();
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new Error('画像データが大きすぎます');
  return bytes;
}

export async function deleteArticleImage(path: string) {
  safeArticleImagePath(path);
  const { client, bucket } = storageClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
}
