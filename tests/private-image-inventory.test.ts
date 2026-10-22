import { describe, expect, it } from 'vitest';
import {
  collectPrivateObjectInventory,
  compareObjectKeySets,
  keysetDigest,
} from '../scripts/lib/private-image-inventory.mjs';

function bucket(pages: unknown[]) {
  const requests: unknown[] = [];
  return {
    requests,
    listV2: async (options: unknown) => {
      requests.push(options);
      return pages.shift();
    },
  };
}

describe('private source-bucket inventory', () => {
  it('enumerates nested keys through all cursor pages', async () => {
    const source = bucket([
      {
        data: {
          objects: [{ id: '1', key: 'a/first.jpg', name: 'first.jpg' }],
          folders: [],
          hasNext: true,
          nextCursor: 'page-2',
        },
        error: null,
      },
      {
        data: {
          objects: [
            { id: '2', key: 'b/deep/second.webp', name: 'second.webp' },
          ],
          folders: [],
          hasNext: false,
        },
        error: null,
      },
    ]);
    const inventory = await collectPrivateObjectInventory(source);
    expect(inventory.count).toBe(2);
    expect(inventory.keys).toEqual(
      new Set(['a/first.jpg', 'b/deep/second.webp']),
    );
    expect(inventory.keysetSha256).toBe(
      keysetDigest(new Set(['a/first.jpg', 'b/deep/second.webp'])),
    );
    expect(source.requests).toMatchObject([
      { prefix: '', with_delimiter: false },
      { prefix: '', with_delimiter: false, cursor: 'page-2' },
    ]);
  });

  it('reports unreferenced and missing keys without exposing names', () => {
    const result = compareObjectKeySets(
      new Set(['known.jpg', 'orphan.jpg']),
      new Set(['known.jpg', 'missing.jpg']),
    );
    expect(result).toMatchObject({ unreferencedCount: 1, missingCount: 1 });
    expect(JSON.stringify(result)).not.toContain('orphan.jpg');
    expect(JSON.stringify(result)).not.toContain('missing.jpg');
  });

  it.each([
    [{ data: null, error: new Error('denied') }],
    [{ data: { objects: [], folders: [], hasNext: true } }],
    [{ data: { objects: [], folders: [{ name: 'hidden' }], hasNext: false } }],
    [
      {
        data: {
          objects: [{ id: '1', key: '../unsafe.jpg' }],
          folders: [],
          hasNext: false,
        },
      },
    ],
    [
      {
        data: {
          objects: [{ id: '1', key: 'same.jpg' }],
          folders: [],
          hasNext: true,
          nextCursor: 'again',
        },
      },
      {
        data: {
          objects: [{ id: '2', key: 'same.jpg' }],
          folders: [],
          hasNext: false,
        },
      },
    ],
  ])('fails closed on incomplete or invalid inventory', async (...pages) => {
    await expect(
      collectPrivateObjectInventory(bucket(pages)),
    ).rejects.toThrow();
  });
});
