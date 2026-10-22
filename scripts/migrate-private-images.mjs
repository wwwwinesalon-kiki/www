// One-time, non-destructive copy of article image bytes from Supabase Storage
// to a private Neon Object Storage bucket. Run only AFTER importing article_media
// metadata into Neon. Dry-run is the default; no source objects are ever removed.
//
//   node --env-file=.env.migration scripts/migrate-private-images.mjs
//   node --env-file=.env.migration scripts/migrate-private-images.mjs --apply
//   (Set NEON_MEDIA_MIGRATION_APPROVED=1 in the environment before --apply.)
//
// Required env: MIGRATION_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// NEON_DATABASE_URL, AWS_ENDPOINT_URL_S3, AWS_REGION,
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
// Optional: NEON_ARTICLE_BUCKET (default: www-article-images).

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  collectPrivateObjectInventory,
  compareObjectKeySets,
} from './lib/private-image-inventory.mjs';

const IMAGE_BUCKET = process.env.NEON_ARTICLE_BUCKET || 'www-article-images';
const SOURCE_BUCKET = 'www-article-images';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

function assertSetup() {
  if ([...args].some((arg) => arg !== '--apply' && arg !== '--dry-run'))
    throw new Error('Unknown argument');
  const required = [
    'MIGRATION_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEON_DATABASE_URL',
    'AWS_ENDPOINT_URL_S3',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length)
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  const sourceUrl = new URL(process.env.MIGRATION_SUPABASE_URL);
  const targetUrl = new URL(process.env.AWS_ENDPOINT_URL_S3);
  const dbUrl = new URL(process.env.NEON_DATABASE_URL);
  if (
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.hostname !== 'rskhvvvqynxpeulvlydr.supabase.co' ||
    targetUrl.protocol !== 'https:' ||
    !['postgresql:', 'postgres:'].includes(dbUrl.protocol)
  )
    throw new Error('Source or target URL is invalid');
  if (apply && args.has('--dry-run')) throw new Error('Choose only one mode');
  if (apply && process.env.NEON_MEDIA_MIGRATION_APPROVED !== '1')
    throw new Error(
      'Set NEON_MEDIA_MIGRATION_APPROVED=1 to permit target writes',
    );
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertObjectPath(path, mediaId, articleId) {
  if (!UUID.test(mediaId) || !UUID.test(articleId))
    throw new Error('Unexpected article image metadata');
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
    throw new Error('Unexpected article image object key');
}

async function readTarget(s3, path) {
  let response;
  try {
    response = await s3.send(
      new GetObjectCommand({ Bucket: IMAGE_BUCKET, Key: path }),
    );
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.name === 'NotFound') return null;
    throw error;
  }
  if (!response.Body || (response.ContentLength || 0) > MAX_IMAGE_BYTES)
    throw new Error('Target image is missing or too large');
  const bytes = await response.Body.transformToByteArray();
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new Error('Target image is too large');
  return bytes;
}

