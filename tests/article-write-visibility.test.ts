import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  neon: false,
  query: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('@/lib/neon/db', () => ({
  isNeonBackend: () => mocks.neon,
  neonSql: () => mocks.query,
}));
vi.mock('@/lib/neon/crud', () => ({
  neonPatch: mocks.patch,
  neonInsert: vi.fn(),
}));

import { saveArticle } from '../lib/article-write';

const articleId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const version = '2026-10-22T00:00:00.000Z';
const existing = {
  id: articleId,
  updated_at: version,
  public_visible: true,
  publish_status: 'published',
  published_at: version,
};

function request(publishStatus: 'draft' | 'published') {
  return new Request(`https://www.example.test/api/admin/entity/contents/${articleId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '公開記事の編集',
      type: 'FIELD',
      body: '<p>本文</p>',
      cover_image: `/api/media/${mediaId}`,
      cover_alt: '畑の写真',
      publish_status: publishStatus,
      updated_at: version,
    }),
  });
}

function supabaseActor() {
  const update = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    select: vi.fn(() => ({
      maybeSingle: async () => ({
        data: { id: articleId, updated_at: version },
        error: null,
      }),
    })),
  }));
  const from = vi.fn((table: string) => {
    if (table === 'article_media')
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [{ id: mediaId }], error: null }),
          }),
        }),
      };
    return {
      select: () => ({
        eq: () => ({
          is: () => ({
            single: async () => ({ data: existing, error: null }),
          }),
        }),
      }),
      update,
    };
  });
  return { actor: { supabase: { from } } as never, update };
}

afterEach(() => {
  vi.resetAllMocks();
  mocks.neon = false;
});

it.each(['draft', 'published'] as const)(
  'Supabase lets public article %s save only when private image is not public',
  async (status) => {
    const { actor, update } = supabaseActor();
    const response = await saveArticle(request(status), actor, articleId);
    expect(response.status).toBe(status === 'draft' ? 200 : 422);
    expect(update).toHaveBeenCalledTimes(status === 'draft' ? 1 : 0);
    if (status === 'published')
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining('一般公開記事には非公開画像を使えません'),
      });
  },
);

it.each(['draft', 'published'] as const)(
  'Neon lets public article %s save only when private image is not public',
  async (status) => {
    mocks.neon = true;
    mocks.query.mockImplementation(async (parts: TemplateStringsArray) =>
      parts.join('').includes('from public.article_media')
        ? [{ id: mediaId }]
        : [existing],
    );
    mocks.patch.mockResolvedValue({ id: articleId, updated_at_version: version });
    const response = await saveArticle(request(status), {} as never, articleId);
    expect(response.status).toBe(status === 'draft' ? 200 : 422);
    expect(mocks.patch).toHaveBeenCalledTimes(status === 'draft' ? 1 : 0);
    if (status === 'published')
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining('一般公開記事には非公開画像を使えません'),
      });
  },
);
