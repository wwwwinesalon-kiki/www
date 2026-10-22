import { createHash } from 'node:crypto';

const PAGE_SIZE = 1000;

function assertKey(key) {
  if (
    typeof key !== 'string' ||
    !key ||
    key.length > 1024 ||
    key.includes('\\') ||
    Array.from(key).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    key
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid source object key');
  }
}

export function keysetDigest(paths, algorithm = 'sha256') {
  const sorted = [...paths].sort((a, b) =>
    Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
  return createHash(algorithm).update(sorted.join('\n'), 'utf8').digest('hex');
}

// listV2 with with_delimiter=false returns every nested key as a flat,
// cursor-paginated object stream. A malformed/incomplete page fails closed.
export async function collectPrivateObjectInventory(bucket) {
  const keys = new Set();
  const cursors = new Set();
  let cursor;
  for (;;) {
    const { data, error } = await bucket.listV2({
      prefix: '',
      limit: PAGE_SIZE,
      with_delimiter: false,
      sortBy: { column: 'name', order: 'asc' },
      ...(cursor ? { cursor } : {}),
    });
    if (
      error ||
      !data ||
      !Array.isArray(data.objects) ||
      !Array.isArray(data.folders) ||
      typeof data.hasNext !== 'boolean' ||
      data.folders.length
    ) {
      throw new Error('Source bucket inventory failed');
    }
    for (const object of data.objects) {
      if (!object || typeof object.id !== 'string' || !object.id)
        throw new Error('Source inventory contains a non-file entry');
      const key = object.key ?? object.name;
      assertKey(key);
      if (keys.has(key))
        throw new Error('Source inventory contains a duplicate key');
      keys.add(key);
    }
    if (!data.hasNext) break;
    if (
      !data.objects.length ||
      typeof data.nextCursor !== 'string' ||
      !data.nextCursor ||
      cursors.has(data.nextCursor)
    ) {
      throw new Error('Source inventory pagination is incomplete');
    }
    cursor = data.nextCursor;
    cursors.add(cursor);
  }
  return {
    keys,
    count: keys.size,
    keysetSha256: keysetDigest(keys),
    keysetMd5: keysetDigest(keys, 'md5'),
  };
}

export function compareObjectKeySets(sourceKeys, metadataKeys) {
  const unreferenced = [...sourceKeys].filter((key) => !metadataKeys.has(key));
  const missing = [...metadataKeys].filter((key) => !sourceKeys.has(key));
  return {
    unreferencedCount: unreferenced.length,
    missingCount: missing.length,
    // Object names may include personal data; only key digests appear in logs.
    unreferencedKeysSha256: keysetDigest(unreferenced),
    missingKeysSha256: keysetDigest(missing),
  };
}