async function main() {
  assertSetup();
  const source = createClient(
    process.env.MIGRATION_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const sql = neon(process.env.NEON_DATABASE_URL);
  const s3 = new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  let inspected = 0;
  let copied = 0;
  let alreadyPresent = 0;
  let wouldCopy = 0;
  let recorded = 0;
  let offset = 0;
  const sourceBucket = source.storage.from(SOURCE_BUCKET);
  console.log(
    apply
      ? 'Private image migration: APPLY'
      : 'Private image migration: DRY RUN',
  );
  // An incomplete retry must never leave a previously valid cutover attestation.
  if (apply)
    await sql`delete from public.www_media_inventory_checkpoint where singleton`;
  const sourceInventory = await collectPrivateObjectInventory(sourceBucket);
  const metadataKeys = new Set();
  for (let metadataOffset = 0; ;) {
    const rows = await sql`
      select id, article_id, object_path from public.article_media
      order by id limit 100 offset ${metadataOffset}
    `;
    if (!rows.length) break;
    for (const row of rows) {
      const path = String(row.object_path);
      assertObjectPath(path, String(row.id), String(row.article_id));
      if (metadataKeys.has(path))
        throw new Error('Duplicate article image object key');
      metadataKeys.add(path);
    }
    metadataOffset += rows.length;
  }
  const inventoryComparison = compareObjectKeySets(
    sourceInventory.keys,
    metadataKeys,
  );
  console.log(
    JSON.stringify({
      sourceObjectCount: sourceInventory.count,
      metadataObjectCount: metadataKeys.size,
      sourceKeysSha256: sourceInventory.keysetSha256,
      ...inventoryComparison,
    }),
  );
  if (
    inventoryComparison.unreferencedCount ||
    inventoryComparison.missingCount
  ) {
    throw new Error('Source bucket contains unreferenced or missing images');
  }
  for (;;) {
    const mediaRows = await sql`
      select id, article_id, object_path, mime_type, size_bytes
      from public.article_media order by id limit 100 offset ${offset}
    `;
    if (!mediaRows.length) break;
    for (const media of mediaRows) {
      let phase = 'metadata';
      try {
        const mediaId = String(media.id);
        const articleId = String(media.article_id);
        const path = String(media.object_path);
        assertObjectPath(path, mediaId, articleId);
        const { data: sourceRow, error: sourceRowError } = await source
          .from('article_media')
          .select('id,article_id,object_path,mime_type,size_bytes')
          .eq('id', mediaId)
          .maybeSingle();
        if (
          sourceRowError ||
          !sourceRow ||
          sourceRow.article_id !== articleId ||
          sourceRow.object_path !== path ||
          sourceRow.mime_type !== media.mime_type ||
          sourceRow.size_bytes !== media.size_bytes
        )
          throw new Error('Source and target metadata differ');
        const statusRows = await sql`
          select target_object_key, sha256
          from public.www_media_migration_status
          where media_id = ${mediaId}::uuid
        `;
        phase = 'source_download';
        const { data: sourceBlob, error: sourceError } =
          await sourceBucket.download(path);
        if (sourceError || !sourceBlob)
          throw new Error('Source image unavailable');
        const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());
        if (
          sourceBytes.length !== media.size_bytes ||
          sourceBytes.length > MAX_IMAGE_BYTES
        )
          throw new Error('Source image size mismatch');
        const sourceHash = digest(sourceBytes);
        if (
          statusRows.length &&
          (statusRows[0].target_object_key !== path ||
            statusRows[0].sha256 !== sourceHash)
        )
          throw new Error('Previous verification conflicts with source');
        phase = 'target_download';
        let targetBytes = await readTarget(s3, path);
        if (targetBytes) {
          if (digest(targetBytes) !== sourceHash)
            throw new Error('Existing target image differs from source');
          alreadyPresent++;
        } else if (!apply) {
          if (statusRows.length)
            throw new Error(
              'Verification row exists but target image is missing',
            );
          wouldCopy++;
        } else if (apply) {
          phase = 'target_upload';
          await s3.send(
            new PutObjectCommand({
              Bucket: IMAGE_BUCKET,
              Key: path,
              Body: sourceBytes,
              ContentType: media.mime_type,
            }),
          );
          phase = 'target_verify';
          targetBytes = await readTarget(s3, path);
          if (!targetBytes || digest(targetBytes) !== sourceHash)
            throw new Error(
              'Uploaded target image failed SHA-256 verification',
            );
          copied++;
        }
        if (apply && !statusRows.length) {
          phase = 'status_write';
          const inserted = await sql`
            insert into public.www_media_migration_status
              (media_id, target_object_key, sha256, verified_at)
            values (${mediaId}::uuid, ${path}, ${sourceHash}, now())
            on conflict (media_id) do nothing
            returning media_id
          `;
          if (!inserted.length) {
            const existing = await sql`
              select target_object_key, sha256
              from public.www_media_migration_status
              where media_id = ${mediaId}::uuid
            `;
            if (
              existing[0]?.target_object_key !== path ||
              existing[0]?.sha256 !== sourceHash
            )
              throw new Error('Concurrent verification conflicts with source');
          } else recorded++;
        }
        inspected++;
      } catch (error) {
        // Deliberately omit provider exception details, credentials, object bytes,
        // and customer data from logs. Media UUID + phase are enough to triage.
        console.error(
          `Image migration stopped: media=${media.id} phase=${phase} type=${error?.name || 'Error'}`,
        );
        throw new Error('Private image migration failed');
      }
    }
    offset += mediaRows.length;
  }
  // Re-enumerate after copying. The documented write freeze is mandatory, but
  // this also catches a source change while a long image migration was running.
  const finalInventory = await collectPrivateObjectInventory(sourceBucket);
  if (
    finalInventory.count !== sourceInventory.count ||
    finalInventory.keysetSha256 !== sourceInventory.keysetSha256
  ) {
    throw new Error('Source bucket changed during image migration');
  }
  if (apply) {
    const rows = await sql`
      select count(*)::integer as count from public.www_media_migration_status
    `;
    if (rows[0]?.count !== metadataKeys.size)
      throw new Error('Private image verification ledger is incomplete');
    await sql`
      insert into public.www_media_inventory_checkpoint
        (singleton, source_bucket, source_object_count, source_keys_md5,
         source_keys_sha256, verified_at)
      values (true, ${SOURCE_BUCKET}, ${sourceInventory.count},
        ${sourceInventory.keysetMd5}, ${sourceInventory.keysetSha256}, now())
    `;
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      inspected,
      wouldCopy,
      copied,
      alreadyPresent,
      recorded,
      sourceObjectCount: sourceInventory.count,
      sourceKeysSha256: sourceInventory.keysetSha256,
      inventoryCheckpointRecorded: apply,
    }),
  );
  if (!apply)
    console.log('No target objects or verification rows were changed');
}

main().catch((error) => {
  // Errors from providers may include URLs or credential-bearing context.
  const safeFailures = new Set([
    'Source bucket contains unreferenced or missing images',
    'Source bucket changed during image migration',
    'Private image verification ledger is incomplete',
  ]);
  console.error(
    error.message === 'Private image migration failed' ||
      safeFailures.has(error.message)
      ? error.message
      : 'Migration setup or provider operation failed',
  );
  process.exitCode = 1;
});
